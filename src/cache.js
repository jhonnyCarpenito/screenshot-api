import Redis from 'ioredis';
import crypto from 'node:crypto';
import { config } from './config.js';

let redis = null;

function cacheHash(options) {
  const payload = JSON.stringify(options);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function buildImageKey(options) {
  return `screenshot:${cacheHash(options)}`;
}

function buildMetaKey(options) {
  return `screenshot:meta:${cacheHash(options)}`;
}

function buildRevalidateLockKey(options) {
  return `screenshot:revalidate:${cacheHash(options)}`;
}

export async function initCache() {
  if (redis) return redis;
  redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  await redis.connect();
  return redis;
}

export async function disconnectCache() {
  if (!redis) return;
  const client = redis;
  redis = null;
  await client.quit();
}

/**
 * @returns {Promise<{ buffer: Buffer, meta: { etag?: string, lastModified?: string, updatedAt?: string } } | null>}
 */
export async function getCachedScreenshot(options) {
  if (!redis) return null;
  const imageKey = buildImageKey(options);
  const metaKey = buildMetaKey(options);
  const value = await redis.getBuffer(imageKey);
  if (!value) return null;
  const metaRaw = await redis.get(metaKey);
  let meta = {};
  if (metaRaw) {
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      meta = {};
    }
  }
  return { buffer: value, meta };
}

/**
 * @param {object} options - cache key parts
 * @param {Buffer} buffer
 * @param {{ etag?: string, lastModified?: string }} validators
 * @param {number} [ttlSeconds] - 0 = sin EX (persistente hasta borrado)
 */
export async function setCachedScreenshot(options, buffer, validators = {}, ttlSeconds = config.cacheTtlSeconds) {
  if (!redis) return;
  const imageKey = buildImageKey(options);
  const metaKey = buildMetaKey(options);
  const meta = {
    ...(validators.etag ? { etag: validators.etag } : {}),
    ...(validators.lastModified ? { lastModified: validators.lastModified } : {}),
    updatedAt: new Date().toISOString(),
  };
  const metaJson = JSON.stringify(meta);

  if (ttlSeconds > 0) {
    await redis.set(imageKey, buffer, 'EX', ttlSeconds);
    await redis.set(metaKey, metaJson, 'EX', ttlSeconds);
  } else {
    await redis.set(imageKey, buffer);
    await redis.set(metaKey, metaJson);
  }
}

export async function deleteCachedScreenshot(options) {
  if (!redis) return;
  const imageKey = buildImageKey(options);
  const metaKey = buildMetaKey(options);
  await redis.del(imageKey, metaKey);
}

/** @returns {Promise<boolean>} true si este proceso adquirió el lock */
export async function tryAcquireRevalidateLock(options) {
  if (!redis) return false;
  const lockKey = buildRevalidateLockKey(options);
  const result = await redis.set(lockKey, '1', 'EX', config.revalidateLockSeconds, 'NX');
  return result === 'OK';
}

export async function releaseRevalidateLock(options) {
  if (!redis) return;
  const lockKey = buildRevalidateLockKey(options);
  await redis.del(lockKey);
}
