# ライブ視聴者数と入場者名の表示 仕様書

版: 第2版（2026-10-24）／作成: yukke／確認依頼先: Takaomiさん

TopazChatで配信している映像の**同時視聴者数**と、ワールドに入った人が登録した**名前の一覧（累計）**を、1つのデータにまとめてワールドに届ける仕組みです。インスタンスをまたいで同じ人数・同じ名前一覧が見えます。

この仕様書は、前半（1〜6章）が全員向けの説明、後半（7〜10章）がエンジニア向けの詳細です。11章に、まだ決まっていないことと確認したいことをまとめています。

---

## 1. できること・できないこと

| やりたいこと | 結果 | 補足 |
|---|---|---|
| 配信の同時視聴者数をワールドに出す | できる | TopazChatの同接数APIを使う。インスタンスをまたいだ合計人数になる |
| 入場者が登録した名前の累計をワールドに出す | できる | インスタンスをまたいで共有される |
| 見る人は設定なしで見られる | できる | データの置き場所（GitHub Pages）がVRChatの許可リストに入っているため |
| リアルタイムに反映する | しない | 反映まで数分〜15分ほどかかる（合意済み） |
| 退場した人を一覧から外す | しない | 累計の一覧なので、外さない（合意済み） |
| VRChatの表示名を自動で集める | できない | ワールドからは自由にURLを作って送れないため。本人に登録操作をしてもらう |
| 名前を登録する人が設定なしで登録できる | 現状できない | 名前の受け取り口がVRChatの許可リストに入っていないため。登録する人は「信頼されていないURLを許可」を有効にする必要がある（11章） |

## 2. 分担

| 担当 | 範囲 |
|---|---|
| Takaomiさん | ワールド全体。人数の演出（パーティクルなど）、名前登録の画面、データを読み込んでワールドに反映する部分 |
| yukke | TopazChatからの同接数の取得、名前の受け取り口と保存、両方をまとめたデータ（live.json）の公開 |

ワールド側の名前の変換ルール（5章）は、yukkeが参考のコードを用意します。

## 3. 全体の流れ

```
[入場者] 名前を登録 ──→ 名前の受け取り口（Cloudflare）──→ 名前を保存
                                                          │
[TopazChat] 同接数 ─────────┐                              │
                            ↓                              ↓
                 定期処理（GitHub Actions、5分ごと）: 両方を集めてまとめる
                            ↓
                 live.json を公開（GitHub Pages）
                            ↓
[ワールド] live.json を定期的に読み込み、人数と名前を表示
```

使うサービス（いずれも無料の範囲で使う）:

