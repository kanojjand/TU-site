// URL helpers shared by the scraper: where things live on the old site and
// which path the same content gets in the new one.

export const ORIGIN = 'https://tashenev.edu.kz';

/** "Медиатека" sections of the old site (/ru/media/<id>) and their slugs in the new site. */
export const MEDIA_CATEGORIES = [
  { id: 1, slug: 'novosti', name: 'Новости' },
  { id: 2, slug: 'obyavleniya', name: 'Объявления' },
  { id: 3, slug: 'pozdravleniya', name: 'Поздравления' },
  { id: 4, slug: 'fotogalereya', name: 'Фотогалерея' },
  { id: 5, slug: 'videoteka', name: 'Видеотека' },
  { id: 6, slug: 'smi-o-nas', name: 'СМИ о нас' },
  { id: 7, slug: 'scopus', name: 'Статьи Scopus' },
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

/**
 * Path of the matching page in the new site for an absolute URL of the old one,
 * or null when the target stays on the old site (other languages, files, external sites).
 */
export function localPath(abs) {
  const url = new URL(abs);
  if (!OWN_HOSTS.has(url.hostname) || fileExtension(abs)) return null;
  const path = decodePath(url.pathname).replace(/\/+$/, '');
  if (path === '' || path === '/ru') return '/';
  if (!path.startsWith('/ru/')) return null;

  const rest = path.slice(4).toLowerCase();
  let m;
  if (rest === 'media') return '/news/';
  if ((m = rest.match(/^media\/item\/(\d+)$/))) return `/news/${m[1]}/`;
  if ((m = rest.match(/^media\/(\d+)$/))) {
    const category = MEDIA_CATEGORIES.find((c) => c.id === Number(m[1]));
    return category ? `/news/category/${category.slug}/` : '/news/';
  }
  if (rest === 'faculties') return '/faculties/';
  if ((m = rest.match(/^faculties\/(\d+)$/))) return `/faculties/${m[1]}/`;
  if (rest === 'departments') return '/departments/';
  if ((m = rest.match(/^department\/(\d+)$/))) return `/departments/${m[1]}/`;
  if (rest === 'leadership') return '/leadership/';
  if ((m = rest.match(/^leadership-in\/(\d+)$/))) return `/leadership/${m[1]}/`;
  if (/^[a-z0-9-]+$/.test(rest)) return `/${rest}/`;
  return null;
}
