import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

let pluginRegistered = false;
let browserPromise = null;
let browser = null;

function getLaunchOptions() {
  return {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  };
}

function registerStealthPlugin() {
  if (pluginRegistered) return;
  chromium.use(StealthPlugin());
  pluginRegistered = true;
}

async function launchBrowser() {
  registerStealthPlugin();
  const launchedBrowser = await chromium.launch(getLaunchOptions());
  launchedBrowser.on('disconnected', () => {
    browser = null;
    browserPromise = null;
  });
  return launchedBrowser;
}

export async function initBrowser() {
  if (browser) return browser;
  if (!browserPromise) {
    browserPromise = launchBrowser()
      .then((launched) => {
        browser = launched;
        return launched;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

export async function getContext(contextOptions = {}) {
  const activeBrowser = await initBrowser();
  return activeBrowser.newContext(contextOptions);
}

export async function closeBrowser() {
  if (!browser && !browserPromise) return;
  const activeBrowser = browser || (await browserPromise);
  browser = null;
  browserPromise = null;
  await activeBrowser.close();
}
