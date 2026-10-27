export type Config = {
  topazUrl: string;
  exportUrl: string;
  exportToken: string;
  publishedUrl: string;
};

// 設定の誤りは誤った live.json を公開させるため、既定値で補わずに例外にする
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return {
    topazUrl: buildTopazUrl(required(env, "TOPAZ_STREAM_KEY"), env.TOPAZ_SERVER_DOMAIN),
    exportUrl: required(env, "EXPORT_URL"),
    exportToken: required(env, "EXPORT_TOKEN"),
    publishedUrl: required(env, "PUBLISHED_URL"),
  };
}

// SPEC 8章。専用サーバーのときだけドメインが入る
function buildTopazUrl(streamKey: string, serverDomain: string | undefined): string {
  const base = "https://api.topaz.chat/api/v1/connections";
  const server = serverDomain ? `/${encodeURIComponent(serverDomain)}` : "";
  return `${base}${server}/live/${encodeURIComponent(streamKey)}`;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} must be set`);
  }
  return value;
}
