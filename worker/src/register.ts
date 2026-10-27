import { loadConfig } from "./config";
import { decodeName } from "./decode";

type RegisterResult = "OK" | "BROKEN" | "INVALID" | "NG" | "LIMIT";

const HOUR_MS = 60 * 60 * 1000;

// SPEC 7.1
export async function handleRegister(request: Request, env: Env): Promise<Response> {
  return new Response(await register(request, env), { headers: { "Cache-Control": "no-store" } });
}

async function register(request: Request, env: Env): Promise<RegisterResult> {
  const { maxNameLength, rateLimitPerHour, ngWords, ipHashKey } = loadConfig(env);
  const { searchParams } = new URL(request.url);

  const decoded = decodeName(searchParams.get("n"), searchParams.get("c"), maxNameLength);
  if (decoded.status !== "OK") {
    return decoded.status;
  }

  const nameKey = toNameKey(decoded.name);
  if (ngWords.some((word) => nameKey.includes(toNameKey(word)))) {
    return "NG";
  }

  // Cloudflare 経由の要求には必ず付くため、欠けるのはローカルでの直接の呼び出しだけ
  const ipHash = await hashIp(request.headers.get("CF-Connecting-IP") ?? "", ipHashKey);
  const now = new Date();
  const createdAt = now.toISOString();
  await env.DB.prepare("DELETE FROM hits WHERE created_at < ?")
    .bind(new Date(now.getTime() - HOUR_MS).toISOString())
    .run();
  // 数えてから記録するまでの間に同じ接続元の要求が割り込まないよう、1つの文で行う
  const hit = await env.DB.prepare(
    "INSERT INTO hits (ip_hash, created_at) SELECT ?1, ?2 WHERE (SELECT COUNT(*) FROM hits WHERE ip_hash = ?1) < ?3",
  )
    .bind(ipHash, createdAt, rateLimitPerHour)
    .run();
  if (hit.meta.changes === 0) {
    return "LIMIT";
  }

  await env.DB.prepare(
    "INSERT INTO names (name, name_key, created_at) VALUES (?, ?, ?) ON CONFLICT (name_key) DO NOTHING",
  )
    .bind(decoded.name, nameKey, createdAt)
    .run();
  return "OK";
}

// 全角・半角と大文字・小文字の違いをそろえる
function toNameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase();
}

// IPv4 は総当たりで戻せるため、ただのハッシュではなく秘密の鍵を使う
async function hashIp(ip: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(ip));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
