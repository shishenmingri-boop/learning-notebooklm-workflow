# NotebookLMアップロード結果

## 実行日時

2026-07-01（JST）

## 総合結果

**一部成功**（Markdown 5点・優先URL・Deep Research 2件・クイズ生成はすべて成功。URLソース1件のみ取り込み不可）

## NotebookLMノートURL

https://notebooklm.google.com/notebook/829dccc7-dd26-4520-bec2-1259a60cec1d

- ノート名は作成時に「Pinterest収益化ニッチ再選定2026」で開始したが、ソース投入後にNotebookLMのAI自動命名機能により「Niche Selection Scoring and Strategic Expansion Roadmap」に変わっている（内容は同一ノート）。手動で戻す場合はノート名テキストボックスを編集する。
- 完了時点のソース総数: **61件**（Markdown 5点 + Deep Researchレポート2点 + URLソース54件）

## アップロード対象ファイル（Markdownソース、5点）

1. `00_overview.md`
2. `01_core_concepts.md`
3. `02_deep_dive.md`
4. `03_sources.md`
5. `04_quiz_seed.md`

## アップロード成功が確認できたファイル

5点すべて成功（ソースパネルに表示・チェック済みを確認）。

## URLソース追加対象（`sources.md` 記載の優先20件）

1. https://newsroom.pinterest.com/news/pinterest-predicts-nonconformity-self-preservation-and-escapism-drive-21-trends-for-2026/
2. https://prtimes.jp/main/html/rd/p/000000136.000037183.html
3. https://www.ranktracker.com/ja/blog/most-profitable-pinterest-niches/
4. https://www.adpicto.com/ja/blog/pinterest-marketing-with-ai-guide
5. https://note.com/omoto_club/n/nac90c81e099a
6. https://tatap.jp/knowledge/pinterest-guide-158/
7. https://affiliate.rakuten.co.jp/revision/20210128.html
8. https://affiliate.rakuten.co.jp/recommend/uplist/
9. https://affiliate.amazon.co.jp/help/node/topic/GRXPHT8U84RAYDXZ
10. https://affiliate.amazon.co.jp/help/node/topic/GJ2QX3RTJ9ELJMPP
11. https://note.jp/n/n8522197d1ced
12. https://note.com/yutori_kun01/n/n7b911f0b0911
13. https://www.adpicto.com/ja/blog/pet-care-grooming-social-media-ai
14. https://sukiguide.com/petgoods/
15. https://manamina.valuesccg.com/articles/3848
16. https://www.commercepick.com/archives/94008
17. https://help.pinterest.com/ja/article/ai-at-pinterest
18. https://webtan.impress.co.jp/n/2025/10/20/50255
19. https://forcle.co.jp/blog/yakkiho-ads/
20. https://corporate.vbest.jp/columns/9272/

## URLソース追加成功が確認できたURL

上記1〜20のうち **19件**（5を除く全件）がソースパネルに正常に取り込まれ、チェック済み状態を確認した。

## URLソース追加に失敗したURL

- **https://note.com/omoto_club/n/nac90c81e099a**
  - エラー内容（NotebookLM UI表示）: 「ソースの制限により、このウェブページはインポートできません。」
  - 対応: note.com側のスクレイピング制限によるものと推測される。代替として `note.jp/n/n8522197d1ced`（note公式データ）と `note.com/yutori_kun01/n/n7b911f0b0911`（同旨の個人ブログ）が既に取り込まれており、内容面の欠落は限定的。追加対応は不要と判断。

## Deep Research実行結果

NotebookLMの「ソースを追加 → ウェブ → Deep Research」機能を使用し、`notebooklm-upload-plan.md` に記載した2クエリをすべて実行・取り込み成功。

### クエリ1

> 2026年時点で、Pinterestの「AI生成コンテンツを少なく表示」機能は美容・アート・ファッション・インテリア以外のカテゴリにも拡大されているか、また日本のPinterestアフィリエイター・マーケターの間でAI生成ピンのリーチ低下が実際に報告されているか調査してください。あわせて、日本国内でPinterestアフィリエイトとして人気が伸びているニッチ（ペット用品、ファミリーキャンプ・アウトドア、育児・収納グッズ）について、2025年後半〜2026年時点の競合密度や実践者の体験談を調査してください。

- 結果: 完了。レポート「Deep Research レポート: PinterestにおけるAI生成コンテンツ表示制御機能のカテゴリ拡大状況と日本国内のアフィリエイト市場への影響調査報告（2026年現在）」が生成され、引用元15件とともにノートへインポート成功。

### クエリ2

> note.comにおいて「育児・教育」カテゴリと「収納・暮らし」カテゴリを両方扱うアカウント運用の実例や、複数ジャンルを組み合わせた収益化の実務知見について、2025〜2026年の情報を調査してください。

- 結果: 完了。レポート「Deep Research レポート: noteにおける「育児・教育」と「収納・暮らし」カテゴリの複合運用と多角的収益化モデルに関する実態調査報告（2025〜2026年）」が生成され、引用元19件とともにノートへインポート成功。

両クエリともUI操作は完全自動化（Playwright/CDP経由のブラウザ操作）で完了し、手動フォールバックは不要だった。

## クイズ操作結果

Studioパネルの「クイズ」ボタンをクリックし、ソース61件（Markdown・URL・Deep Researchレポートすべて含む）を基にした「Webマーケティング クイズ」の生成に成功。ノート内Studioパネルから閲覧・実施可能。

## 手動介入した箇所

ユーザーによる手動操作は発生していないが、自動化スクリプト（`scripts/notebooklm_web_upload.mjs`）の標準UI操作に加えて、以下の技術的な回避策をエージェント側で実施した。

1. **Deep Researchクエリ入力欄の初期化バグ**: `browser_fill` でクエリを入力すると先頭に "undefined" という文字列が混入する問題が発生。`browser_cdp`（`Runtime.evaluate`）でDOM要素に直接クエリ文字列を設定し、`input`イベントを発火させることで回避した。
2. **ソース追加ダイアログ後のオーバーレイ残留**: URLソース一括追加後、`.cdk-overlay-backdrop` が残留してDeep Research/クイズボタンのクリックを阻害するケースがあったため、`Escape`キー押下によるオーバーレイ解除を都度実施した。

いずれもエージェントが自律的に解決し、ユーザーへの介入依頼は発生しなかった。

## 失敗理由（まとめ）

- URLソース1件（note.com/omoto_club）: サイト側のインポート制限によるもので、自動化の不備ではない。

## 次にユーザーが行うこと

1. ノートを開き、`notebooklm-prompt.md` の内容をチャットに貼り付けて、学習ロードマップ・比較の弱点確認・シナリオ問題などの回答を得る。
2. 生成された「Webマーケティング クイズ」を確認し、ニッチ再選定の意思決定材料として活用する。
3. `learning-output/2026-07-01-pinterest-niche-reselection/02_deep_dive.md` の推奨ランキングとDeep Researchレポート2件の内容を照らし合わせ、収納ニッチ継続か別ニッチへのピボットかを最終決定する。
4. ピボットを決定した場合は、`content-queue/HANDOFF.md` の該当節を参照しつつ、`keywords.csv` 再生成やプロンプト調整などの実装タスクを別途依頼する（本タスクのスコープ外）。
