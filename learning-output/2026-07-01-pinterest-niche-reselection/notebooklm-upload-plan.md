# NotebookLMアップロード計画

## 連携方式

Playwrightによる `https://notebooklm.google.com/` のWeb UI自動化（個人アカウント前提、Enterprise APIは使用しない）。

## ノート名

Pinterest収益化ニッチ再選定2026

## 使用するPlaywrightプロファイル

`.notebooklm-playwright-profile`（ワークスペース直下、既定の安定プロファイル）。このプロファイルは本タスク実行時点で未作成であり、初回実行時にGoogleログインが必要になる可能性が高い。

## 投入対象ファイル（Markdownソース、5点）

1. `00_overview.md`
2. `01_core_concepts.md`
3. `02_deep_dive.md`
4. `03_sources.md`
5. `04_quiz_seed.md`

## 追加対象URLソース

`sources.md` に記載された全URL（`scripts/notebooklm_web_upload.mjs` の既定動作により自動抽出）。優先度が最も高いものは以下の5件（自動化が途中で失敗した場合は、最低限この5件を手動追加する）。

1. https://affiliate.rakuten.co.jp/revision/20210128.html
2. https://affiliate.amazon.co.jp/help/node/topic/GRXPHT8U84RAYDXZ
3. https://webtan.impress.co.jp/n/2025/10/20/50255
4. https://note.jp/n/n8522197d1ced
5. https://www.commercepick.com/archives/94008

## Deep Research実行計画

NotebookLMの「ソースを追加 → Web → Deep Research」機能（2025年11月導入の新機能）を使い、`sources.md`で明示した根拠の薄い論点を補強する。この機能は`scripts/notebooklm_web_upload.mjs`にまだ自動化コードが存在しないため、本タスクで新規に自動化を試行する（`playwright-run`ステップで実装）。UIセレクタが変更されている可能性があるため、自動化に失敗した場合は以下のクエリを手動でDeep Researchパネルに入力する。

### クエリ1（優先）

```text
2026年時点で、Pinterestの「AI生成コンテンツを少なく表示」機能は美容・アート・ファッション・インテリア以外のカテゴリにも拡大されているか、また日本のPinterestアフィリエイター・マーケターの間でAI生成ピンのリーチ低下が実際に報告されているか調査してください。あわせて、日本国内でPinterestアフィリエイトとして人気が伸びているニッチ（ペット用品、ファミリーキャンプ・アウトドア、育児・収納グッズ）について、2025年後半〜2026年時点の競合密度や実践者の体験談を調査してください。
```

### クエリ2（時間があれば追加実行）

```text
note.comにおいて「育児・教育」カテゴリと「収納・暮らし」カテゴリを両方扱うアカウント運用の実例や、複数ジャンルを組み合わせた収益化の実務知見について、2025〜2026年の情報を調査してください。
```

### 取り込み手順

1. Deep Researchの実行が完了したら、生成されたレポートと引用元ソースをNotebookLMの「インポート」操作でノートに取り込む。
2. 取り込んだソース一覧を`notebooklm-upload-result.md`に記録する。
3. レポート内容が`02_deep_dive.md`のスコアリングに影響する場合は、次回の改善サイクルで反映を検討する（本タスクでは反映の要否を記録するのみとし、即時の再編集は行わない）。

## 期待される完了条件

- NotebookLMノートページが開いており、URLが記録されている
- 5点のMarkdownソースがアップロードされている（またはユーザー確認済み）
- 優先度の高いURLソースが追加されている（またはユーザー確認済み）
- Deep Researchが最低1件実行され、結果がノートに取り込まれている、または自動化失敗時は手動実行手順が明記されている

## 自動化失敗時の手動フォールバック

1. `https://notebooklm.google.com/` を開き、Googleアカウントでログインする。
2. 「ノートブックを新規作成」を押し、ノート名を「Pinterest収益化ニッチ再選定2026」に設定する。
3. 「ソースを追加」→「ファイルをアップロード」で、上記5点のMarkdownファイルを `learning-output/2026-07-01-pinterest-niche-reselection/` からアップロードする。
4. 「ソースを追加」→「ウェブサイト」で、上記の優先URL5件（または`sources.md`の全URL）を追加する。
5. 「ソースを追加」→「Web」→「Deep Research」を選び、上記クエリ1・クエリ2を実行し、生成レポートと出典をノートに取り込む。
6. `notebooklm-prompt.md` の内容をNotebookLMのチャットに貼り付け、意思決定支援の回答を得る。
