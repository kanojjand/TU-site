// Downloads images from the old site once and stores resized WebP copies in
// public/media/<preset>/, so the new site serves light, predictable files.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getBinary, hash } from './http.mjs';

const OUT_DIR = path.resolve('public/media');

const PRESETS = {
  hero: { width: 1600, quality: 68 },
  content: { width: 1200, quality: 72 },
  card: { width: 800, quality: 62 },
  person: { width: 480, quality: 76 },
};

const pending = new Map();

/** URLs that could not be downloaded or decoded, reported at the end of a run. */
export const imageFailures = [];

/**
 * Local copy of a remote image: { src: '/media/card/ab12-960.webp', width, height },
 * or null when the image is unavailable. Each URL/preset pair is processed once per run.
 */
export function localImage(url, preset = 'content') {
  if (!url) return Promise.resolve(null);
  const key = `${preset}|${url}`;
  if (!pending.has(key)) pending.set(key, convert(url, preset));
  return pending.get(key);
}

async function convert(url, preset) {
  const { width, quality } = PRESETS[preset];
  const isSvg = /\.svg$/i.test(new URL(url).pathname);
  const name = isSvg ? `${hash(url)}.svg` : `${hash(url)}-${width}.webp`;
  const dir = path.join(OUT_DIR, preset);
  const file = path.join(dir, name);
  const src = `/media/${preset}/${name}`;

  if (isSvg) {
    const input = await getBinary(url);
    if (!input) return fail(url);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, input);
    return { src, width: null, height: null };
  }

  try {
    const meta = await sharp(file).metadata();
    return { src, width: meta.width, height: meta.height };
  } catch {
    // not converted yet
  }

  const input = await getBinary(url);
  if (!input) return fail(url);
  try {
    await fs.mkdir(dir, { recursive: true });
    const info = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toFile(file);
    return { src, width: info.width, height: info.height };
  } catch (error) {
    return fail(`${url} (${error.message})`);
  }
}

function fail(reason) {
  imageFailures.push(reason);
  return null;
}
