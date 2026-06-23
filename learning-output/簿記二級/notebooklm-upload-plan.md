# NotebookLMアップロード計画

## 連携方式
PlaywrightによるWeb UI自動化

## ノート名
簿記二級

## NotebookLM URL
https://notebooklm.google.com/

## 使用するPlaywrightプロファイル
`C:\Users\K-OGAWA\Projects\learning-notebooklm-workflow\.notebooklm-playwright-profile`

## 投入対象ファイル（Markdownソース）

| ファイル | 内容 |
|---------|------|
| `00_overview.md` | 全体像・学習順序・主要概念マップ |
| `01_core_concepts.md` | 重要用語・仕訳パターン・計算式 |
| `02_deep_dive.md` | 連結・差異分析・CVP等の深掘り解説 |
| `03_sources.md` | 参照情報源一覧・信頼度評価 |
| `04_quiz_seed.md` | クイズ種・仕訳問題・シナリオ問題 |

## 追加対象URLソース

| URL | 内容 |
|-----|------|
| https://www.kentei.ne.jp/bookkeeping/exam-list | 公式出題区分表 |
| https://kaikeishien.com/cost-cvp-analysis/ | 差異分析・CVP解説 |
| https://kaikeishien.com/boki2-consolidated-accounting-timetable/ | 連結会計解説 |
| https://kaikeishien.com/boki2-commercial-tax-lease-forex/ | 税効果・リース・外貨解説 |
| https://cpa-noborikawa.net/renketsu-kiso/ | 連結会計図解 |
| https://wwboki.jp/dokuboki/industrial-2kyu/standard-cost-accounting/ | 標準原価計算解説 |
| https://wwboki.jp/dokuboki/commercial-2kyu/tax-effect-accounting-2/ | 税効果会計解説 |
| https://www.pdca-accounting.com/bokinyuumon/bokinyuumon112-1.html | 繰延税金資産解説 |
| https://www.ey.com/ja_jp/technical/corporate-accounting/commentary/tax-effect/commentary-tax-effect-2011-12-22 | EY税効果解説 |

## 期待される完了条件

- NotebookLMに「簿記二級」ノートが作成されている
- 上記5つのMarkdownファイルがソースとして追加されている
- 上記URLがウェブサイトソースとして追加されている

## 自動化失敗時の手動フォールバック

1. https://notebooklm.google.com/ を開く
2. Googleアカウントでログイン
3. 「新規作成」→ノート名を「簿記二級」に設定
4. 「ファイルをアップロード」から以下を選択してアップロード：
   - `C:\Users\K-OGAWA\Projects\learning-notebooklm-workflow\learning-output\簿記二級\00_overview.md`
   - （同ディレクトリの `01_core_concepts.md`〜`04_quiz_seed.md` も同様）
5. 「ウェブサイトを追加」から上記URLを1件ずつ追加
6. アップロード完了後、`notebooklm-prompt.md` の内容をチャットに貼り付けて送信
