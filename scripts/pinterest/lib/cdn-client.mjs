const INVALID_BUCKET = new Set(["", "your-bucket-name"]);
const INVALID_PUBLIC_BASE = /your-cdn\.example\.com/i;

function isValidBucket(value) {
  const bucket = String(value || "").trim();
  return bucket.length > 0 && !INVALID_BUCKET.has(bucket);
}

export function isPlaceholderPublicUrl(url) {
  return !url || INVALID_PUBLIC_BASE.test(url);
}

export function getCdnConfig(queueConfig = {}) {
  const cdn = queueConfig.cdn || {};
  const bucket = process.env.CDN_BUCKET || cdn.bucket || "";
  const endpoint = process.env.CDN_ENDPOINT || cdn.endpoint || "";
  const accessKeyId = process.env.CDN_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.CDN_SECRET_ACCESS_KEY || "";
  const publicBaseUrl = cdn.publicBaseUrl || queueConfig.imagePublicBaseUrl || "";

  return {
    provider: process.env.CDN_PROVIDER || cdn.provider || "r2",
    bucket: isValidBucket(bucket) ? bucket : "",
    prefix: cdn.prefix || "pinterest-storage/",
    region: process.env.CDN_REGION || cdn.region || "auto",
    endpoint,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
    cacheControl: "public, max-age=31536000, immutable",
    contentType: "image/png",
  };
}

export function assertCdnConfig(cdn) {
  const errors = [];

  if (!isValidBucket(cdn.bucket)) {
    errors.push("CDN bucket が未設定です（CDN_BUCKET または config.cdn.bucket）");
  }
  if (!cdn.accessKeyId) {
    errors.push("CDN_ACCESS_KEY_ID が未設定です");
  }
  if (!cdn.secretAccessKey) {
    errors.push("CDN_SECRET_ACCESS_KEY が未設定です");
  }
  if (!cdn.publicBaseUrl || INVALID_PUBLIC_BASE.test(cdn.publicBaseUrl)) {
    errors.push("publicBaseUrl が未設定またはプレースホルダです（config.cdn.publicBaseUrl または imagePublicBaseUrl）");
  }
  if (cdn.provider === "r2" && !cdn.endpoint) {
    errors.push("provider=r2 の場合 CDN_ENDPOINT が必須です");
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

export function buildObjectKey(cdn, fileName) {
  const prefix = String(cdn.prefix || "").replace(/^\/+/, "");
  const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${normalizedPrefix}${fileName}`;
}

export function buildPublicUrl(cdn, fileName) {
  const base = String(cdn.publicBaseUrl || "").replace(/\/+$/, "");
  const name = String(fileName || "").replace(/^\/+/, "");
  return `${base}/${name}`;
}

function contentTypeFromFileName(fileName) {
  const ext = String(fileName || "").split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

export async function createS3Client(cdn) {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const options = {
    region: cdn.region || "auto",
    credentials: {
      accessKeyId: cdn.accessKeyId,
      secretAccessKey: cdn.secretAccessKey,
    },
  };
  if (cdn.endpoint) {
    options.endpoint = cdn.endpoint;
    options.forcePathStyle = true;
  }
  return new S3Client(options);
}

export async function uploadLocalFile(client, cdn, filePath, fileName) {
  const fs = await import("node:fs");
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");

  const body = fs.readFileSync(filePath);
  const key = buildObjectKey(cdn, fileName);
  const contentType = contentTypeFromFileName(fileName);

  const response = await client.send(new PutObjectCommand({
    Bucket: cdn.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cdn.cacheControl,
  }));

  return {
    key,
    etag: response.ETag || "",
    size: body.length,
    publicUrl: buildPublicUrl(cdn, fileName),
  };
}
