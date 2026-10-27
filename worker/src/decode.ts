export type DecodeResult = { status: "OK"; name: string } | { status: "BROKEN" } | { status: "INVALID" };

// 空の n は名前が空のときに作られるため、BROKEN ではなく INVALID として扱えるよう0回の繰り返しも許す
const N_PATTERN = /^(?:[0-9a-f]{4})*$/i;
const C_PATTERN = /^[0-9a-f]{4}$/i;

// SPEC 7.1 の手順1〜4
export function decodeName(n: string | null, c: string | null, maxNameLength: number): DecodeResult {
  if (n === null || c === null || !N_PATTERN.test(n) || !C_PATTERN.test(c)) {
    return { status: "BROKEN" };
  }

  const codeUnits = n.match(/.{4}/g)?.map((hex) => parseInt(hex, 16)) ?? [];
  const sum = codeUnits.reduce((total, unit) => (total + unit) % 65536, 0);
  if (sum !== parseInt(c, 16)) {
    return { status: "BROKEN" };
  }

  // n の長さは送り手次第のため、引数の数に上限があるスプレッドは使わない
  const decoded = codeUnits.map((unit) => String.fromCharCode(unit)).join("");
  if (!decoded.isWellFormed()) {
    return { status: "BROKEN" };
  }

  // 制御文字を先に除く。後に回すと、制御文字の内側にあった空白が端に残る
  const name = decoded.replace(/\p{Cc}/gu, "").trim();
  // コードポイントで数え、サロゲートペアの絵文字を1文字にする
  const length = [...name].length;
  if (length === 0 || length > maxNameLength) {
    return { status: "INVALID" };
  }

  return { status: "OK", name };
}
