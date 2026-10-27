import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

function exportRequest(headers: HeadersInit = {}) {
  return exports.default.fetch("https://example.com/export", { headers });
}

async function insertName(name: string, createdAt: string, hidden = 0) {
  await env.DB.prepare("INSERT INTO names (name, name_key, created_at, hidden) VALUES (?, ?, ?, ?)")
    .bind(name, name.toLowerCase(), createdAt, hidden)
    .run();
}

describe("GET /export", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM names").run();
  });

  it.each([
    ["no Authorization header", {}],
    ["a wrong token", { Authorization: "Bearer wrong-token" }],
    ["a token with a different length", { Authorization: "Bearer test-export-token-extra" }],
    ["an empty token", { Authorization: "Bearer " }],
    ["a different scheme", { Authorization: "Basic test-export-token" }],
    ["the token without a scheme", { Authorization: "test-export-token" }],
  ])("responds 403 to %s", async (_, headers) => {
    await insertName("Yukke", "2026-10-26T00:00:00Z");

    const response = await exportRequest(headers);

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("Yukke");
  });

  it("returns visible names from the oldest registration", async () => {
    await insertName("second", "2026-10-26T00:02:00Z");
    await insertName("hidden", "2026-10-26T00:00:30Z", 1);
    await insertName("first", "2026-10-26T00:01:00Z");
    await insertName("third", "2026-10-26T00:03:00Z");

    const response = await exportRequest({ Authorization: "Bearer test-export-token" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      users: [{ name: "first" }, { name: "second" }, { name: "third" }],
      count: 3,
    });
  });

  it("returns an empty list when no names are registered", async () => {
    const response = await exportRequest({ Authorization: "Bearer test-export-token" });

    expect(await response.json()).toEqual({ users: [], count: 0 });
  });

  it("responds 404 to other methods", async () => {
    const response = await exports.default.fetch("https://example.com/export", {
      method: "POST",
      headers: { Authorization: "Bearer test-export-token" },
    });

    expect(response.status).toBe(404);
  });
});
