# worker

名前の受け取り口となる Cloudflare Worker と、名前を保存する D1 のスキーマです。仕様は `../docs/SPEC.md` の7章を参照してください。

## ローカルでの起動

```sh
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

## 設定値（SPEC 7.4）

| 名前 | 内容 | 置き場所 |
|---|---|---|
| `MAX_NAME_LENGTH` | 名前の最大文字数 | `wrangler.jsonc` の `vars` |
| `RATE_LIMIT_PER_HOUR` | 接続元ごとの1時間あたりの登録回数の上限 | `wrangler.jsonc` の `vars` |
| `NG_WORDS` | NGワードの一覧（JSONの文字列配列。例: `["foo","bar"]`） | ローカルは `.dev.vars`、本番は `wrangler secret put NG_WORDS` |
| `EXPORT_TOKEN` | 書き出し用の合言葉 | ローカルは `.dev.vars`、本番は `wrangler secret put EXPORT_TOKEN` |

NGワードと合言葉は、リポジトリが公開のためシークレットで渡します。いずれもコードを変えずに値を差し替えられます。ローカルでは `npm run dev -- --var MAX_NAME_LENGTH:20` のように一時的に上書きすることもできます。値が不正な場合は既定値で補わず、エラーになります。

`wrangler.jsonc` を変えたら `npm run cf-typegen` で型（`worker-configuration.d.ts`）を作り直してください。

## マイグレーション

`migrations/` に置き、`npm run db:migrate:local`（ローカル）または `npm run db:migrate:remote`（本番）で適用します。

## 検証

```sh
npm test
npm run typecheck
```
