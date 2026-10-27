# udon

ワールド側（UdonSharp）で名前を登録用のURL文字列に変換する参考コードです。仕様は `../docs/SPEC.md` の4章・5章を参照してください。

| ファイル | 内容 |
|---|---|
| `RegisterUrlBuilder.cs` | 名前から登録用のURL文字列を作る `BuildRegisterText`。受け取り口のURLは `RegisterUrl` に入っています |
| `RegisterUrlBuilderCheck.cs` | 5章の例の表と同じ文字列が作られるかを確かめるためのスクリプト |

## 使い方

1. 2つの `.cs` をUnityプロジェクトの `Assets` 以下に置き、それぞれUdonSharp Program Assetを作ります。
2. 名前登録の画面で、入力欄の名前を `BuildRegisterText` に渡し、戻り値を利用者がコピーできる欄に表示します。
3. 利用者が貼り付けたURLを `VRCStringDownloader.LoadUrl` で読み込み、`OnStringLoadSuccess` の本文（`OK` / `BROKEN` / `INVALID` / `NG` / `LIMIT`）に応じて文言を出し分けます（SPEC 4章・7.1）。

## 動作の確認

1. 空のGameObjectに `RegisterUrlBuilder` と `RegisterUrlBuilderCheck` を付け、`RegisterUrlBuilderCheck` の `builder` に `RegisterUrlBuilder` を指定します。
2. Playし、Consoleに `[RegisterUrlBuilderCheck] all 5 cases passed` が出れば、5章の例と一致しています。`NG` の行には実際の値と期待値が出ます。
