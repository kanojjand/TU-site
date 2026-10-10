// URL helpers shared by the scraper: where things live on the old site and
// which path the same content gets in the new one.

export const ORIGIN = 'https://tashenev.edu.kz';

/** Languages of the old site (/ru, /kz, /en) and the path prefix each gets in the new one; Russian stays at the root. */
export const LANGS = { ru: '', kz: '/kz', en: '/en' };

/**
 * "Медиатека" sections of the old site (/<lang>/media/<id>) and their slugs in the new site.
 * Names are the labels the old site puts on each item, so they also identify an item's section.
 */
export const MEDIA_CATEGORIES = [
  { id: 1, slug: 'novosti', name: { ru: 'Новости', kz: 'Жаңалықтар', en: 'News' } },
  { id: 2, slug: 'obyavleniya', name: { ru: 'Объявления', kz: 'Хабарландырулар', en: 'Announcements' } },
  { id: 3, slug: 'pozdravleniya', name: { ru: 'Поздравления', kz: 'Құттықтаулар', en: 'Congratulations' } },
  { id: 4, slug: 'fotogalereya', name: { ru: 'Фотогалерея', kz: 'Фотогалерея', en: 'Photo gallery' } },
  { id: 5, slug: 'videoteka', name: { ru: 'Видеотека', kz: 'Видеотека', en: 'Video library' } },
  { id: 6, slug: 'smi-o-nas', name: { ru: 'СМИ о нас', kz: 'БАҚ біз туралы', en: 'Mass media about us' } },
  { id: 7, slug: 'scopus', name: { ru: 'Статьи Scopus', kz: 'Scopus мақалалары', en: 'Scopus articles' } },
];

const OWN_HOSTS = new Set(['tashenev.edu.kz', 'www.tashenev.edu.kz']);
const FILE_RE = /\.(pdf|docx?|xlsx?|pptx?|ppsx?|zip|rar|7z|txt|rtf|odt|ods|odp|jpe?g|png|gif|webp|mp4|mp3)$/i;

function decodePath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** Resolve a (possibly relative) link from the old site to an absolute URL, or null if it is unusable. */
export function absolute(href, base = `${ORIGIN}/ru`) {
  const value = (href || '').trim();
  if (!value || value === '#' || /^(javascript|data):/i.test(value)) return null;
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
}

export function isOwn(abs) {
  return OWN_HOSTS.has(new URL(abs).hostname);
}

/** Lower-case extension when the URL points at a downloadable file, otherwise null. */
export function fileExtension(abs) {
  const match = new URL(abs).pathname.match(FILE_RE);
  return match ? match[1].toLowerCase() : null;
}

/** Language of an old-site URL from its first path segment ("ru", "kz", "en"), or null. */
export function langOf(abs) {
  const url = new URL(abs);
  if (!OWN_HOSTS.has(url.hostname)) return null;
  return url.pathname.match(/^\/(ru|kz|en)(?=\/|$)/)?.[1] ?? null;
}

/**
 * Path of the matching page in the new site for an absolute URL of the old one,
 * or null when the target stays on the old site (files, external sites, unknown sections).
 */
export function localPath(abs) {
  const url = new URL(abs);
  if (!OWN_HOSTS.has(url.hostname) || fileExtension(abs)) return null;
  const path = decodePath(url.pathname).replace(/\/+$/, '');
  if (path === '') return '/';
  const lang = langOf(abs);
  if (!lang) return null;

  const prefix = LANGS[lang];
  const rest = path.slice(lang.length + 2).toLowerCase();
  let m;
  if (rest === '') return `${prefix}/`;
  if (rest === 'media') return `${prefix}/news/`;
  if ((m = rest.match(/^media\/item\/(\d+)$/))) return `${prefix}/news/${m[1]}/`;
  if ((m = rest.match(/^media\/(\d+)$/))) {
    const category = MEDIA_CATEGORIES.find((c) => c.id === Number(m[1]));
    return category ? `${prefix}/news/category/${category.slug}/` : `${prefix}/news/`;
  }
  if (rest === 'faculties') return `${prefix}/faculties/`;
  if ((m = rest.match(/^faculties\/(\d+)$/))) return `${prefix}/faculties/${m[1]}/`;
  if (rest === 'departments') return `${prefix}/departments/`;
  if ((m = rest.match(/^department\/(\d+)$/))) return `${prefix}/departments/${m[1]}/`;
  if (rest === 'leadership') return `${prefix}/leadership/`;
  if ((m = rest.match(/^leadership-in\/(\d+)$/))) return `${prefix}/leadership/${m[1]}/`;
  if (/^[a-z0-9-]+$/.test(rest)) return `${prefix}/${rest}/`;
  return null;
}
