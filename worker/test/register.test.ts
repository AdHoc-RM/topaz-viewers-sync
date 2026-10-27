import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRegister } from "../src/register";
import { encode } from "./encode";

const IP = "203.0.113.7";

function envWith(overrides: Partial<Env>): Env {
  return { ...env, ...overrides };
}

async function register(name: string, options: { ip?: string; env?: Env } = {}) {
  const { n, c } = encode(name);
  const request = new Request(`https://example.com/r?n=${n}&c=${c}`, {
    headers: { "CF-Connecting-IP": options.ip ?? IP },
  });
  const response = await handleRegister(request, options.env ?? env);
  expect(response.status).toBe(200);
  return response.text();
}

async function savedNames() {
  const { results } = await env.DB.prepare("SELECT name, name_key FROM names ORDER BY id").all();
  return results;
}

async function hitCount() {
  return env.DB.prepare("SELECT COUNT(*) AS count FROM hits").first<number>("count");
}

describe("GET /r", () => {
  beforeEach(async () => {
    await env.DB.batch([env.DB.prepare("DELETE FROM names"), env.DB.prepare("DELETE FROM hits")]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves a new name and responds OK", async () => {
    expect(await register("Yukke")).toBe("OK");
    expect(await savedNames()).toEqual([{ name: "Yukke", name_key: "yukke" }]);
  });

  it("is routed from the Worker", async () => {
    const { n, c } = encode("ゆっけ");
    const response = await exports.default.fetch(`https://example.com/r?n=${n}&c=${c}`, {
      headers: { "CF-Connecting-IP": IP },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("OK");
  });

  it("responds 404 to other methods", async () => {
    const response = await exports.default.fetch("https://example.com/r", { method: "POST" });
    expect(response.status).toBe(404);
  });

  describe("treats names differing only in width or case as duplicates", () => {
    it.each([
      ["Yukke", "ＹＵＫＫＥ"],
      ["Yukke", "yUkKe"],
      ["ﾕｯｹ", "ユッケ"],
      ["名前1", "名前１"],
    ])("keeps %j and ignores %j", async (first, second) => {
      expect(await register(first)).toBe("OK");
      expect(await register(second)).toBe("OK");

      expect(await savedNames()).toEqual([{ name: first, name_key: first.normalize("NFKC").toLowerCase() }]);
    });
  });

  it("saves names that differ in more than width or case", async () => {
    expect(await register("Yukke")).toBe("OK");
    expect(await register("Yukke2")).toBe("OK");
    expect((await savedNames()).map(({ name }) => name)).toEqual(["Yukke", "Yukke2"]);
  });

  it("responds BROKEN to a broken URL without saving", async () => {
    const response = await handleRegister(new Request("https://example.com/r?n=3086&c=0000"), env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("BROKEN");
    expect(await savedNames()).toEqual([]);
    expect(await hitCount()).toBe(0);
  });

  it("responds INVALID to a name that is too long without saving", async () => {
    expect(await register("あ".repeat(33))).toBe("INVALID");
    expect(await savedNames()).toEqual([]);
    expect(await hitCount()).toBe(0);
  });

  describe("NG words", () => {
    const ngEnv = envWith({ NG_WORDS: '["badword","ダメ"]' });

    it.each([
      ["an exact NG word", "badword"],
      ["a name containing an NG word", "xxBadWordxx"],
      ["a full-width NG word", "ｂａｄｗｏｒｄ"],
      ["a half-width katakana NG word", "ﾀﾞﾒです"],
    ])("responds NG to %s without saving", async (_, name) => {
      expect(await register(name, { env: ngEnv })).toBe("NG");
      expect(await savedNames()).toEqual([]);
      expect(await hitCount()).toBe(0);
    });

    it("accepts a name without NG words", async () => {
      expect(await register("goodword", { env: ngEnv })).toBe("OK");
    });
  });

  describe("rate limit", () => {
    const limitEnv = envWith({ RATE_LIMIT_PER_HOUR: "3" });

    it("responds LIMIT after the limit is reached from the same IP", async () => {
      for (const name of ["a", "b", "c"]) {
        expect(await register(name, { env: limitEnv })).toBe("OK");
      }

      expect(await register("d", { env: limitEnv })).toBe("LIMIT");
      expect((await savedNames()).map(({ name }) => name)).toEqual(["a", "b", "c"]);
    });

    it("counts registrations of an already saved name", async () => {
      for (let i = 0; i < 3; i++) {
        expect(await register("a", { env: limitEnv })).toBe("OK");
      }

      expect(await register("b", { env: limitEnv })).toBe("LIMIT");
    });

    it("counts each IP separately", async () => {
      for (const name of ["a", "b", "c"]) {
        await register(name, { env: limitEnv });
      }

      expect(await register("d", { env: limitEnv, ip: "198.51.100.1" })).toBe("OK");
    });

    it("does not count LIMIT responses", async () => {
      for (const name of ["a", "b", "c", "d", "e"]) {
        await register(name, { env: limitEnv });
      }

      expect(await hitCount()).toBe(3);
    });

    it("allows registration again after an hour and deletes old hits", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-26T00:00:00Z"));
      for (const name of ["a", "b", "c"]) {
        await register(name, { env: limitEnv });
      }
      await register("other", { env: limitEnv, ip: "198.51.100.1" });

      vi.setSystemTime(new Date("2026-10-26T00:59:59Z"));
      expect(await register("d", { env: limitEnv })).toBe("LIMIT");

      vi.setSystemTime(new Date("2026-10-26T01:00:01Z"));
      expect(await register("d", { env: limitEnv })).toBe("OK");
      // 別の接続元の古い行も消える
      expect(await hitCount()).toBe(1);
    });
  });

  it("does not store the original IP address", async () => {
    await register("Yukke", { ip: IP });

    const { results } = await env.DB.prepare("SELECT ip_hash FROM hits").all<{ ip_hash: string }>();
    expect(results).toHaveLength(1);
    expect(results[0]?.ip_hash).toMatch(/^[0-9a-f]{64}$/);

    // 鍵なしの SHA-256 だと総当たりで IP に戻せる
    const unkeyedHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(IP)))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    expect(results[0]?.ip_hash).not.toBe(unkeyedHash);

    const dump = JSON.stringify(
      await env.DB.batch([env.DB.prepare("SELECT * FROM names"), env.DB.prepare("SELECT * FROM hits")]),
    );
    expect(dump).not.toContain(IP);
  });
});
