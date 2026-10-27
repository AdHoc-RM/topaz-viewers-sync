# sync

TopazChatの同接数とWorkerの名前一覧から `live.json` を作る処理です。GitHub Actionsの定期処理から実行します。仕様は `../docs/SPEC.md` の6章と8章を参照してください。

## 実行

Node.js 24以上で、TypeScriptをそのまま実行します。

```sh
npm install
TOPAZ_STREAM_KEY=... EXPORT_URL=... EXPORT_TOKEN=... PUBLISHED_URL=... npm run generate -- dist/live.json
```

## 設定値

いずれも環境変数で渡し、コードを変えずに差し替えられます。`TOPAZ_SERVER_DOMAIN` 以外は必須で、未設定ならエラーになります。

| 名前 | 内容 |
|---|---|
| `TOPAZ_STREAM_KEY` | TopazChatのストリームキー |
| `TOPAZ_SERVER_DOMAIN` | 専用サーバーのドメイン。空なら通常のサーバーを使う |
| `EXPORT_URL` | Workerの書き出しのURL（`https://.../export`） |
| `EXPORT_TOKEN` | 書き出し用の合言葉。Workerと同じ値 |
| `PUBLISHED_URL` | 公開中の `live.json` のURL。取得に失敗した値の引き継ぎ元 |

## 定期実行

`.github/workflows/publish-live.yml` が5分ごと（と手動実行）に `live.json` を作り、GitHub Pagesに公開します。設定値は次の場所に置きます。

| 名前 | 置き場所 |
|---|---|
| `TOPAZ_STREAM_KEY` | リポジトリの変数（Settings → Secrets and variables → Actions → Variables） |
| `TOPAZ_SERVER_DOMAIN` | リポジトリの変数。通常のサーバーなら登録しない |
| `EXPORT_URL` | リポジトリの変数 |
| `EXPORT_TOKEN` | リポジトリのシークレット |
| `PUBLISHED_URL` | ワークフローに直接記載 |

生成が失敗したときは公開しないため、前回の `live.json` がそのまま残ります。

## 失敗したとき

- TopazChatから数字が返らなければ、公開中の `live.json` の `live` を引き継ぎ、`live_ok` を `false` にする
- 書き出しに失敗したら、公開中の `live.json` の名前一覧を引き継ぐ
- 公開中の `live.json` がない（404）初回は、`live` を0、名前一覧を空にする
- 引き継ぎが必要なのに公開中の `live.json` を読めなければ、名前一覧を空で上書きしないよう、エラーで終了して公開を止める

## 検証

```sh
npm test
npm run typecheck
```
