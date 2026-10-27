import { loadConfig } from "./config";

// SPEC 7.2
export async function handleExport(request: Request, env: Env): Promise<Response> {
  const { exportToken } = loadConfig(env);
  if (!(await isAuthorized(request.headers.get("Authorization"), exportToken))) {
    return new Response("Forbidden", { status: 403 });
  }

  const { results } = await env.DB.prepare(
    "SELECT name FROM names WHERE hidden = 0 ORDER BY created_at, id",
  ).all<{ name: string }>();

  return Response.json(
    { users: results.map(({ name }) => ({ name })), count: results.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function isAuthorized(header: string | null, token: string): Promise<boolean> {
  const prefix = "Bearer ";
  if (header === null || !header.startsWith(prefix)) {
    return false;
  }
  // 比較にかかる時間から合言葉を推測されないよう、長さをそろえるためにハッシュしてから定数時間で比べる
  const [actual, expected] = await Promise.all([sha256(header.slice(prefix.length)), sha256(token)]);
  return crypto.subtle.timingSafeEqual(actual, expected);
}

function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}
