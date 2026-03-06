import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const DEFAULT_TIMEOUT = 15000;

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

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: { width, height },
      ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
    });

    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: 'load',
      timeout,
    });
    // Dar tiempo a pintado y, si hay Cloudflare, a que resuelva la verificación automática
    await new Promise((r) => setTimeout(r, 2500));

    const buffer = await page.screenshot({
      type: format,
      fullPage,
      ...(format === 'jpeg' ? { quality: 90 } : {}),
    });

    await context.close();
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}
