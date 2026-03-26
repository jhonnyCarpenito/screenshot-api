import express from 'express';
import cors from 'cors';
import PQueue from 'p-queue';
import { captureScreenshot } from './capture.js';
import { config } from './config.js';
import { closeBrowser, initBrowser } from './browserManager.js';
import {
  deleteCachedScreenshot,
  disconnectCache,
  getCachedScreenshot,
  initCache,
  releaseRevalidateLock,
  setCachedScreenshot,
  tryAcquireRevalidateLock,
} from './cache.js';
import { originContentChanged } from './revalidate.js';

const app = express();
const queue = new PQueue({ concurrency: config.concurrency });

app.use(cors());
app.use(express.json());

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function scheduleBackgroundRevalidate(url, cacheOptions, meta) {
  setImmediate(() => {
    void (async () => {
      if (!config.revalidateEnabled) return;
      const etag = meta?.etag;
      const lastModified = meta?.lastModified;
      if (!etag && !lastModified) return;

      const acquired = await tryAcquireRevalidateLock(cacheOptions);
      if (!acquired) return;

      try {
        const changed = await originContentChanged(url, { etag, lastModified });
        if (changed) await deleteCachedScreenshot(cacheOptions);
      } catch (err) {
        console.error('[revalidate]', err.message);
      } finally {
        await releaseRevalidateLock(cacheOptions);
      }
    })();
  });
}

/**
 * GET /screenshot?url=https://example.com
 * Query: url (required), width, height, format=jpeg|png, fullPage=true|false
 */
app.get('/screenshot', async (req, res) => {
  const requestStartedAt = Date.now();
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Query "url" is required' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL (must be http or https)' });
  }

  const width = Math.min(Number(req.query.width) || 1280, 1920);
  const height = Math.min(Number(req.query.height) || 800, 1080);
  const format = req.query.format === 'png' ? 'png' : 'jpeg';
  const fullPage = req.query.fullPage === 'true';
  const refresh = req.query.refresh === 'true';
  const cacheOptions = { url, width, height, format, fullPage };

  try {
    if (refresh) {
      if (!config.screenshotApiKey) {
        return res.status(503).json({ error: 'Refresh is not configured on this server' });
      }
      const apiKey = req.get('X-API-Key') || '';
      if (apiKey !== config.screenshotApiKey) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const cached = refresh ? null : await getCachedScreenshot(cacheOptions);

    if (cached) {
      const contentType = format === 'png' ? 'image/png' : 'image/jpeg';
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': cached.buffer.length,
        'X-Cache': 'HIT',
        'X-Response-Time': `${Date.now() - requestStartedAt}ms`,
        'X-Revalidate': 'scheduled',
      });
      res.end(cached.buffer, 'binary');
      scheduleBackgroundRevalidate(url, cacheOptions, cached.meta);
      return;
    }

    const { buffer, validators } = await queue.add(() =>
      captureScreenshot(url, {
        width,
        height,
        format,
        fullPage,
        timeout: config.screenshotTimeout,
      }),
    );
    await setCachedScreenshot(cacheOptions, buffer, validators, config.cacheTtlSeconds);

    const contentType = format === 'png' ? 'image/png' : 'image/jpeg';
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': buffer.length,
      'X-Cache': refresh ? 'REFRESH' : 'MISS',
      'X-Response-Time': `${Date.now() - requestStartedAt}ms`,
    });
    res.end(buffer, 'binary');
  } catch (err) {
    console.error('[screenshot]', err.message);
    res.status(502).json({
      error: 'No se pudo generar la captura',
      detail: err.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await initBrowser();
  await initCache();

  app.listen(config.port, () => {
    console.log(`Screenshot API listening on http://localhost:${config.port}`);
  });
}

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down resources...`);
  await Promise.allSettled([disconnectCache(), closeBrowser()]);
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  await start();
} catch (err) {
  console.error('Failed to start screenshot API', err);
  process.exit(1);
}
