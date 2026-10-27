import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

function envWith(overrides: Partial<Env>): Env {
  return { ...env, ...overrides };
}

describe("loadConfig", () => {
  it("reads the vars from wrangler.jsonc and the secrets", () => {
    expect(loadConfig(env)).toEqual({
      maxNameLength: 32,
      rateLimitPerHour: 10,
      ngWords: [],
      exportToken: "test-export-token",
    });
  });

  it("uses overridden values", () => {
    const config = loadConfig(
      envWith({ MAX_NAME_LENGTH: "16", RATE_LIMIT_PER_HOUR: "3", NG_WORDS: '["foo","バー"]' }),
    );
    expect(config).toMatchObject({ maxNameLength: 16, rateLimitPerHour: 3, ngWords: ["foo", "バー"] });
  });

  it.each(["", "0", "-1", "1.5", "abc", " 32"])("rejects MAX_NAME_LENGTH=%j", (value) => {
    expect(() => loadConfig(envWith({ MAX_NAME_LENGTH: value }))).toThrow("MAX_NAME_LENGTH");
  });

  it.each(["", "0", "ten"])("rejects RATE_LIMIT_PER_HOUR=%j", (value) => {
    expect(() => loadConfig(envWith({ RATE_LIMIT_PER_HOUR: value }))).toThrow("RATE_LIMIT_PER_HOUR");
  });

  it.each(["", "foo", '"foo"', "{}", "[1]", '["foo", null]'])("rejects NG_WORDS=%j", (value) => {
    expect(() => loadConfig(envWith({ NG_WORDS: value }))).toThrow("NG_WORDS");
  });

  it("rejects an empty EXPORT_TOKEN", () => {
    expect(() => loadConfig(envWith({ EXPORT_TOKEN: "" }))).toThrow("EXPORT_TOKEN");
  });
});
