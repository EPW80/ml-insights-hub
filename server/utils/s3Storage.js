const crypto = require('crypto');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const logger = require('../config/logger');

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION;

let cachedClient = null;

function getClient() {
  if (!BUCKET || !REGION) {
    throw new Error(
      'S3 storage is not configured. Set AWS_S3_BUCKET and AWS_REGION (plus credentials) to enable uploads.'
    );
  }
  if (!cachedClient) {
    // Credentials are resolved from the default provider chain
    // (env vars AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, IAM role, etc.).
    cachedClient = new S3Client({ region: REGION });
  }
  return cachedClient;
}

function buildKey(originalName, userId) {
  const ext = path.extname(originalName || '').toLowerCase();
  const random = crypto.randomBytes(8).toString('hex');
  const scope = userId ? String(userId) : 'anonymous';
  return `datasets/${scope}/${Date.now()}-${random}${ext}`;
}

async function uploadBuffer({ buffer, key, contentType }) {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
      ServerSideEncryption: 'AES256',
    })
  );
  logger.info('S3 upload succeeded', { bucket: BUCKET, key, size: buffer.length });
  return { bucket: BUCKET, key };
}

async function getObjectBuffer(key) {
  const client = getClient();
  const { Body } = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function deleteObject(key) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

function isConfigured() {
  return Boolean(
    BUCKET && REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );
}

module.exports = {
  buildKey,
  uploadBuffer,
  getObjectBuffer,
  deleteObject,
  isConfigured,
};
