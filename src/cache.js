import Redis from 'ioredis';
import crypto from 'node:crypto';
import { config } from './config.js';

let redis = null;

function buildCacheKey(options) {
  const payload = JSON.stringify(options);
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return `screenshot:${hash}`;
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

export async function getCachedScreenshot(options) {
  if (!redis) return null;
  const key = buildCacheKey(options);
  const value = await redis.getBuffer(key);
  return value ?? null;
}

export async function setCachedScreenshot(options, buffer, ttlSeconds = config.cacheTtlSeconds) {
  if (!redis) return;
  const key = buildCacheKey(options);
  await redis.set(key, buffer, 'EX', ttlSeconds);
}
