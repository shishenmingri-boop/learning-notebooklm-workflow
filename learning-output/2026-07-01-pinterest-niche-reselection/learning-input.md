# 学習入力（ヒアリング記録）

## 学習テーマ

Pinterestアフィリエイト副業 ニッチ再選定（収納ニッチ含む複数候補比較・2026年版）

## 学習目的

実務利用（副業ニッチ選定の意思決定）

背景: `learning-notebooklm-workflow` リポジトリで「収納」ニッチのPinterest自動化パイプライン（note下書き生成→Flux画像生成→CDNアップロード→Pinterest投稿）を構築済みだが、まだ本番投稿は行っておらず実績データは存在しない。ニッチ自体をゼロベースで再評価し、収納ニッチを継続すべきか、別ニッチにピボットすべきかを判断する。

## 学習の深さ

実務レベル（意思決定に使える具体性・比較表・推奨ランキングを含む）

## 避けたい情報源

- 2023年以前のPinterest Creator Rewards（表示単価制度）時代の古い収益情報
- 根拠薄弱な個人ブログ単独情報（他情報源で裏付けが取れないもの）

## 既に持っている資料・メモ

- `content-queue/HANDOFF.md`（2026-06-23時点の既存収納ニッチ調査。収益ルート比較表、月収試算表、キーワード設計ロジックを含む）
- `content-queue/keywords.csv`、`content-queue/pins/*.json`（収納ニッチで既に生成済みのコンテンツ資産、30ピン分）
- 実装済みパイプラインコード（`scripts/pinterest_*.mjs`）— 本タスクでは変更しない

## NotebookLMノート名

Pinterest収益化ニッチ再選定2026

## NotebookLM自動化設定

- 自動化: Playwrightで `scripts/notebooklm_web_upload.mjs` を使い、ノート作成・ソースアップロードを実行
- プロファイル: `.notebooklm-playwright-profile`（ワークスペース直下、既定）
- 追加調査: 根拠が薄い論点についてNotebookLMのDeep Research機能（ソースを追加 → Web → Deep Research）の利用を試行

## 候補ニッチの絞り込み方針

ユーザーからのヒアリング結果:

- 比較候補ニッチは固定せず、AIが2026年の日本国内Pinterestアフィリエイト事情を踏まえて候補を提案・比較する
- 既存の「収納」ニッチも比較対象の1つとして残し、他ニッチと客観比較する
