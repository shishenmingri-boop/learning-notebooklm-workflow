# NotebookLM アップロード計画

## 連携方式
PlaywrightによるWeb UI自動化

## ノート名
宅建 試験合格パッケージ

## 使用するPlaywrightプロファイル
`C:\Users\K-OGAWA\Projects\learning-notebooklm-workflow\.notebooklm-playwright-profile`

## ブラウザチャンネル
chrome

## 投入対象ファイル

| ファイル名 | 内容 |
|---|---|
| `00_overview.md` | 試験全体像・科目構成・学習ガイド |
| `01_core_concepts.md` | 重要用語・概念辞典 |
| `02_deep_dive.md` | 深掘り解説・引っかけ対策 |
| `03_sources.md` | 情報源一覧・法令URL |
| `04_quiz_seed.md` | クイズ生成用素材集 |

## URLソース追加対象

| URL | 内容 |
|---|---|
| https://www.retio.or.jp/exam/ | RETIO 宅建試験公式 |
| https://www.retio.or.jp/exam/schedule/ | 試験スケジュール |
| https://laws.e-gov.go.jp/law/327AC1000000176 | 宅地建物取引業法（全文）|
| https://laws.e-gov.go.jp/law/129AC0000000089 | 民法（全文）|
| https://laws.e-gov.go.jp/law/343AC0000000100 | 都市計画法（全文）|
| https://laws.e-gov.go.jp/law/325AC0000000201 | 建築基準法（全文）|
| https://laws.e-gov.go.jp/law/403AC0000000090 | 借地借家法（全文）|
| https://takken-siken.com/ | 宅建試験ドットコム（過去問道場）|
| https://moalicense.jp/takken/gaiyou_sokuhou.htm | 合格点・合格率の推移 |

## 実行コマンド

```bash
node scripts/notebooklm_web_upload.mjs --output-dir "learning-output/2026-06-22-宅建" --notebook-title "宅建 試験合格パッケージ" --browser-channel chrome
```

## 期待される完了条件
- NotebookLMに「宅建 試験合格パッケージ」ノートが作成される
- 5つのMarkdownファイルがソースとして追加される
- 9件のURLソースが追加される

## 自動化失敗時の手動フォールバック
1. https://notebooklm.google.com/ をブラウザで開く
2. 「新規作成」でノートを作成、タイトルを「宅建 試験合格パッケージ」にする
3. 「ファイルをアップロード」から上記5ファイルをアップロードする
4. 「ソースを追加」→「ウェブサイト」から上記9件のURLを追加する
5. `notebooklm-prompt.md` の内容をNotebookLMのチャットに貼り付けて学習開始
