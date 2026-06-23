#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  ensureDir,
  parseArgs,
  parseCsv,
  readJson,
  readText,
  resolveQueuePath,
  slugify,
  writeJson,
  writeText,
} from "./pinterest/lib/common.mjs";

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(`使い方:
  node scripts/pinterest_content_pipeline.mjs

オプション:
  --queue-dir DIR           既定: content-queue
  --keywords FILE           既定: content-queue/keywords.csv
  --config FILE             既定: content-queue/config.json
  --pins-per-keyword N      config.json より優先
  --force true              既存ファイルを上書き
`);
  process.exit(0);
}

const queueDir = path.resolve(args["queue-dir"] || "content-queue");
const keywordsPath = path.resolve(args.keywords || resolveQueuePath(queueDir, "keywords.csv"));
const configPath = path.resolve(args.config || resolveQueuePath(queueDir, "config.json"));
const exampleConfigPath = resolveQueuePath(queueDir, "config.example.json");
const force = args.force === "true";

const startedAt = new Date().toISOString();
const result = {
  startedAt,
  status: "失敗",
  queueDir,
  generatedNotes: [],
  generatedPins: [],
  skipped: [],
  errors: [],
};

try {
  if (!fs.existsSync(keywordsPath)) {
    throw new Error(`keywords.csv が見つかりません: ${keywordsPath}`);
  }
  if (!fs.existsSync(configPath)) {
    if (fs.existsSync(exampleConfigPath)) {
      fs.copyFileSync(exampleConfigPath, configPath);
      result.errors.push(`config.json が無かったため config.example.json をコピーしました: ${configPath}`);
    } else {
      throw new Error(`config.json が見つかりません: ${configPath}`);
    }
  }

  const config = readJson(configPath);
  const rows = parseCsv(readText(keywordsPath));
  if (rows.length === 0) {
    throw new Error("keywords.csv にデータ行がありません。");
  }

  const pinsPerKeyword = Number(args["pins-per-keyword"] || config.pinsPerKeyword || 3);
  const notesDir = resolveQueuePath(queueDir, "notes");
  const pinsDir = resolveQueuePath(queueDir, "pins");
  const imagesDir = resolveQueuePath(queueDir, "images");
  ensureDir(notesDir);
  ensureDir(pinsDir);
  ensureDir(imagesDir);

  const manifest = {
    version: 1,
    generatedAt: startedAt,
    niche: config.niche || "storage",
    pins: [],
  };

  for (const row of rows) {
    const keyword = row.keyword || row.keywords;
    if (!keyword) continue;

    const cluster = row.cluster || "oneroom";
    const noteSlug = row.note_slug || slugify(keyword);
    const products = (row.products || "").split("|").map((item) => item.trim()).filter(Boolean);
    const linkPath = row.link_path || noteSlug;
    const boardName = config.boardNames?.[cluster] || config.boardNames?.oneroom || "ワンルーム収納";
    const notePath = path.join(notesDir, `${noteSlug}.md`);
    const noteUrl = joinUrl(config.noteBaseUrl, linkPath);
    const defaultLink = noteUrl || config.defaultLink;

    if (!force && fs.existsSync(notePath)) {
      result.skipped.push(`note:${noteSlug}`);
    } else {
      const noteContent = buildNoteMarkdown({
        keyword,
        cluster,
        products,
        noteUrl: defaultLink,
      });
      writeText(notePath, noteContent);
      result.generatedNotes.push(path.relative(process.cwd(), notePath));
    }

    for (let variant = 1; variant <= pinsPerKeyword; variant += 1) {
      const pinId = `${noteSlug}-${String(variant).padStart(2, "0")}`;
      const pinPath = path.join(pinsDir, `${pinId}.json`);
      const imageFileName = `${pinId}.png`;
      const imagePublicUrl = joinUrl(config.imagePublicBaseUrl, imageFileName);

      if (!force && fs.existsSync(pinPath)) {
        result.skipped.push(`pin:${pinId}`);
        manifest.pins.push(readJson(pinPath));
        continue;
      }

      const pin = buildPinRecord({
        pinId,
        keyword,
        cluster,
        boardName,
        variant,
        products,
        link: defaultLink,
        imageFileName,
        imagePublicUrl,
        imageLocalPath: path.relative(queueDir, path.join(imagesDir, imageFileName)).replace(/\\/g, "/"),
      });

      writeJson(pinPath, pin);
      result.generatedPins.push(path.relative(process.cwd(), pinPath));
      manifest.pins.push(pin);
    }
  }

  writeJson(resolveQueuePath(queueDir, "manifest.json"), manifest);
  writeText(resolveQueuePath(queueDir, "images", "README.txt"), [
    "このディレクトリにピン画像を置いてください。",
    "ファイル名は pins/*.json の image.localPath と一致させます。",
    "公開URLは config.json の imagePublicBaseUrl 配下にアップロードしてください。",
  ].join("\n"));

  result.status = "成功";
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
}

