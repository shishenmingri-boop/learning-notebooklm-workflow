# Pinterest Content Pipeline Result

- 判定: 成功
- 開始: 2026-07-01T16:52:43.249Z
- 終了: 2026-07-01T16:52:43.263Z
- queue-dir: C:\Users\ohiei\learning-notebooklm-workflow\content-queue

## 生成ノート
- なし

## 生成ピン
- なし

## スキップ
- note:kitchen-narrow
- pin:kitchen-narrow-01
- pin:kitchen-narrow-02
- pin:kitchen-narrow-03
- note:kitchen-sink-under
- pin:kitchen-sink-under-01
- pin:kitchen-sink-under-02
- pin:kitchen-sink-under-03
- note:kitchen-spice-magnet
- pin:kitchen-spice-magnet-01
- pin:kitchen-spice-magnet-02
- pin:kitchen-spice-magnet-03
- note:oneroom-8tatami
- pin:oneroom-8tatami-01
- pin:oneroom-8tatami-02
- pin:oneroom-8tatami-03
- note:closet-oshiire
- pin:closet-oshiire-01
- pin:closet-oshiire-02
- pin:closet-oshiire-03
- note:closet-clothes
- pin:closet-clothes-01
- pin:closet-clothes-02
- pin:closet-clothes-03
- note:entry-shoes
- pin:entry-shoes-01
- pin:entry-shoes-02
- pin:entry-shoes-03
- note:bath-vanity-under
- pin:bath-vanity-under-01
- pin:bath-vanity-under-02
- pin:bath-vanity-under-03
- note:rental-wall
- pin:rental-wall-01
- pin:rental-wall-02
- pin:rental-wall-03
- note:living-cable
- pin:living-cable-01
- pin:living-cable-02
- pin:living-cable-03

## エラー / 通知
- なし

## 次のアクション
1. `content-queue/config.json` の noteBaseUrl / imagePublicBaseUrl を自分のURLに更新
2. `content-queue/images/` に PNG を配置し CDN へアップロード
4. `.env` に `REPLICATE_API_TOKEN` を設定
5. `node scripts/pinterest_generate_images.mjs` で Flux 画像生成
6. 生成 PNG を CDN へアップロード
7. `.env` に Pinterest App ID / Secret を設定
8. `node scripts/pinterest_api_post.mjs auth` で OAuth
9. `node scripts/pinterest_api_post.mjs boards` で boardIds を確認
10. `node scripts/pinterest_api_post.mjs post-queue --dry-run true` で確認後、`--dry-run false` で投稿

