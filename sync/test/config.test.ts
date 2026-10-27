import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const env = {
  TOPAZ_STREAM_KEY: "stream-key",
  EXPORT_URL: "https://worker.example.com/export",
  EXPORT_TOKEN: "test-export-token",
  PUBLISHED_URL: "https://example.github.io/topaz-viewers-sync/live.json",
};

describe("loadConfig", () => {
  it("builds the TopazChat URL for the shared server", () => {
    expect(loadConfig(env)).toEqual({
      topazUrl: "https://api.topaz.chat/api/v1/connections/live/stream-key",
      exportUrl: "https://worker.example.com/export",
      exportToken: "test-export-token",
      publishedUrl: "https://example.github.io/topaz-viewers-sync/live.json",
    });
  });

  it("treats an empty server domain as the shared server", () => {
    expect(loadConfig({ ...env, TOPAZ_SERVER_DOMAIN: "" }).topazUrl).toBe(
      "https://api.topaz.chat/api/v1/connections/live/stream-key",
    );
  });

  it("builds the TopazChat URL for a dedicated server", () => {
    expect(loadConfig({ ...env, TOPAZ_SERVER_DOMAIN: "topaz.example.com" }).topazUrl).toBe(
      "https://api.topaz.chat/api/v1/connections/topaz.example.com/live/stream-key",
    );
  });

  it("encodes the stream key and the server domain", () => {
    expect(loadConfig({ ...env, TOPAZ_STREAM_KEY: "a/b?c", TOPAZ_SERVER_DOMAIN: "x/y" }).topazUrl).toBe(
      "https://api.topaz.chat/api/v1/connections/x%2Fy/live/a%2Fb%3Fc",
    );
  });

  it.each(["TOPAZ_STREAM_KEY", "EXPORT_URL", "EXPORT_TOKEN", "PUBLISHED_URL"])("rejects a missing %s", (key) => {
    expect(() => loadConfig({ ...env, [key]: undefined })).toThrow(key);
    expect(() => loadConfig({ ...env, [key]: "" })).toThrow(key);
  });
});
