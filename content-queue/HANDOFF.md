# Pinterest 収納特化 — 作業引き継ぎ（2026-06-23）

別端末で作業を再開するための進捗まとめ。  
リポジトリ: `learning-notebooklm-workflow`

---

## 1. このプロジェクトでやっていること

**Pinterest 収納ニッチのアフィリエイト副業**を、次の流れで半自動化する。

```
keywords.csv
  → note 下書き + ピン JSON 生成
  → Flux（Replicate）で 2:3 縦長画像
  → CDN 公開 URL
  → Pinterest API v5 で投稿
```

収益は Pinterest 直接ではなく **楽天アフィリ / ROOM / note** 経由。

---

## 2. 調査で得た結論（要約）

### 前提

- Pinterest は **表示単価で直接払わない**（Creator Rewards 2021–2023 終了）
- 実効単価 = **送客先 × CTR × 成約率 × 1件報酬**

### 収納特化の現実ライン（日本・副業）

| 時期 | 月間 imp | 月収目安 | 実効 CPM |
|---|---|---|---|
| 1–3か月 | 1–10万 | 0–4,000円 | 数十円/千 imp |
| 4–6か月 | 10–30万 | 5,000–15,000円 | 50–75円/千 imp |
| 6か月+ | 30万+ | 18,000–35,000円 | 58–90円/千 imp |

### ルート別ベスト（収納特化）

| ルート | 収納特化での評価 |
|---|---|
| **楽天 ROOM / アフィリ** | ◎ メイン |
| Amazon | ○ 補助 |
| ブログ AdSense | △ 単体では弱い |
| note 有料 | ○ 月3万+ で複合 |

### キーワード設計（採用済み）

- **Tier B ロングテール** を主戦場（例: `狭いキッチン 収納 一人暮らし`）
- 広い「収納」「ダイエット」は避ける
- サブニッチ: キッチン / 賃貸OK / ワンルーム / 押入れ

### 導線（3段ファネル）

1. **Pinterest ピン** — Before/After 縦長 2:3
2. **note 無料記事** — 商品3点比較表 + 楽天リンク
3. **楽天 ROOM / アフィリ** — 購買

### 楽天 vs Amazon vs ブログ（収納）

| | 楽天 | Amazon | ブログ広告 |
|---|---|---|---|
| 料率（収納系） | 3% | 3% | RPM 150–350円/千 PV |
| 10万 imp 月収 | 8,000–30,000円 | 7,000–25,000円 | 450–2,600円（imp直結しない） |
| Pinterest 相性 | ◎ ROOM | ○ | △ |

---

## 3. 実装済み（コード）

### スクリプト

| ファイル | 役割 |
|---|---|
| `scripts/pinterest_content_pipeline.mjs` | keywords → note + pin JSON + manifest |
| `scripts/pinterest_generate_images.mjs` | Flux（Replicate）画像生成 |
| `scripts/pinterest_upload_images.mjs` | CDN（R2/S3）へ PNG アップロード |
| `scripts/pinterest_doctor.mjs` | 実行前検証（API キー / URL / 到達性） |
| `scripts/pinterest_pipeline.mjs` | 再開可能オーケストレータ（images→upload→post） |
| `scripts/pinterest_api_post.mjs` | OAuth + ボード取得 + 投稿 |
| `scripts/pinterest/lib/common.mjs` | 共通ユーティリティ |
| `scripts/pinterest/lib/cdn-client.mjs` | CDN（S3 互換）アップロード |
| `scripts/pinterest/lib/pinterest-client.mjs` | Pinterest API / OAuth |
| `scripts/pinterest/lib/flux-client.mjs` | Replicate Flux API（429/402 耐性） |
| `scripts/pinterest/lib/prompt-builder.mjs` | 収納向けプロンプト |

### npm スクリプト

```bash
npm run pinterest:generate         # コンテンツ生成
npm run pinterest:images             # Flux 画像生成（全 draft）
npm run pinterest:images:dry-run     # プロンプト確認のみ
npm run pinterest:doctor             # 実行前検証
npm run pinterest:upload:dry-run     # CDN アップロード確認
npm run pinterest:upload             # CDN 本番アップロード
npm run pinterest:pipeline           # 再開可能オーケストレータ（全段階）
npm run pinterest:auth               # Pinterest OAuth
npm run pinterest:boards             # ボード ID 取得 → config 更新
npm run pinterest:post:dry-run         # 投稿前確認
npm run pinterest:post               # 本番投稿
```

### 設定ファイル

| ファイル | 内容 |
|---|---|
| `.env.example` | API キーテンプレ（`.env` は gitignore） |
| `content-queue/config.example.json` | 設定テンプレ |
| `content-queue/config.json` | 実設定（gitignore・端末ごとに要作成） |
| `content-queue/keywords.csv` | キーワード 10 件 |

