# Pinterest収益化ニッチ再選定2026

Pinterestアフィリエイト副業の収益化戦略を、既存の「収納」ニッチも比較対象に含めつつゼロベースで再評価するための学習・意思決定支援パッケージです。

## 目的

- 「収納」ニッチの実運用実績がまだdry-run段階であることを踏まえ、収納継続か他ニッチへのピボットかをデータドリブンに判断する。
- AIが2026年時点の情報から候補ニッチ（収納、ペット用品、ファミリーキャンプ・アウトドア、育児・収納の複合など）を提案・比較し、評価軸に基づくスコアリングと推奨ランキングを提示する。
- 根拠が薄い最新論点（Pinterestの2026年AI生成コンテンツ抑制機能の適用範囲、note.comの複数ジャンル運用知見など）はNotebookLMのDeep Research機能で補強する。

## NotebookLMへの投入結果

- ノートURL: https://notebooklm.google.com/notebook/829dccc7-dd26-4520-bec2-1259a60cec1d
  （投入後にAIがノート名を「Niche Selection Scoring and Strategic Expansion Roadmap」に自動変更。内容は同一ノート）
- Markdown 5点・優先URL19/20件・Deep Researchレポート2件・クイズ生成まですべて成功。詳細は `notebooklm-upload-result.md` を参照。

## ファイル

- `learning-input.md`: ヒアリング内容の確定記録
- `research-plan.md`: 評価軸と候補ニッチ仮リスト
- `sources.md`: 収集した情報源一覧（信頼度・重要度・NotebookLM投入要否・Deep Research対象論点を含む）
- `00_overview.md`: 再選定の目的と評価軸全体像
- `01_core_concepts.md`: 評価軸の定義とPinterest/note/楽天アフィリの用語集
- `02_deep_dive.md`: 候補ニッチ別比較表・スコアリング・推奨ランキングと根拠
- `03_sources.md`: 出典一覧の要約版
- `04_quiz_seed.md`: 意思決定チェックリスト（見落としがちな論点）
- `quality-harness-result.md`: 品質ハーネスによる自己評価結果（PASS）
- `notebooklm-prompt.md`: NotebookLMチャットに貼るニッチ選定支援プロンプト
- `notebooklm-upload-plan.md`: NotebookLM投入計画（Deep Researchクエリを含む）
- `notebooklm-upload-result.md`: 実際の投入結果（成功/失敗の詳細、Deep Research実行結果、クイズ生成結果）

## NotebookLMで使うプロンプト

`notebooklm-prompt.md` の内容をノートのチャットに貼り付けると、学習ロードマップ・比較の弱点確認・ニッチ選定のシナリオ問題などをNotebookLMに生成させられる。

## クイズ生成の流れ

NotebookLM Studioパネルの「クイズ」機能を使用し、投入済み全61ソース（Markdown・URLソース・Deep Researchレポート）を基に「Webマーケティング クイズ」を自動生成済み。ノートのStudioパネルから直接確認・実施できる。

## 自動化できている部分

- ノート作成、Markdown 5点のアップロード、優先URL20件中19件の追加（Playwright/ブラウザ自動化）
- Deep Research 2クエリの実行とレポート・引用元のインポート（`ソースを追加 → ウェブ → Deep Research` のUI操作を含めて完全自動化）
- Studioパネルでのクイズ生成

## 自動化失敗時に手動で行う部分

- URLソース1件（`https://note.com/omoto_club/n/nac90c81e099a`）はnote.com側のインポート制限により自動取り込み不可。代替情報源（`note.jp/n/n8522197d1ced` 等）で内容面はカバー済みのため、追加の手動対応は不要と判断。
- 詳細な手動フォールバック手順は `notebooklm-upload-plan.md` の「自動化失敗時の手動フォールバック」節を参照。

## 今後の自動化候補

- `scripts/notebooklm_web_upload.mjs` へのDeep Research自動化機能の本実装（本タスクでは手動ブラウザ操作で試行・成功したロジックを、スクリプトの `runDeepResearch`/`runSingleDeepResearch` 関数として反映済み。次回はスクリプト単体実行での再現性を検証する）。
- "undefined" プレフィックス混入バグの根本原因調査（`browser_fill` 系ヘルパーとNotebookLM側テキストエリアの初期化タイミングの競合が疑われる）。

## 次のアクション（意思決定）

このパッケージ自体はニッチの最終決定を行わない。`02_deep_dive.md` の推奨ランキングとNotebookLM上のDeep Researchレポート2件を踏まえ、ユーザーが「収納継続」または「別ニッチへのピボット」を決定したのち、`content-queue/HANDOFF.md` の再選定サマリ節（本パッケージから追記予定）を参照して次の実装タスク（`keywords.csv` 再生成、プロンプト調整等）を別途依頼すること。
