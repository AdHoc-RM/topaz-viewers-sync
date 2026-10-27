import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../src/config.ts";
import { generateLive } from "../src/live.ts";

const config: Config = {
  topazUrl: "https://topaz.example.com/live/stream-key",
  exportUrl: "https://worker.example.com/export",
  exportToken: "test-export-token",
  publishedUrl: "https://example.github.io/live.json",
};

const now = new Date("2026-10-27T12:34:56.789Z");

const published = {
  live: 120,
  live_ok: true,
  registered: 2,
  users: [{ name: "old-first" }, { name: "old-second" }],
  updated_at: "2026-10-27T12:30:00Z",
};

type Route = () => Response | Promise<Response>;

// URL ごとに応答を決める。登録していない URL への問い合わせはテストの誤りなので失敗させる
function fakeFetch(routes: Partial<Record<"topazUrl" | "exportUrl" | "publishedUrl", Route>>) {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = String(input);
    const key = (["topazUrl", "exportUrl", "publishedUrl"] as const).find((name) => config[name] === url);
    const route = key && routes[key];
    if (!route) {
      throw new Error(`Unexpected request: ${url}`);
    }
    return route();
  });
}

const exported = () =>
  Response.json({ users: [{ name: "first" }, { name: "second" }, { name: "三番目" }], count: 3 });

const networkError = () => {
  throw new TypeError("fetch failed");
};

describe("generateLive", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("uses the live count and the exported names", async () => {
    const fetchFn = fakeFetch({ topazUrl: () => new Response("400"), exportUrl: exported });

    expect(await generateLive(config, fetchFn, now)).toEqual({
      live: 400,
      live_ok: true,
      registered: 3,
      users: [{ name: "first" }, { name: "second" }, { name: "三番目" }],
      updated_at: "2026-10-27T12:34:56Z",
    });
    expect(fetchFn).toHaveBeenCalledWith(
      config.exportUrl,
      expect.objectContaining({ headers: { Authorization: "Bearer test-export-token" } }),
    );
  });

  it("accepts 0 and surrounding whitespace from TopazChat", async () => {
    const fetchFn = fakeFetch({ topazUrl: () => new Response("0\n"), exportUrl: exported });

    expect(await generateLive(config, fetchFn, now)).toMatchObject({ live: 0, live_ok: true });
  });

  it("does not read the published live.json when both sources succeed", async () => {
    const fetchFn = fakeFetch({ topazUrl: () => new Response("400"), exportUrl: exported });

    await generateLive(config, fetchFn, now);

    expect(fetchFn).not.toHaveBeenCalledWith(config.publishedUrl, expect.anything());
  });

  it.each<[string, Route]>([
    ["a network error", networkError],
    ["an error status", () => new Response("500", { status: 500 })],
    ["an error text", () => new Response("invalid domain")],
    ["a negative number", () => new Response("-1")],
    ["a decimal", () => new Response("1.5")],
    ["an empty body", () => new Response("")],
  ])("carries over the published live count when TopazChat returns %s", async (_, topaz) => {
    const fetchFn = fakeFetch({
      topazUrl: topaz,
      exportUrl: exported,
      publishedUrl: () => Response.json(published),
    });

    expect(await generateLive(config, fetchFn, now)).toEqual({
      live: 120,
      live_ok: false,
      registered: 3,
      users: [{ name: "first" }, { name: "second" }, { name: "三番目" }],
      updated_at: "2026-10-27T12:34:56Z",
    });
  });

  it.each<[string, Route]>([
    ["a network error", networkError],
    ["403", () => new Response("Forbidden", { status: 403 })],
    ["a body that is not JSON", () => new Response("<html>")],
    ["a body without users", () => Response.json({ count: 0 })],
    ["a user without a name", () => Response.json({ users: [{ name: "first" }, {}], count: 2 })],
  ])("carries over the published names when the export returns %s", async (_, exportRoute) => {
    const fetchFn = fakeFetch({
      topazUrl: () => new Response("400"),
      exportUrl: exportRoute,
      publishedUrl: () => Response.json(published),
    });

    expect(await generateLive(config, fetchFn, now)).toEqual({
      live: 400,
      live_ok: true,
      registered: 2,
      users: [{ name: "old-first" }, { name: "old-second" }],
      updated_at: "2026-10-27T12:34:56Z",
    });
  });

  it("carries over both values when both sources fail", async () => {
    const fetchFn = fakeFetch({
      topazUrl: networkError,
      exportUrl: networkError,
      publishedUrl: () => Response.json(published),
    });

    expect(await generateLive(config, fetchFn, now)).toEqual({
      live: 120,
      live_ok: false,
      registered: 2,
      users: [{ name: "old-first" }, { name: "old-second" }],
      updated_at: "2026-10-27T12:34:56Z",
    });
  });

  it("uses 0 and no names on the first run when both sources fail", async () => {
    const fetchFn = fakeFetch({
      topazUrl: networkError,
      exportUrl: networkError,
      publishedUrl: () => new Response("Not Found", { status: 404 }),
    });

    expect(await generateLive(config, fetchFn, now)).toEqual({
      live: 0,
      live_ok: false,
      registered: 0,
      users: [],
      updated_at: "2026-10-27T12:34:56Z",
    });
  });

  it("uses the fetched values on the first run when one source fails", async () => {
    const fetchFn = fakeFetch({
      topazUrl: () => new Response("400"),
      exportUrl: networkError,
      publishedUrl: () => new Response("Not Found", { status: 404 }),
    });

    expect(await generateLive(config, fetchFn, now)).toMatchObject({
      live: 400,
      live_ok: true,
      registered: 0,
      users: [],
    });
  });

  it.each<[string, Route]>([
    ["a network error", networkError],
    ["an error status", () => new Response("Service Unavailable", { status: 503 })],
    ["a body that is not JSON", () => new Response("<html>")],
    ["a body without live", () => Response.json({ ...published, live: undefined })],
    ["a body without users", () => Response.json({ ...published, users: undefined })],
  ])("fails instead of dropping the names when the published live.json returns %s", async (_, publishedRoute) => {
    const fetchFn = fakeFetch({
      topazUrl: () => new Response("400"),
      exportUrl: networkError,
      publishedUrl: publishedRoute,
    });

    await expect(generateLive(config, fetchFn, now)).rejects.toThrow();
  });
});
