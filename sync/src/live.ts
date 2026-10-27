import type { Config } from "./config.ts";

// SPEC 6章
export type LiveJson = {
  live: number;
  live_ok: boolean;
  registered: number;
  users: User[];
  updated_at: string;
};

export type User = { name: string };

const TIMEOUT_MS = 10_000;

// SPEC 8章の手順1〜2。取得に失敗した値は公開中の live.json から引き継ぐ
export async function generateLive(
  config: Config,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<LiveJson> {
  const [live, users] = await Promise.all([
    fetchLiveCount(config.topazUrl, fetchFn),
    fetchUsers(config.exportUrl, config.exportToken, fetchFn),
  ]);
  const previous = live === null || users === null ? await fetchPublished(config.publishedUrl, fetchFn) : null;
  const resolvedUsers = users ?? previous?.users ?? [];

  return {
    live: live ?? previous?.live ?? 0,
    live_ok: live !== null,
    registered: resolvedUsers.length,
    users: resolvedUsers,
    updated_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

// 未配信なら0が返る。数字以外（ドメイン誤りのときのエラーの文字など）は失敗とみなす
async function fetchLiveCount(url: string, fetchFn: typeof fetch): Promise<number | null> {
  try {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = (await response.text()).trim();
    if (response.ok && /^[0-9]+$/.test(body) && Number.isSafeInteger(Number(body))) {
      return Number(body);
    }
    console.warn(`TopazChat returned an unexpected response (${response.status}): ${body.slice(0, 200)}`);
  } catch (error) {
    console.warn(`TopazChat request failed: ${String(error)}`);
  }
  return null;
}

async function fetchUsers(url: string, token: string, fetchFn: typeof fetch): Promise<User[] | null> {
  try {
    const response = await fetchFn(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`Export returned ${response.status}`);
      return null;
    }
    const users = parseUsers(property(await response.json(), "users"));
    if (users === null) {
      console.warn("Export returned an unexpected body");
    }
    return users;
  } catch (error) {
    console.warn(`Export request failed: ${String(error)}`);
    return null;
  }
}

// 初回は公開中の live.json がない（404）。それ以外の失敗で空の値を公開すると名前一覧が消えるため、例外にして公開を止める
async function fetchPublished(url: string, fetchFn: typeof fetch): Promise<Pick<LiveJson, "live" | "users"> | null> {
  const response = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Published live.json returned ${response.status}`);
  }
  const body: unknown = await response.json();
  const live = property(body, "live");
  const users = parseUsers(property(body, "users"));
  if (typeof live !== "number" || !Number.isSafeInteger(live) || live < 0 || users === null) {
    throw new Error("Published live.json has an unexpected body");
  }
  return { live, users };
}

function parseUsers(value: unknown): User[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const users: User[] = [];
  for (const item of value) {
    const name = property(item, "name");
    if (typeof name !== "string") {
      return null;
    }
    users.push({ name });
  }
  return users;
}

function property(value: unknown, key: string): unknown {
  // object であることは確かめてあり、存在しないキーは undefined として読むだけなので添字で引ける型に広げる
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}
