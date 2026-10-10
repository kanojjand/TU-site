// Polite HTTP client for the scraper: a few parallel requests started at a
// steady pace that slows down when the server answers 429, retries, and an
// on-disk cache so re-runs do not hit the university server again.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Outside the project by default, so cloud-synced folders (OneDrive, Dropbox)
// do not upload a thousand cached pages. Override with SCRAPE_CACHE_DIR.
const CACHE_DIR = path.resolve(process.env.SCRAPE_CACHE_DIR || path.join(os.tmpdir(), 'tashenev-site-cache'));
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const hash = (value) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);

function createLimiter(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active += 1;
    const { task, resolve, reject } = queue.shift();
    task()
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
  };
  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
}

const limit = createLimiter(3);

// Minimum gap between request starts; doubles on "429 Too Many Requests" and
// slowly recovers while the server is happy.
const MIN_INTERVAL = 300;
const MAX_INTERVAL = 5000;
let interval = MIN_INTERVAL;
let nextSlot = 0;

async function pace() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + interval;
  if (wait) await sleep(wait);
}

async function request(url, { binary = false } = {}) {
  let lastError = '';
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await pace();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ru-RU,ru;q=0.9' },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      });
      if (res.status === 404 || res.status === 410) return { status: res.status, url: res.url, body: null };
      if (res.status === 429 || res.status === 503) {
        interval = Math.min(interval * 2, MAX_INTERVAL);
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 4000 * attempt);
        lastError = `HTTP ${res.status}`;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
      interval = Math.max(MIN_INTERVAL, interval * 0.97);
      return { status: res.status, url: res.url, body };
    } catch (error) {
      lastError = error.message;
      await sleep(1500 * attempt);
    }
  }
  return { status: 0, url, body: null, error: lastError };
}

/**
 * Fetch an HTML page. Returns { status, url (after redirects), body, error? };
 * body is null for 404s and network failures. Successful and 404 responses are cached.
 */
export async function getPage(url) {
  const file = path.join(CACHE_DIR, 'pages', `${hash(url)}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    // not cached yet
  }
  const res = await limit(() => request(url));
  if (res.status !== 0) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(res));
  }
  return res;
}

/**
 * Fetch a binary file (an image) as a Buffer, or null when it cannot be downloaded.
 * Not cached: the resized copy in public/media already serves as the cache.
 */
export async function getBinary(url) {
  const res = await limit(() => request(url, { binary: true }));
  return res.body;
}