### gitignore 対象（別端末で再作成が必要）

- `.env`
- `.pinterest-oauth-token.json`
- `content-queue/config.json`
- `content-queue/boards.json`

---

## 4. 生成済みコンテンツ（この端末）

| 種別 | 数量 | 場所 |
|---|---|---|
| note 下書き | **10 本** | `content-queue/notes/*.md` |
| ピン JSON | **30 本** | `content-queue/pins/*.json` |
| マニフェスト | 1 | `content-queue/manifest.json` |
| 画像 PNG | **0 本** | `content-queue/images/`（未生成） |

### キーワード一覧（keywords.csv）

1. 狭いキッチン 収納 一人暮らし
2. シンク下 収納 100均
3. 調味料 マグネット収納 賃貸
4. ワンルーム 8畳 収納 レイアウト
5. 押入れ 収納 100均
6. クローゼット 洋服 コンパクト
7. 玄関 靴 収納 狭い
8. 洗面台 下 収納 100均
9. 原状回復OK 賃貸 壁面収納
10. テレビ 配線 隠す 収納

各キーワード → ピン **3 バリエーション**（計 30 ピン）。

---

## 5. 別端末セットアップ手順

### 5.1 リポジトリ取得

```bash
git clone <repo-url>
cd learning-notebooklm-workflow
npm install
```

未コミットの場合は、この端末から `content-queue/` 一式を USB / クラウドで持っていくか、先に git commit & push する。

### 5.2 環境変数

```bash
cp .env.example .env
cp content-queue/config.example.json content-queue/config.json
```

`.env` に設定:

```env
PINTEREST_APP_ID=           # Pinterest Developer Portal
PINTEREST_APP_SECRET=
PINTEREST_REDIRECT_URI=http://localhost:8765/callback
REPLICATE_API_TOKEN=        # https://replicate.com/account/api-tokens
CDN_PROVIDER=r2
CDN_ACCESS_KEY_ID=          # Cloudflare R2 等
CDN_SECRET_ACCESS_KEY=
CDN_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
CDN_BUCKET=                 # ← bucket 名の単一ソース
```

**bucket 名は `.env` の `CDN_BUCKET` を正とする。** `config.cdn.bucket` との不一致は `pinterest:doctor` が WARN します。

`content-queue/config.json` を編集:

```json
{
  "noteBaseUrl": "https://note.com/あなたのアカウント/n/",
  "imagePublicBaseUrl": "https://あなたのCDN/pinterest-storage/",
  "flux": {
    "model": "black-forest-labs/flux-1.1-pro",
    "aspectRatio": "2:3"
  }
}
```

### 5.3 Pinterest Developer

