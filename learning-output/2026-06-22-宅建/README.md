# 宅建 試験合格パッケージ

## 目的
宅地建物取引士（宅建士）試験（令和8年度 / 2026年10月18日）の合格を目指すNotebookLM学習パッケージ。

## パッケージ構成

| ファイル | 内容 |
|---|---|
| `00_overview.md` | 試験概要・4科目の学習ガイド・推奨学習順序 |
| `01_core_concepts.md` | 重要用語辞典（宅建業法・民法・法令制限・税）|
| `02_deep_dive.md` | 深掘り解説・媒介契約比較・報酬計算・引っかけ対策 |
| `03_sources.md` | 情報源一覧・公式URLリスト |
| `04_quiz_seed.md` | クイズ素材（数字問題・正誤・比較・シナリオ）|
| `notebooklm-prompt.md` | NotebookLMに貼り付けるプロンプト |

## NotebookLMへの投入

### 自動投入コマンド

```powershell
# プロジェクトルートで実行
node scripts/notebooklm_web_upload.mjs --output-dir "learning-output/2026-06-22-宅建" --notebook-title "宅建 試験合格パッケージ" --browser-channel chrome
```

### 手動投入手順

1. https://notebooklm.google.com/ を開く
2. 「新規作成」→ ノート名「宅建 試験合格パッケージ」
3. 「ファイルをアップロード」→ `00_overview.md` 〜 `04_quiz_seed.md` の5ファイル
4. 「ウェブサイト」ソースとして以下を追加:
   - https://www.retio.or.jp/exam/
   - https://laws.e-gov.go.jp/law/327AC1000000176（宅建業法）
   - https://laws.e-gov.go.jp/law/129AC0000000089（民法）
   - https://laws.e-gov.go.jp/law/343AC0000000100（都市計画法）
   - https://laws.e-gov.go.jp/law/325AC0000000201（建築基準法）
   - https://laws.e-gov.go.jp/law/403AC0000000090（借地借家法）
   - https://takken-siken.com/

## 学習の進め方

### 1. NotebookLMプロンプトを貼り付ける
`notebooklm-prompt.md` の内容をNotebookLMのチャット欄に貼り付ける。

### 2. 学習ロードマップを取得する
まずロードマップを生成してもらい、全体像を把握する。

### 3. 科目別に深める
以下の順で学習を進める（重要度順）：
1. 宅建業法（20問・最重要）
2. 権利関係（14問）
3. 法令上の制限（8問）
4. 税・その他（8問）

### 4. クイズで理解度確認
NotebookLMにクイズを生成してもらい、弱点を発見する。

### 5. 過去問演習
https://takken-siken.com/ で過去問を年度別・科目別に演習する。

## 試験情報（令和8年度）

| 項目 | 内容 |
|---|---|
| 試験日 | 2026年10月18日（日）13:00〜15:00 |
| 申込期間 | 2026年7月1日〜7月31日 |
| 受験料 | 8,200円 |
| 合格発表 | 2026年11月25日（水）予定 |
| 目標点 | 38〜40点（合格ラインは例年35点前後）|

## 品質ハーネス結果
- 判定: **PASS**（全スコア 4〜5 / 5）
- 公式情報（RETIO・e-Gov法令）を一次情報として収録済み
