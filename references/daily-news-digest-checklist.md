# Daily News Digest 運用確認チェックリスト

毎朝の Daily News Digest（BBC + Al Jazeera → Markdown → NotebookLM）が正常に動いたかを、オペレーターが5〜10分で確認するための手順書です。

## 1. 実行前チェック（Pre-flight）

- [ ] **Automation が保存済み** — Cursor Automations で Daily News Digest ワークフローが有効
- [ ] **Cloud Agents が有効** — 自動実行に Cloud が必要な場合、設定がオン
- [ ] **GitHub 連携** — [Cloud Agents](https://cursor.com/dashboard/cloud-agents) で GitHub が **Connected**、Default repository に `shin-takoyaki/learning-notebooklm-workflow`（または `learning-notebooklm-workflow`）が選択可能（Cloud が成果物を push する場合）
- [ ] **Playwright プロファイル** — `.notebooklm-playwright-profile` で Google / NotebookLM にログイン済み
  - 未ログインの場合: 通常 Chrome で `https://notebooklm.google.com/` を開き、同プロファイル相当のアカウントでログイン
- [ ] **Node / Playwright** — リポジトリルートで `node scripts/notebooklm_web_upload.mjs --help` が動く

## 2. 当日出力フォルダの確認

期待パス:

```text
learning-output/YYYY-MM-DD-news/
```

例（今日）: `learning-output/2026-06-23-news/`

### 必須ファイル（8件）

| ファイル | 役割 |
|---|---|
| `sources.md` | 採用URL一覧 |
| `00_overview.md` | 全体サマリー |
| `01_bbc.md` | BBC要約 |
| `02_aljazeera.md` | Al Jazeera要約 |
| `03_sources.md` | 採用メモ・取得経路 |
| `notebooklm-prompt.md` | NotebookLM分析用プロンプト |
| `notebooklm-upload-plan.md` | アップロード手順 |
| `README.md` | パッケージ説明 |

### 任意（アップロード実行後）

| ファイル | 役割 |
|---|---|
| `notebooklm-upload-result.md` | Playwright実行結果 |

### クイック確認コマンド（PowerShell）

```powershell
$dir = "learning-output/$(Get-Date -Format yyyy-MM-dd)-news"
Test-Path $dir
Get-ChildItem $dir | Select-Object Name, Length, LastWriteTime
```

## 3. `notebooklm-upload-result.md` の読み方

### 成功の目安

- **ステータス**: `成功` または `成功またはユーザー確認済み`
- **NotebookLM URL**: `https://notebooklm.google.com/notebook/...` が記載
- **アップロード確認**: 投入対象4 Markdown がすべてリストされる
- **URLソース追加確認**: `sources.md` のURLが追加済み
- **エラー**: `なし`

### 失敗・要対応の目安

- **ステータス**: `失敗` / `要手動対応` / ログイン関連メッセージ
- **手動介入ポイント**: 2FA、Googleログイン拒否、UI変更などが記載
- **URLソース追加失敗**: 一部URLのみ失敗 → 手動で残りを追加
- **エラー**: 非空 → 下記フォールバックへ

## 4. 手動フォールバック

### A. Markdown生成だけ失敗した場合

1. このチェックリスト末尾の「手動再実行コマンド」を Cursor Agent に渡す
2. 出力フォルダと8ファイルが揃うまで再生成

### B. NotebookLMアップロードだけ失敗した場合

1. 通常 Chrome / Edge で `https://notebooklm.google.com/` を開く
2. 新規ノート作成、タイトル `Daily News YYYY-MM-DD`
3. 以下4ファイルをソースアップロード:
   - `00_overview.md`, `01_bbc.md`, `02_aljazeera.md`, `03_sources.md`
4. `sources.md` 内のURLを「ウェブサイト」ソースとして追加
5. `notebooklm-prompt.md` をチャットに貼り付けて分析開始

### C. Googleログイン拒否（`Couldn't sign you in`）

1. 通常ブラウザで NotebookLM にログインできるか確認
2. `.notebooklm-playwright-profile` を使った再実行
3. それでもダメなら **B** の完全手動投入

## 5. 今日の分を手動で再実行するコマンド

### Markdown生成（Agent依頼文の例）

```text
Daily News Digest を今日の日付で手動実行してください。
learning-output/YYYY-MM-DD-news/ に sources.md, 00_overview.md, 01_bbc.md,
02_aljazeera.md, 03_sources.md, notebooklm-prompt.md, notebooklm-upload-plan.md,
README.md を作成し、NotebookLMアップロードまで試行してください。
```

### NotebookLMアップロードのみ再実行

```bash
node scripts/notebooklm_web_upload.mjs \
  --output-dir learning-output/YYYY-MM-DD-news \
  --notebook-title "Daily News YYYY-MM-DD" \
  --files 00_overview.md,01_bbc.md,02_aljazeera.md,03_sources.md \
  --source-url-file sources.md \
  --browser-channel chrome \
  --user-data-dir .notebooklm-playwright-profile \
  --auto-continue true \
  --close-browser true
```

`YYYY-MM-DD` は当日日付に置き換える（例: `2026-06-23`）。

## 6. 完了判定（Go / No-Go）

| 項目 | Go |
|---|---|
| 出力フォルダ存在 | `learning-output/今日-news/` あり |
| 必須8ファイル | すべて存在、中身が空でない |
| NotebookLM | `notebooklm-upload-result.md` が成功、または手動投入完了 |
| 内容妥当性 | `00_overview.md` の日付が今日、`sources.md` にBBC/Al Jazeera URLあり |

**No-Go** の場合: セクション4のフォールバックを実行し、`notebooklm-upload-result.md` に原因と実施した復旧手順を追記する。
