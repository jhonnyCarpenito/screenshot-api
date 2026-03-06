import express from 'express';
import cors from 'cors';
import { captureScreenshot } from './capture.js';

const app = express();
const PORT = process.env.PORT || 4000;

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

/**
 * GET /screenshot?url=https://example.com
 * Query: url (required), width, height, format=jpeg|png, fullPage=true|false
 */
app.get('/screenshot', async (req, res) => {
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

  try {
    const buffer = await captureScreenshot(url, {
      width,
      height,
      format,
      fullPage,
      timeout: 20000,
    });

    const contentType = format === 'png' ? 'image/png' : 'image/jpeg';
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': buffer.length,
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

app.listen(PORT, () => {
  console.log(`Screenshot API listening on http://localhost:${PORT}`);
});
