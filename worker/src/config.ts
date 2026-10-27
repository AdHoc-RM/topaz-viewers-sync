export type Config = {
  maxNameLength: number;
  rateLimitPerHour: number;
  ngWords: string[];
  exportToken: string;
  ipHashKey: string;
};

// 設定の誤りは登録を誤判定させるため、既定値で補わずに例外にする
export function loadConfig(env: Env): Config {
  return {
    maxNameLength: parsePositiveInteger("MAX_NAME_LENGTH", env.MAX_NAME_LENGTH),
    rateLimitPerHour: parsePositiveInteger("RATE_LIMIT_PER_HOUR", env.RATE_LIMIT_PER_HOUR),
    ngWords: parseStringArray("NG_WORDS", env.NG_WORDS),
    exportToken: parseNonEmptyString("EXPORT_TOKEN", env.EXPORT_TOKEN),
    ipHashKey: parseNonEmptyString("IP_HASH_KEY", env.IP_HASH_KEY),
  };
}

function parsePositiveInteger(key: string, value: string | undefined): number {
  if (value === undefined || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${key} must be a positive integer`);
  }
  return Number(value);
}

function parseStringArray(key: string, value: string | undefined): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value ?? "");
  } catch {
    throw new Error(`${key} must be a JSON array of strings`);
  }
  // 空文字は部分一致で必ず当たり、すべての名前を弾いてしまう
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string" && item !== "")) {
    throw new Error(`${key} must be a JSON array of non-empty strings`);
  }
  return parsed;
}

function parseNonEmptyString(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${key} must be set`);
  }
  return value;
}
