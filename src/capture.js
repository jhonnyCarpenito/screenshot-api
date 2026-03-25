import { getContext } from './browserManager.js';
import { config } from './config.js';

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const DEFAULT_TIMEOUT = config.screenshotTimeout;
const TRACKING_PATTERN = /google-analytics|gtag|facebook|hotjar|doubleclick|segment|clarity/i;

/**
 * Captura un screenshot de la URL dada.
 * Usa playwright-extra + stealth para reducir detección (p. ej. Cloudflare).
 * @param {string} url - URL del sitio (debe ser absoluta y http/https)
 * @param {object} options - { width, height, format: 'jpeg'|'png', fullPage }
 * @returns {Promise<Buffer>} Buffer de la imagen
 */
export async function captureScreenshot(url, options = {}) {
  const {
    width = DEFAULT_VIEWPORT.width,
    height = DEFAULT_VIEWPORT.height,
    format = 'jpeg',
    fullPage = false,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const context = await getContext({
    viewport: { width, height },
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  });
  try {
    await context.route('**/*', (route) => {
      const request = route.request();
      const type = request.resourceType();
      if (['font', 'media', 'websocket'].includes(type)) {
        return route.abort();
      }
      if (TRACKING_PATTERN.test(request.url())) {
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout,
    });
    try {
      await page.waitForLoadState('networkidle', { timeout: config.networkIdleTimeout });
    } catch {
      // No todas las páginas alcanzan networkidle rápidamente; capturamos igual.
    }

    const buffer = await page.screenshot({
      type: format,
      fullPage,
      ...(format === 'jpeg' ? { quality: config.jpegQuality } : {}),
    });

    return Buffer.from(buffer);
  } finally {
    if (context) await context.close();
  }
}
