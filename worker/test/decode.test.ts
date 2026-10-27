import { describe, expect, it } from "vitest";
import { decodeName } from "../src/decode";

const MAX = 32;

// SPEC 5章と同じ手順で n と c を作る
function encode(name: string): { n: string; c: string } {
  let n = "";
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    const u = name.charCodeAt(i);
    n += u.toString(16).padStart(4, "0");
    sum = (sum + u) % 65536;
  }
  return { n, c: sum.toString(16).padStart(4, "0") };
}

describe("decodeName", () => {
  it.each([
    ["ゆっけ", "308630633051", "913a"],
    ["名前#1", "540d524d00230031", "a6ae"],
    ["A&B", "004100260042", "00a9"],
    ["hoge fuga", "0068006f0067006500200066007500670061", "0366"],
    ["🍣すし", "d83cdf6330593057", "184f"],
  ])("restores %j from the SPEC 5 example", (name, n, c) => {
    expect(decodeName(n, c, MAX)).toEqual({ status: "OK", name });
  });

  it("accepts uppercase hex digits", () => {
    expect(decodeName("308630633051".toUpperCase(), "913A", MAX)).toEqual({ status: "OK", name: "ゆっけ" });
  });

  describe("returns BROKEN", () => {
    const { n, c } = encode("ゆっけ");

    it.each([
      ["n is missing", null, c],
      ["c is missing", n, null],
      ["n lost its last character", n.slice(0, -1), c],
      ["n lost a middle character", n.slice(0, 5) + n.slice(6), c],
      ["the URL lost its last character", n, c.slice(0, -1)],
      ["n lost a whole code unit", n.slice(4), c],
      ["n has a non-hex character", n.slice(0, -1) + "g", c],
      ["c is too long", n, c + "0"],
      ["n has spaces", ` ${n}`, c],
    ])("when %s", (_, brokenN, brokenC) => {
      expect(decodeName(brokenN, brokenC, MAX)).toEqual({ status: "BROKEN" });
    });

    it("when a digit of n is rewritten", () => {
      expect(decodeName("308630633052", c, MAX)).toEqual({ status: "BROKEN" });
    });

    it("when c is rewritten", () => {
      expect(decodeName(n, "913b", MAX)).toEqual({ status: "BROKEN" });
    });

    it.each([
      ["a lone high surrogate", "\ud83c"],
      ["a lone low surrogate", "\udf63"],
      ["a high surrogate followed by a normal character", "\ud83cす"],
      ["surrogates in reverse order", "\udf63\ud83c"],
    ])("when the name has %s", (_, name) => {
      const encoded = encode(name);
      expect(decodeName(encoded.n, encoded.c, MAX)).toEqual({ status: "BROKEN" });
    });
  });

  describe("cleans up the name", () => {
    it.each([
      ["leading and trailing spaces", "  ゆっけ 　", "ゆっけ"],
      ["control characters", "ゆ\u0000っ\u001fけ\u007f", "ゆっけ"],
      ["control characters next to spaces", "\u0001 ゆっけ \u0002", "ゆっけ"],
      ["inner spaces", "hoge fuga", "hoge fuga"],
    ])("removes %s", (_, name, expected) => {
      const { n, c } = encode(name);
      expect(decodeName(n, c, MAX)).toEqual({ status: "OK", name: expected });
    });
  });

  describe("checks the length", () => {
    it.each([
      ["an empty name", ""],
      ["only spaces", "   "],
      ["only control characters", "\u0000\u0001"],
    ])("returns INVALID for %s", (_, name) => {
      const { n, c } = encode(name);
      expect(decodeName(n, c, MAX)).toEqual({ status: "INVALID" });
    });

    it("accepts a name of the maximum length", () => {
      const name = "あ".repeat(MAX);
      const { n, c } = encode(name);
      expect(decodeName(n, c, MAX)).toEqual({ status: "OK", name });
    });

    it("returns INVALID for a name longer than the maximum", () => {
      const { n, c } = encode("あ".repeat(MAX + 1));
      expect(decodeName(n, c, MAX)).toEqual({ status: "INVALID" });
    });

    it("counts an emoji as one character", () => {
      const name = "🍣".repeat(MAX);
      const { n, c } = encode(name);
      expect(decodeName(n, c, MAX)).toEqual({ status: "OK", name });
      const tooLong = encode("🍣".repeat(MAX + 1));
      expect(decodeName(tooLong.n, tooLong.c, MAX)).toEqual({ status: "INVALID" });
    });

    it("does not count trimmed spaces", () => {
      const name = "あ".repeat(MAX);
      const { n, c } = encode(`  ${name}  `);
      expect(decodeName(n, c, MAX)).toEqual({ status: "OK", name });
    });
  });
});