writePipelineResult(queueDir, result);
console.log(`pipeline result: ${resolveQueuePath(queueDir, "pipeline-result.md")}`);
if (result.status !== "成功") {
  process.exitCode = 1;
}

function joinUrl(base, suffix) {
  if (!base) return "";
  if (!suffix) return base;
  return `${String(base).replace(/\/+$/, "")}/${String(suffix).replace(/^\/+/, "")}`;
}

function buildNoteMarkdown({ keyword, cluster, products, noteUrl }) {
  const productLines = (products.length ? products : ["収納ラック", "収納ボックス", "仕切りケース"])
    .slice(0, 3)
    .map((product, index) => {
      return `| ${index + 1} | ${product} | 要確認 | 要確認 | 要確認 | [楽天で見る](${noteUrl}) |`;
    })
    .join("\n");

  return `# ${keyword}｜おすすめ収納グッズ比較

## この記事でわかること

- ${keyword} の悩みを解決する具体策
- 購入前に比較すべき3アイテム
- 賃貸でも使えるかどうかの判断基準

## 悩みの整理

${keyword} でよくある悩みは次の3つです。

1. モノが増えて見た目が散らかる
2. 出し入れが面倒で続かない
3. 賃貸で穴あけや工事ができない

## おすすめ3選

| 順位 | 商品 | 価格目安 | サイズ | 特徴 | リンク |
|---|---|---|---|---|---|
${productLines}

## 選び方

- 幅と奥行きを先に測る
- 100均 + 1,000円超の定番を1点混ぜる
- 見せる収納と隠す収納を分ける

## まとめ

${keyword} は「商品選び」より「配置ルール」を決めるほうが再現性が高いです。まずは1スペースだけ整えて、使い勝手を確認してから追加購入してください。

---

参考リンク: ${noteUrl}
`;
}

function buildPinRecord({
  pinId,
  keyword,
  cluster,
  boardName,
  variant,
  products,
  link,
  imageFileName,
  imagePublicUrl,
  imageLocalPath,
}) {
  const titles = [
    `${keyword}｜Before/After`,
    `${keyword}｜購入前チェック3点`,
    `${keyword}｜100均+定番の組み合わせ`,
    `${keyword}｜賃貸OKアイデア`,
    `${keyword}｜失敗しない選び方`,
  ];
  const productHint = products[0] || "収納グッズ";
  const title = titles[(variant - 1) % titles.length];
  const description = [
    `${keyword} の収納アイデア。`,
    `${productHint} を使ったBefore/After例。`,
    "詳しい比較表はリンク先へ。",
    `#${cluster} #収納 #一人暮らし #賃貸`,
  ].join(" ");

  return {
    id: pinId,
    status: "draft",
    keyword,
    cluster,
    board: boardName,
    title,
    description,
    link,
    altText: `${keyword} の収納Before/After`,
    image: {
      localPath: imageLocalPath,
      fileName: imageFileName,
      publicUrl: imagePublicUrl,
    },
    publishAt: "",
    postedPinId: "",
    lastError: "",
  };
}

function writePipelineResult(queueDir, result) {
  const finishedAt = new Date().toISOString();
  const lines = [
    "# Pinterest Content Pipeline Result",
    "",
    `- 判定: ${result.status === "成功" ? "成功" : "失敗"}`,
    `- 開始: ${result.startedAt}`,
    `- 終了: ${finishedAt}`,
    `- queue-dir: ${result.queueDir}`,
    "",
    "## 生成ノート",
    ...(result.generatedNotes.length ? result.generatedNotes.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## 生成ピン",
    ...(result.generatedPins.length ? result.generatedPins.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## スキップ",
    ...(result.skipped.length ? result.skipped.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## エラー / 通知",
    ...(result.errors.length ? result.errors.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## 次のアクション",
    "1. `content-queue/config.json` の noteBaseUrl / imagePublicBaseUrl を自分のURLに更新",
    "2. `content-queue/images/` に PNG を配置し CDN へアップロード",
    "4. `.env` に `REPLICATE_API_TOKEN` を設定",
    "5. `node scripts/pinterest_generate_images.mjs` で Flux 画像生成",
    "6. 生成 PNG を CDN へアップロード",
    "7. `.env` に Pinterest App ID / Secret を設定",
    "8. `node scripts/pinterest_api_post.mjs auth` で OAuth",
    "9. `node scripts/pinterest_api_post.mjs boards` で boardIds を確認",
    "10. `node scripts/pinterest_api_post.mjs post-queue --dry-run true` で確認後、`--dry-run false` で投稿",
    "",
  ];
  writeText(resolveQueuePath(queueDir, "pipeline-result.md"), `${lines.join("\n")}\n`);
}
