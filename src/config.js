function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const v = String(value).toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

export const config = {
  port: toNumber(process.env.PORT, 4000),
  redisUrl: process.env.REDIS_URL || 'redis://:redis123@localhost:6379',
  /** 0 = sin caducidad en Redis (sin EX). >0 = TTL en segundos. */
  cacheTtlSeconds: toNumber(process.env.CACHE_TTL, 1800),
  concurrency: toNumber(process.env.CONCURRENCY, 3),
  screenshotTimeout: toNumber(process.env.SCREENSHOT_TIMEOUT, 15000),
  networkIdleTimeout: toNumber(process.env.NETWORK_IDLE_TIMEOUT, 2000),
  jpegQuality: toNumber(process.env.JPEG_QUALITY, 85),
  revalidateEnabled: toBool(process.env.REVALIDATE_ENABLED, true),
  revalidateLockSeconds: toNumber(process.env.REVALIDATE_LOCK_SECONDS, 30),
  revalidateRequestTimeoutMs: toNumber(process.env.REVALIDATE_REQUEST_TIMEOUT_MS, 10000),
};
