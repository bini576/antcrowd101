import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Client as MinioClient } from 'minio';
import { config } from '../config/env.js';

let minioClient;
let minioReadyPromise;

function sanitizeName(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function normalizeSlashes(value) {
  return String(value).replace(/\\/g, '/').replace(/^\/+/, '');
}

function resolveObjectKey(category, userId, originalName) {
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  return `${category}/${userId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${sanitizeName(baseName)}${extension}`;
}

function inferContentType(objectKey) {
  const extension = path.extname(objectKey).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function ensureFilesystemReady() {
  await fsp.mkdir(config.uploadsDir, { recursive: true });
}

async function getMinioClient() {
  if (minioClient) {
    return minioClient;
  }

  if (!minioReadyPromise) {
    minioReadyPromise = (async () => {
      const [hostPart, portPart] = String(config.storage.minio.endpoint).split(':');
      const parsedPort = Number.parseInt(portPart ?? '', 10);
      const client = new MinioClient({
        endPoint: hostPart,
        port: Number.isFinite(parsedPort) ? parsedPort : undefined,
        accessKey: config.storage.minio.accessKey,
        secretKey: config.storage.minio.secretKey,
        useSSL: config.storage.minio.useSSL
      });

      const bucketExists = await client.bucketExists(config.storage.minio.bucket);
      if (!bucketExists) {
        await client.makeBucket(config.storage.minio.bucket);
      }

      minioClient = client;
      return client;
    })();
  }

  return minioReadyPromise;
}

export async function ensureStorageReady() {
  if (config.storage.provider === 'minio') {
    await getMinioClient();
    return;
  }

  await ensureFilesystemReady();
}

export function normalizeStoredObjectKey(value) {
  if (!value) {
    return null;
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return null;
  }

  if (path.isAbsolute(normalizedValue)) {
    return normalizeSlashes(path.relative(config.uploadsDir, normalizedValue));
  }

  return normalizeSlashes(normalizedValue);
}

export async function storeVerificationDocument({ category, userId, file }) {
  const objectKey = resolveObjectKey(category, userId, file.originalname);

  if (config.storage.provider === 'minio') {
    const client = await getMinioClient();
    await client.putObject(
      config.storage.minio.bucket,
      objectKey,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype || inferContentType(objectKey) }
    );
  } else {
    await ensureFilesystemReady();
    const absolutePath = path.join(config.uploadsDir, objectKey);
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsp.writeFile(absolutePath, file.buffer);
  }

  return {
    objectKey,
    originalName: file.originalname
  };
}

export async function readVerificationDocument(objectKey) {
  const normalizedObjectKey = normalizeStoredObjectKey(objectKey);
  if (!normalizedObjectKey) {
    return null;
  }

  if (config.storage.provider === 'minio') {
    try {
      const client = await getMinioClient();
      const stream = await client.getObject(config.storage.minio.bucket, normalizedObjectKey);
      const stat = await client.statObject(config.storage.minio.bucket, normalizedObjectKey);

      return {
        stream,
        contentLength: stat.size,
        contentType: stat.metaData?.['content-type'] || inferContentType(normalizedObjectKey),
        filename: path.basename(normalizedObjectKey)
      };
    } catch {
      return null;
    }
  }

  const absolutePath = path.join(config.uploadsDir, normalizedObjectKey);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const stat = await fsp.stat(absolutePath);
  return {
    stream: fs.createReadStream(absolutePath),
    contentLength: stat.size,
    contentType: inferContentType(normalizedObjectKey),
    filename: path.basename(normalizedObjectKey)
  };
}
