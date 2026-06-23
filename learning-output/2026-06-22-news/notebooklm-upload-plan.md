# NotebookLM Upload Plan - Daily News Digest 2026-06-22

## 連携方式

PlaywrightによるNotebookLM Web UI自動化を使う。

## ノート名

Daily News 2026-06-22

## 投入対象ファイル

- `00_overview.md`
- `01_bbc.md`
- `02_aljazeera.md`
- `03_sources.md`

## URLソース追加対象

`sources.md` に記載されたBBC NewsとAl Jazeeraの記事URL。

## 実行コマンド

```bash
node scripts/notebooklm_web_upload.mjs --output-dir learning-output/2026-06-22-news --notebook-title "Daily News 2026-06-22" --files 00_overview.md,01_bbc.md,02_aljazeera.md,03_sources.md --source-url-file sources.md --browser-channel chrome --auto-continue true
```

## Playwrightプロファイル方針（ニュース運用）

- 既定では安定実績のある `.notebooklm-playwright-profile` を使用する（`--user-data-dir` を指定しない）。
- 新規プロファイルでログイン拒否が出やすいため、ニュース運用では原則として新しいプロファイルを作らない。
- 別プロファイルを使う場合のみ、`--user-data-dir <path>` を明示する。

例（既定の安定プロファイルを明示したい場合）:

```bash
node scripts/notebooklm_web_upload.mjs --output-dir learning-output/2026-06-22-news --notebook-title "Daily News 2026-06-22" --files 00_overview.md,01_bbc.md,02_aljazeera.md,03_sources.md --source-url-file sources.md --browser-channel chrome --auto-continue true --user-data-dir .notebooklm-playwright-profile
```

## 期待される完了条件

- NotebookLMで新規ノートが作成される。
- Markdownファイルがソースとしてアップロードされる。
- `sources.md` の記事URLがURLソースとして追加される。
- 実行結果が `notebooklm-upload-result.md` に記録される。

## 手動フォールバック

自動化がログイン、2要素認証、UI変更、ブラウザ制約で止まる場合は、NotebookLMを手動で開き、投入対象ファイルをアップロードする。その後、`sources.md` のURLをNotebookLMのウェブサイトソースとして追加し、`notebooklm-prompt.md` をチャットに貼り付ける。

Googleで `Couldn't sign you in` / `This browser or app may not be secure` が出た場合の最短復旧:

1. 通常のChromeまたはEdgeで `https://notebooklm.google.com/` を開く。
2. `.notebooklm-playwright-profile` でログインできる状態を作る。
3. 同じ実行コマンドを再実行する。
4. 再実行でも拒否される場合は、`notebooklm-upload-result.md` の「投入対象ファイル」「URLソース追加対象」を手動で投入する。
