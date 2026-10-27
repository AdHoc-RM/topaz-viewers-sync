// SPEC 5章と同じ手順で n と c を作る
export function encode(name: string): { n: string; c: string } {
  let n = "";
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    const u = name.charCodeAt(i);
    n += u.toString(16).padStart(4, "0");
    sum = (sum + u) % 65536;
  }
  return { n, c: sum.toString(16).padStart(4, "0") };
}
