# Pinterest Content Pipeline Result

- 判定: 成功
- 開始: 2026-06-23T04:35:09.450Z
- 終了: 2026-06-23T04:35:09.569Z
- queue-dir: C:\Users\K-OGAWA\Projects\learning-notebooklm-workflow\content-queue

## 生成ノート
- content-queue\notes\kitchen-narrow.md
- content-queue\notes\kitchen-sink-under.md
- content-queue\notes\kitchen-spice-magnet.md
- content-queue\notes\oneroom-8tatami.md
- content-queue\notes\closet-oshiire.md
- content-queue\notes\closet-clothes.md
- content-queue\notes\entry-shoes.md
- content-queue\notes\bath-vanity-under.md
- content-queue\notes\rental-wall.md
- content-queue\notes\living-cable.md

## 生成ピン
- content-queue\pins\kitchen-narrow-01.json
- content-queue\pins\kitchen-narrow-02.json
- content-queue\pins\kitchen-narrow-03.json
- content-queue\pins\kitchen-sink-under-01.json
- content-queue\pins\kitchen-sink-under-02.json
- content-queue\pins\kitchen-sink-under-03.json
- content-queue\pins\kitchen-spice-magnet-01.json
- content-queue\pins\kitchen-spice-magnet-02.json
- content-queue\pins\kitchen-spice-magnet-03.json
- content-queue\pins\oneroom-8tatami-01.json
- content-queue\pins\oneroom-8tatami-02.json
- content-queue\pins\oneroom-8tatami-03.json
- content-queue\pins\closet-oshiire-01.json
- content-queue\pins\closet-oshiire-02.json
- content-queue\pins\closet-oshiire-03.json
- content-queue\pins\closet-clothes-01.json
- content-queue\pins\closet-clothes-02.json
- content-queue\pins\closet-clothes-03.json
- content-queue\pins\entry-shoes-01.json
- content-queue\pins\entry-shoes-02.json
- content-queue\pins\entry-shoes-03.json
- content-queue\pins\bath-vanity-under-01.json
- content-queue\pins\bath-vanity-under-02.json
- content-queue\pins\bath-vanity-under-03.json
- content-queue\pins\rental-wall-01.json
- content-queue\pins\rental-wall-02.json
- content-queue\pins\rental-wall-03.json
- content-queue\pins\living-cable-01.json
- content-queue\pins\living-cable-02.json
- content-queue\pins\living-cable-03.json

## スキップ
- なし

## エラー / 通知
- config.json が無かったため config.example.json をコピーしました: C:\Users\K-OGAWA\Projects\learning-notebooklm-workflow\content-queue\config.json

## 次のアクション
1. `content-queue/config.json` の noteBaseUrl / imagePublicBaseUrl を自分のURLに更新
2. `content-queue/images/` に PNG を配置し CDN へアップロード
3. `.env` に Pinterest App ID / Secret を設定
4. `node scripts/pinterest_api_post.mjs auth` で OAuth
5. `node scripts/pinterest_api_post.mjs boards` で boardIds を確認
6. `node scripts/pinterest_api_post.mjs post-queue --dry-run true` で確認後、`--dry-run false` で投稿

