export type Config = {
  maxNameLength: number;
  rateLimitPerHour: number;
  ngWords: string[];
  exportToken: string;
};

// 設定の誤りは登録を誤判定させるため、既定値で補わずに例外にする
export function loadConfig(env: Env): Config {
  return {
    maxNameLength: parsePositiveInteger("MAX_NAME_LENGTH", env.MAX_NAME_LENGTH),
    rateLimitPerHour: parsePositiveInteger("RATE_LIMIT_PER_HOUR", env.RATE_LIMIT_PER_HOUR),
    ngWords: parseStringArray("NG_WORDS", env.NG_WORDS),
    exportToken: parseNonEmptyString("EXPORT_TOKEN", env.EXPORT_TOKEN),
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
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error(`${key} must be a JSON array of strings`);
  }
  return parsed;
}

function parseNonEmptyString(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${key} must be set`);
  }
  return value;
}
