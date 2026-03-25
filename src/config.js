function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: toNumber(process.env.PORT, 4000),
  redisUrl: process.env.REDIS_URL || 'redis://:redis123@localhost:6379',
  cacheTtlSeconds: toNumber(process.env.CACHE_TTL, 1800),
  concurrency: toNumber(process.env.CONCURRENCY, 3),
  screenshotTimeout: toNumber(process.env.SCREENSHOT_TIMEOUT, 15000),
  networkIdleTimeout: toNumber(process.env.NETWORK_IDLE_TIMEOUT, 2000),
  jpegQuality: toNumber(process.env.JPEG_QUALITY, 85),
};
