import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

async function columnsOf(table: string) {
  const { results } = await env.DB.prepare(
    "SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info(?) ORDER BY cid",
  )
    .bind(table)
    .all();
  return results;
}

describe("D1 schema", () => {
  it("creates the names table", async () => {
    expect(await columnsOf("names")).toEqual([
      { name: "id", type: "INTEGER", notnull: 0, dflt_value: null, pk: 1 },
      { name: "name", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
      { name: "name_key", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
      { name: "created_at", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
      { name: "hidden", type: "INTEGER", notnull: 1, dflt_value: "0", pk: 0 },
    ]);
  });

  it("creates the hits table", async () => {
    expect(await columnsOf("hits")).toEqual([
      { name: "ip_hash", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
      { name: "created_at", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
    ]);
  });

  it("rejects a duplicate name_key and defaults hidden to 0", async () => {
    const insert = env.DB.prepare("INSERT INTO names (name, name_key, created_at) VALUES (?, ?, ?)");
    await insert.bind("Yukke", "yukke", "2026-10-26T00:00:00Z").run();

    await expect(insert.bind("ＹＵＫＫＥ", "yukke", "2026-10-26T00:01:00Z").run()).rejects.toThrow(
      /UNIQUE constraint failed: names\.name_key/,
    );
    expect(await env.DB.prepare("SELECT hidden FROM names").first("hidden")).toBe(0);
  });
});