1. [Pinterest Developers](https://developers.pinterest.com/) でアプリ作成
2. Redirect URI: `http://localhost:8765/callback`
3. 本番投稿には **Standard access** 審査が必要（Trial は自分にしか見えない）
4. Sandbox 試行: `--sandbox true`

---

## 6. 実行フロー（コピペ用）

```bash
# ① コンテンツ再生成（必要なら）
npm run pinterest:generate

# ② 実行前検証
npm run pinterest:doctor

# ③ プロンプト確認
npm run pinterest:images:dry-run

# ④ 画像生成（1枚テスト）
node scripts/pinterest_generate_images.mjs --pin-id kitchen-narrow-01

# ⑤ 全画像生成（--sleep で429回避、--retry で再試行）
npm run pinterest:images

# ⑥ CDN アップロード
npm run pinterest:upload:dry-run
npm run pinterest:upload

# または再開可能パイプライン（途中から再開可）
npm run pinterest:pipeline
npm run pinterest:pipeline -- --stage post --dry-run true

# ⑦ Pinterest 認証
npm run pinterest:auth

# ⑧ ボード ID 取得
npm run pinterest:boards

# ⑨ 投稿確認 → 本番
npm run pinterest:post:dry-run
npm run pinterest:post
```

---

## 7. 完了 / 未完了チェックリスト

### 完了

- [x] Pinterest 収益化調査（全ルート比較）
- [x] ジャンル別試算表
- [x] 楽天 vs Amazon vs ブログ比較
- [x] 収納特化キーワード→導線→月収設計
- [x] 自動化 Phase 1（コンテンツ生成パイプライン）
- [x] 自動化 Phase 2（Pinterest API 投稿）
- [x] Flux 画像生成（Replicate）統合
- [x] CDN 自動アップロード（R2 / S3 スクリプト）
- [x] 実行前検証（pinterest:doctor）
- [x] 再開可能パイプライン（pinterest:pipeline）
- [x] Flux 429/402 耐性（リトライ / クレジット不足メッセージ）
- [x] keywords 10 件 + note 10 本 + pin 30 本 生成

### 未完了（次にやること）

- [ ] `.env` に API キー設定
- [ ] `config.json` の noteBaseUrl / imagePublicBaseUrl を本番 URL に更新
- [ ] Flux で PNG 30 枚生成（`npm run pinterest:images`）
- [ ] CDN アップロード（`npm run pinterest:upload`）
- [ ] note 記事を note.com に公開（手動 or 将来 Playwright 化）
- [ ] 楽天 ROOM / アフィリリンクを記事に設定
- [ ] Pinterest OAuth 完了
- [ ] Pinterest Standard access 審査（本番投稿前）
- [ ] 初回投稿 + Analytics 確認

### 将来拡張（検討のみ）

- [ ] note Playwright 自動公開
- [ ] 予約投稿スケジュール自動計算（`publish_at`）
- [ ] Canva テキスト載せ自動化

---

## 8. ディレクトリ構成

```text
learning-notebooklm-workflow/
├── .env.example
├── .gitignore
├── package.json
├── README.md                          # Pinterest セクションあり
├── scripts/
│   ├── pinterest_content_pipeline.mjs
│   ├── pinterest_generate_images.mjs
│   ├── pinterest_upload_images.mjs
│   ├── pinterest_doctor.mjs
│   ├── pinterest_pipeline.mjs
│   ├── pinterest_api_post.mjs
│   └── pinterest/lib/
│       ├── common.mjs
│       ├── cdn-client.mjs
│       ├── pinterest-client.mjs
│       ├── flux-client.mjs
│       └── prompt-builder.mjs
└── content-queue/
    ├── HANDOFF.md                     # ← このファイル
    ├── keywords.csv
    ├── config.example.json
    ├── config.json                    # gitignore（要コピー）
    ├── manifest.json
    ├── notes/                         # 10 本
    ├── pins/                          # 30 本
    ├── images/                        # PNG 置き場
    ├── pipeline-result.md
    ├── doctor-result.md
    ├── cdn-upload-result.md
    ├── post-result.md
    └── image-generation-result.md
```

---

## 9. ピン JSON の構造（参考）

```json
{
  "id": "kitchen-narrow-01",
  "status": "draft",
  "keyword": "狭いキッチン 収納 一人暮らし",
  "cluster": "kitchen",
  "board": "キッチン収納",
  "title": "狭いキッチン 収納 一人暮らし｜Before/After",
  "description": "...",
  "link": "https://note.com/your-account/n/kitchen-narrow",
  "image": {
    "localPath": "images/kitchen-narrow-01.png",
    "fileName": "kitchen-narrow-01.png",
    "publicUrl": "https://your-cdn.example.com/pinterest-storage/kitchen-narrow-01.png",
    "cdn": {
      "provider": "r2",
      "bucket": "my-bucket",
      "key": "pinterest-storage/kitchen-narrow-01.png",
      "etag": "\"abc123\"",
      "size": 123456,
      "uploadedAt": "2026-07-01T00:00:00.000Z"
    }
  }
}
```

投稿後: `status: "posted"`, `postedPinId` が入る。

---

## 10. Flux 設定メモ

| モデル | 用途 | 目安単価 |
|---|---|---|
| `black-forest-labs/flux-1.1-pro` | 品質重視（既定） | ~$0.04/枚 |
| `black-forest-labs/flux-schnell` | コスト重視 | ~$0.003/枚 |

プロンプトは `cluster`（kitchen / closet 等）とピン番号で Before/After 等を自動切替。  
**日本語テキストは Flux に載せない** → 必要なら Canva で後載せ。

---

## 11. 注意事項

1. **同一画像 90 日以内再投稿** → Pinterest スパム判定リスク。バリエーション必須。
2. **アフィリリンク** → ピン直リンクより note / ROOM 経由が安全。
3. **Cookie 24h**（楽天/Amazon）→ 衝動買い系小物向き。
4. **AI 利用** → プロフィールに明記推奨。
5. **secrets** → `.env` と OAuth トークンは git に含めない。別端末へは安全な経路でコピー。

---

## 12. 関連ドキュメント

| ファイル | 内容 |
|---|---|
| `README.md` | セットアップ全体 |
| `content-queue/pipeline-result.md` | 直近のパイプライン結果 |
| `content-queue/doctor-result.md` | 直近の doctor 結果 |
| `content-queue/cdn-upload-result.md` | CDN アップロード結果 |
| `content-queue/post-result.md` | 直近の投稿 dry-run 結果 |
| `content-queue/image-generation-result.md` | Flux dry-run プロンプト例 |

---

*最終更新: 2026-07-01*