| サービス | このなかでの役割 |
|---|---|
| TopazChat 同接数API | 配信の同時視聴者数を返す |
| Cloudflare Workers | 名前の受け取り口。URLが読み込まれたら名前を受け取る小さなプログラム。Takaomiさんの既存のCloudflareアカウントに追加する |
| Cloudflare D1 | 受け取った名前を保存するデータベース |
| GitHub Actions | 5分ごとに動く定期処理。同接数と名前一覧を集めて、live.json を作る |
| GitHub Pages | live.json を置く場所。リポジトリ [AdHoc-RM/topaz-viewers-sync](https://github.com/AdHoc-RM/topaz-viewers-sync) から公開する。アドレスが `adhoc-rm.github.io` なのでVRChatの許可リストに入っている |

## 4. 名前の登録（入場者から見た流れ）

1. 名前の入力欄に、自分のVRChatの表示名が最初から入っている。必要なら書き換える。
2. 「決定」を押すと、名前を変換した**URLの形をした文字列**が表示される。
3. その文字列をコピーし、すぐ横の**URL入力欄**に貼り付ける。
4. ワールドがそのURLを読み込み、結果を表示する。

VRChatの制約で、ワールドが作った文字列をそのままURLとして読み込むことはできません。そのため、利用者自身にコピーして貼り付けてもらいます（参考にしたオンライン掲示板ギミックと同じ方式です）。

結果の表示（案）:

| 結果 | 表示する文言（案） |
|---|---|
| 登録できた（すでに登録済みの名前も含む） | 登録しました |
| URLが途中で切れている・書き換えられている | URLが正しくコピーされていません。もう一度コピーしてください |
| 名前が空、または長すぎる | 名前は1〜32文字で入力してください |
| NGワードに当たった | この名前は登録できません |
| 短時間に登録を繰り返した | しばらく時間をおいてから登録してください |
| 読み込み自体が失敗した | 設定の「信頼されていないURLを許可」を有効にしてください |

最後の行は、受け取り口が許可リストに入っていないために起きる失敗です。許可リストに登録できれば、この案内は不要になります。

## 5. 名前をURLに変換するルール

名前をURLにそのまま付けると、`#` より後ろが届かない、`&` で名前が分断される、日本語が文字化けする、といった問題が起きます。そこで、名前を**数字と英字（0〜9、a〜f）だけの形**に変換してから付けます。

ルール:

- `n`: 名前を1文字ずつ、4桁の16進数にして並べたもの（UTF-16の文字コード）
- `c`: 確認用の4桁。各文字の値を足して、65536で割った余りを4桁の16進数にしたもの
- URLの形: `https://（受け取り口）/r?n=（n の値）&c=（c の値）`

例:

| 名前 | 生成される部分 |
|---|---|
| ゆっけ | `n=308630633051&c=913a` |
| 名前#1 | `n=540d524d00230031&c=a6ae` |
| A&B | `n=004100260042&c=00a9` |
| hoge fuga | `n=0068006f0067006500200066007500670061&c=0366` |
| 🍣すし | `n=d83cdf6330593057&c=184f` |

- 上の例は、変換して元に戻すテストで、すべて元どおりに戻ることを確認済みです。
- コピーの途中で1文字欠けたり書き換えたりしたURLは、`c` が合わなくなるので「壊れている」と判定できます（テストで確認済み）。
- `c` はコピーミスを見つけるためのもので、なりすまし対策にはなりません。ワールドの中身は解析できるので、誰でも同じ形のURLを作れます。
- 名前の長さは最大32文字。変換後のURLは、32文字の名前で180文字程度になります。

ワールド側（UdonSharp）の参考コード（Unityでの動作確認はこれから）。受け取り口のURLを入れたものと、上の例の表と一致するかを確かめるスクリプトを、リポジトリの `udon/` に置いています:

```csharp
// 名前から登録用のURL文字列を作る。戻り値はURLの形をしたただの文字列
public string BuildRegisterText(string baseUrl, string name)
{
    string n = "";
    int sum = 0;
    for (int i = 0; i < name.Length; i++)
    {
        int u = name[i];
        n += u.ToString("x4");
        sum = (sum + u) % 65536;
    }
    return baseUrl + "?n=" + n + "&c=" + sum.ToString("x4");
}
```

## 6. ワールドが読むデータ（live.json）

置き場所: `https://adhoc-rm.github.io/topaz-viewers-sync/live.json`

```json
{
  "live": 400,
  "live_ok": true,
  "registered": 1234,
  "users": [
    { "name": "hogehoge" },
    { "name": "fugafuga" }
  ],
  "updated_at": "2026-10-22T12:00:00Z"
}
```

| 項目 | 意味 |
|---|---|
| live | 配信の同時視聴者数。未配信なら0 |
| live_ok | 同接数を取れたかどうか。取れなかったときは false にし、live は前回の値のまま |
| registered | 累計で名前を登録した人数（users の件数と同じ） |
| users | 登録された名前の一覧。登録の古い順。非表示にした名前は含めない |
| updated_at | このデータを作った日時（世界標準時） |

- 更新は5分ごと。GitHub Pagesは10分間のキャッシュを返すため、ワールドに反映されるまで**最大15分ほど**かかることがあります。
- `live`（今見ている人数）と `registered`（累計の登録人数）は別の数字です。
- ワールドからの読み込み間隔は、1分ごと程度を推奨します（VRChatの文字列の読み込みは5秒に1回までで、他の読み込みと枠を分け合うため）。

---

以下はエンジニア向けの詳細です。

## 7. 名前の受け取り口（Cloudflare Workers）

### 7.1 登録 `GET /r?n=...&c=...`

処理の順番:

1. `n` が4桁の16進数の繰り返し、`c` が4桁の16進数であることを確かめる。違えば `BROKEN`。
2. `n` の合計を65536で割った余りが `c` と一致するか確かめる。違えば `BROKEN`。
3. `n` をUTF-16として文字列に戻す。サロゲートペアが不完全なら `BROKEN`。
4. 整える: 前後の空白を削る、制御文字を除く。長さを数える（絵文字は1文字）。0文字または33文字以上なら `INVALID`。
5. NGワードに当たれば `NG`。
6. 同じ接続元からの登録が1時間に10回を超えていれば `LIMIT`。
7. 重複判定用の鍵を作る（NFKCで全角・半角を揃え、小文字にそろえる）。同じ鍵がすでにあれば何もせず `OK`。なければ保存して `OK`。

応答:

- HTTPのステータスは常に200で、本文に結果のコードを1語で返す（`OK` / `BROKEN` / `INVALID` / `NG` / `LIMIT`）。ワールド側は `OnStringLoadSuccess` で本文を見て文言を出し分ける。
- `OnStringLoadError` に来るのは、通信の失敗と許可リストによる遮断だけになる。

### 7.2 名前一覧の書き出し `GET /export`

- 定期処理（8章）だけが使う。`Authorization: Bearer （合言葉）` が一致しなければ403。
- 応答: `{"users":[{"name":"..."}], "count": N}`。登録の古い順。非表示の名前は含めない。

### 7.3 保存するデータ（D1）

```sql
CREATE TABLE names (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,          -- 表示用。入力されたまま
  name_key   TEXT NOT NULL UNIQUE,   -- 重複判定用。NFKC＋小文字
  created_at TEXT NOT NULL,          -- 最初に登録された日時
  hidden     INTEGER NOT NULL DEFAULT 0  -- 1 なら一覧に出さない
);

CREATE TABLE hits (
  ip_hash    TEXT NOT NULL,          -- 接続元を一方向に変換した値。元のIPは保存しない
  created_at TEXT NOT NULL
);
```

- `hits` は回数制限にだけ使い、1時間より古い行は消す。
- 保存する個人に関わる情報は、名前と登録日時だけ。

### 7.4 設定値

| 設定 | 既定値（案） |
|---|---|
| 名前の最大文字数 | 32 |
| 1時間あたりの登録回数の上限（接続元ごと） | 10 |
| NGワードの一覧 | 未定（11章） |
| 書き出し用の合言葉 | Workerのシークレットに保存。GitHub Actionsのシークレットにも同じ値を置く |

## 8. 定期処理（GitHub Actions）

5分ごとに次を行う。

1. TopazChatの同接数APIを1回呼ぶ。数字が返れば `live` に入れて `live_ok: true`。失敗、またはエラーの文字が返ったら、公開中の live.json の値を引き継いで `live_ok: false`。
2. Workerの `/export` から名前一覧を取る。失敗したら、公開中の live.json の名前一覧を引き継ぐ。
3. live.json を作り、GitHub Pagesに公開する。

- TopazChatへの問い合わせは5分に1回だけで、参加人数に関係なく一定です（TopazChat側の負荷が増えない）。
- GitHub Actionsの定期実行は、混雑時に数分〜十数分遅れることがあります。遅れが問題になったら、Cloudflare側の定期実行に切り替えます。
- TopazChatのURL（ストリームキー、専用サーバーかどうか）は、コードを変えずに設定で変えられるようにします。

TopazChat同接数APIの仕様（TopazChat側からの連絡による）:

- 通常: `https://api.topaz.chat/api/v1/connections/live/（ストリームキー）`
- 専用サーバー: `https://api.topaz.chat/api/v1/connections/（サーバーのドメイン）/live/（ストリームキー）`
- プレーンテキストで同時接続数を返す。未配信なら0。ドメインが誤っていればエラーの文字を返す。
- 同じストリームの値はサーバー側で4秒程度キャッシュされる。同じIPからは毎秒600回まで。

## 9. 管理と運用

- **不適切な名前の非表示**: 該当する名前の `hidden` を1にする。次の定期処理で一覧から消える。当面はyukkeがCloudflareの管理画面から操作し、Takaomiさんから依頼を受ける形にする。
- **NGワード**: 登録時に弾く一覧。一覧の用意の担当は未定（11章）。
- **Cloudflareの無料枠**: Takaomiさんの既存アカウントと共有する。リクエストは1日10万回まで（アカウント全体）で、超えるとアカウント内のWorkerがその日はすべてエラーになる。今回の使い方（名前の登録と、5分に1回の書き出し）では届かない見込み。受け取り口を大量に叩かれた場合に影響が出るおそれがある。
- **GitHub**: リポジトリは [AdHoc-RM/topaz-viewers-sync](https://github.com/AdHoc-RM/topaz-viewers-sync)（公開、Takaomiさんの個人アカウント）。yukkeは書き込み権限で参加。

## 10. 制約の根拠

| 制約 | 根拠 |
|---|---|
| 文字列の読み込みは5秒に1回まで。超えた分は順番待ち | [VRChat: String Loading](https://creators.vrchat.com/worlds/udon/string-loading/) |
| 許可リスト外のURLは「信頼されていないURLを許可」が必要。URL入力欄に入力したURLも同じ | [VRChat: External URLs](https://creators.vrchat.com/worlds/udon/external-urls/) |
| 許可リストに入っているドメイン: `*.github.io`、`gist.githubusercontent.com`、`pastebin.com`、`*.vrcdn.cloud`、`*.disbridge.com` | [VRChat: String Loading](https://creators.vrchat.com/worlds/udon/string-loading/) |
| GitHub Pagesの公開回数の目安（1時間10回）は、GitHub Actionsで公開すればかからない | [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| GitHub Pagesは `max-age=600`（10分）のキャッシュを返す | 実際の応答で確認（2026-10-18） |
| Cloudflare Workers無料枠: 1日10万回（アカウント全体）、定期実行5個まで | [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Cloudflare D1無料枠: データベース10個まで、合計5GB | [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |

## 11. 決まっていないこと・確認したいこと

確認中:

- [ ] ワールドの対象端末（PCだけか、Quest・スマートフォンも含むか）。含む場合、Quest・スマートフォンで名前のコピー＆ペーストができるかを確かめる必要がある
- [ ] Takaomiさんにリポジトリの設定を2つ、一度だけしてもらう（個人アカウントのリポジトリは、所有者しか設定画面を触れないため）: Settings → Pages の公開方法（Source）を「GitHub Actions」にする、Settings → Secrets and variables → Actions に合言葉（`EXPORT_TOKEN`、値はyukkeから渡す）を登録する。リポジトリはすでに公開になっている
- [ ] TopazChatに、VRChatの許可リストへの登録方法を確認する。同じ方法で受け取り口を登録できれば、名前を登録する人の設定が不要になる

Takaomiさんに決めてほしいこと:

- [ ] 4章の結果の文言（案のままでよいか）
- [ ] 名前の最大文字数（案: 32文字）
- [ ] NGワードの一覧を誰が用意するか
- [ ] 名前一覧の並び順（案: 登録の古い順）

## 12. 実機で確かめること

- [ ] ワールドが `adhoc-rm.github.io` の live.json を、「信頼されていないURLを許可」なしで読めるか
- [ ] TopazChatの同接数APIが、配信中・未配信で想定どおりの値を返すか
- [ ] 5章の参考コードが、UdonSharpで同じ結果を出すか（例の表と一致するか）
- [ ] 名前に日本語・空白・記号・絵文字を入れても、登録から表示まで崩れないか
- [ ] live.json を更新してから、ワールドに反映されるまでの実際の時間
