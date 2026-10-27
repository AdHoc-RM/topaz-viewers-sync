import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// セットアップは複数回走ることがあるが、適用済みのマイグレーションは飛ばされる
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
