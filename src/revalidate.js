import { config } from './config.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function normalizeEtag(tag) {
  if (!tag) return '';
  return String(tag).trim();
}

async function drainBody(res) {
  try {
    if (res.body?.cancel) {
      await res.body.cancel();
      return;
    }
  } catch {
    // ignore
  }
  try {
    await res.arrayBuffer();
  } catch {
    // ignore
  }
}

function headersDifferFromStored(res, storedEtag, storedLm) {
  const newEtag = normalizeEtag(res.headers.get('etag') ?? '');
  const newLm = (res.headers.get('last-modified') ?? '').trim();
  if (storedEtag && newEtag && newEtag !== storedEtag) return true;
  if (storedLm && newLm && newLm !== storedLm) return true;
  return false;
}

async function tryConditionalGet(url, storedEtag, storedLm) {
  const conditionalHeaders = {
    'User-Agent': USER_AGENT,
    ...(storedEtag ? { 'If-None-Match': storedEtag } : {}),
    ...(storedLm ? { 'If-Modified-Since': storedLm } : {}),
  };
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(config.revalidateRequestTimeoutMs),
    headers: conditionalHeaders,
  });
  if (res.status === 304) return false;
  if (res.status === 200 && (storedEtag || storedLm)) {
    await drainBody(res);
    return true;
  }
  return false;
}

/**
 * Indica si el origen HTTP sugiere que el documento cambió respecto a los validadores guardados.
 * @param {string} url
 * @param {{ etag?: string, lastModified?: string }} stored
 * @returns {Promise<boolean>} true → conviene invalidar la captura en caché
 */
export async function originContentChanged(url, stored) {
  const storedEtag = stored.etag ? normalizeEtag(stored.etag) : '';
  const storedLm = stored.lastModified ? String(stored.lastModified).trim() : '';
  if (!storedEtag && !storedLm) return false;

  try {
    const headRes = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(config.revalidateRequestTimeoutMs),
      headers: { 'User-Agent': USER_AGENT },
    });

    if (headRes.status === 405 || headRes.status === 501) {
      return tryConditionalGet(url, storedEtag, storedLm);
    }

    if (headRes.status === 304) return false;
    if (headRes.ok) return headersDifferFromStored(headRes, storedEtag, storedLm);
  } catch {
    return false;
  }

  return false;
}
