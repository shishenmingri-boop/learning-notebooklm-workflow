# Daily News Digest - 2026-06-22

BBC NewsとAl Jazeeraの主要ニュースを日本語で確認するための動作確認用パッケージです。

## 概要

- 実行日: 2026-06-22
- 対象媒体: BBC News, Al Jazeera
- 目的: 毎朝のAutomationが生成する想定のMarkdown構成を一度手動で検証する

## ファイル

- `sources.md`: 採用した記事URLと短い要約
- `00_overview.md`: 全体サマリー
- `01_bbc.md`: BBC記事の翻訳・要約
- `02_aljazeera.md`: Al Jazeera記事の翻訳・要約
- `03_sources.md`: 情報源一覧と採用メモ
- `notebooklm-prompt.md`: NotebookLMに貼る分析プロンプト
- `notebooklm-upload-plan.md`: NotebookLM投入手順

## 注意

BBCのRSS取得はタイムアウトしたため、BBC World公開ページと検索結果から取得できた見出し・記事ページ情報を使っています。Al JazeeraのRSSは500エラーだったため、公開ニュースページを使っています。
