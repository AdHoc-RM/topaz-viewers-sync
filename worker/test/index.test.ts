import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("responds 404 to unknown paths", async () => {
  const response = await exports.default.fetch("https://example.com/unknown");
  expect(response.status).toBe(404);
});
