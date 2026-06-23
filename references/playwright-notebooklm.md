# NotebookLM Playwright自動化

このワークフローは、NotebookLM Enterprise APIを利用できない個人用Googleアカウント向けです。

## 自動化の範囲

Playwrightの処理では次を標準経路として実行します。

1. `https://notebooklm.google.com/` を開く。
2. 分離された永続ブラウザプロファイルを使う。
3. 通常のGoogle ChromeまたはMicrosoft Edgeを使う。
4. 必要な場合、ユーザーにGoogleログインを完了してもらう。
5. `新規作成` ボタンを押して新しいノートを作成する。
6. 可能な場合、ノート名を設定または確認する。
7. `ファイルをアップロード` を押し、生成済みMarkdownソースファイルをアップロードする。
8. `sources.md` に集約されたURLを抽出し、NotebookLMのURL/ウェブサイトソースとして追加する。
9. 生成されたNotebookLM URLとステータスを `notebooklm-upload-result.md` に保存する。

ユーザーのGoogleパスワードを尋ねてはいけません。

## Googleログイン時のブラウザ制約

Playwright同梱ChromiumはGoogleログインで次のエラーにより拒否されることがあります。

```text
Couldn't sign you in
This browser or app may not be secure.
```

このため、スクリプトはPlaywright同梱Chromiumを標準経路として使いません。既定では通常のGoogle Chrome、次にMicrosoft Edgeの起動を試します。どちらも利用できない場合は自動化を止め、`notebooklm-upload-result.md` に原因と手動フォールバック手順を書きます。

日次ニュース運用では、ログイン再利用の安定性を優先して同じ `--user-data-dir` を継続利用してください。特に理由がなければ既定の `.notebooklm-playwright-profile` を使い、毎回新規プロファイルを作らない方針を推奨します。

通常ブラウザを指定する例:

```bash
node skills/learning-notebooklm-workflow/scripts/notebooklm_web_upload.mjs \
  --output-dir learning-output \
  --notebook-title "OAuth 2.0 実務学習" \
  --browser-channel chrome
```

Chrome/Edgeの実行ファイルを直接指定する例:

```bash
node skills/learning-notebooklm-workflow/scripts/notebooklm_web_upload.mjs \
  --output-dir learning-output \
  --notebook-title "OAuth 2.0 実務学習" \
  --executable-path /path/to/google-chrome
```

検証目的でPlaywright同梱Chromiumを使う場合のみ、次のように明示します。ただしGoogleログインに失敗する可能性が高いため、既にログイン済みのプロファイルでの動作確認などに限定します。

```bash
node skills/learning-notebooklm-workflow/scripts/notebooklm_web_upload.mjs \
  --output-dir learning-output \
  --notebook-title "OAuth 2.0 実務学習" \
  --browser-channel chromium \
  --allow-bundled-chromium true
```

## 想定される壊れやすさ

NotebookLMはWebサービスであり、ラベル、セレクタ、操作フローが変わる可能性があります。自動化スクリプトでは、必要な場合のみ人が介入するチェックポイントへフォールバックできるようにします。

- ログインのチェックポイント
- Googleログイン拒否の検出
- `新規作成` ボタンのSPA描画待ち、検出、またはノート作成のチェックポイント
- `ファイルをアップロード` ボタン検出またはファイルアップロードのチェックポイント
- URL/ウェブサイトソース追加のチェックポイント

NotebookLMはSPAのため、`domcontentloaded` 直後には `新規作成` ボタンがまだ描画されていない場合があります。スクリプトは `新規作成` / `ノートブックを新規作成` / `.create-new-button` / `.create-new-action-button` などの候補を最大30秒待ってからクリックします。検出できない場合は候補ごとの検出数を `notebooklm-upload-result.md` の診断情報へ記録します。

URLソース追加は、既定で出力ディレクトリ内の `sources.md` からURLを抽出して実行します。直接URLを指定する場合は `--source-urls`、URL一覧元ファイルを変更する場合は `--source-url-file`、URL追加を無効化する場合は `--skip-source-urls true` を使います。

フォールバックは自動化が完了できない場合の最終手段です。フォールバックしても、生成済みファイルはNotebookLM投入用としてそのまま利用できます。

## セットアップ

リポジトリまたは作業用ワークスペースで次を実行します。

```bash
npm install -D playwright
npx playwright install chrome
```

スクリプト:

```text
scripts/notebooklm_web_upload.mjs
```

例:

```bash
node skills/learning-notebooklm-workflow/scripts/notebooklm_web_upload.mjs \
  --output-dir learning-output \
  --notebook-title "OAuth 2.0 実務学習" \
  --browser-channel chrome
```

## アップロード対象ファイル

デフォルトファイル:

- `00_overview.md`
- `01_core_concepts.md`
- `02_deep_dive.md`
- `03_sources.md`
- `04_quiz_seed.md`

URLソース:

- 既定では `sources.md` 内の全URL
- `--source-urls` が指定された場合は、そのURL一覧
- `--skip-source-urls true` が指定された場合は追加しない

任意の補助ファイルはパッケージ内に残してよいですが、有用な場合を除きアップロード対象にはしません。

- `learning-input.md`
- `research-plan.md`
- `sources.md`
- `quality-harness-result.md`
- `notebooklm-prompt.md`
- `README.md`

## 成功条件

次を満たす場合、自動化は成功です。

- NotebookLMノートページが開いている
- 現在のURLが記録されている
- ソースファイルがファイル入力に送信された、またはユーザーがアップロード完了を確認した
- `sources.md` のURLがURL/ウェブサイトソースとして追加された、またはユーザーが追加完了を確認した
- `notebooklm-upload-result.md` にステータスが記録されている

## 失敗時の扱い

自動化に失敗した場合:

- 実用上可能な範囲で、ユーザーが確認できるようブラウザ状態を十分な時間開いたままにする
- `notebooklm-upload-result.md` を書く
- Googleログイン拒否または通常Chrome/Edge未導入が原因の場合は、その理由を明記する
- 手動アップロードすべき正確なファイルを含める
- 手動追加すべき正確なURLを含める
- ノートが作成された場合はNotebookLM URLを含める
