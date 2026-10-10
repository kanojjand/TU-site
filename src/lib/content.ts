// Typed access to the JSON produced by `npm run scrape` (scripts/scrape.mjs).
// Each language has its own folder, src/data/<lang>/; images are shared.
import { LANGS, LOCALE, PREFIX, localize, stripLang, type Lang } from '../i18n';

export interface Img {
  src: string;
  width: number | null;
  height: number | null;
}

export interface Page {
  slug: string;
  title: string;
  description: string;
  hero: Img | null;
  html: string;
  source: string;
}

export interface NewsItem {
  id: number;
  title: string;
  date: string | null;
  rawDate: string | null;
  category: string;
  cover: Img | null;
  /** Where the cover came from: the item's own header photo, its gallery or its text. */
  coverSource: 'hero' | 'gallery' | 'body' | null;
  excerpt: string;
  html: string;
  gallery: string[];
  source: string;
}

export interface Contact {
  label: string;
  value: string;
  href: string | null;
}

export interface Head {
  role: string;
  name: string;
  photo: Img | null;
  bio: string;
  contacts: Contact[];
}

export interface Faculty {
  id: number;
  name: string;
  title: string;
  hero: Img | null;
  html: string;
  head: Head | null;
  departments: { id: number; name: string }[];
  source: string;
}

export interface Department {
  id: number;
  name: string;
  title: string;
  facultyId: number | null;
  hero: Img | null;
  html: string;
  head: Head | null;
  video: string | null;
  source: string;
}

export interface Person {
  id: number;
  name: string;
  photo: Img | null;
  html: string;
  source: string;
}

export interface Leader {
  id: number | null;
  name: string;
  position: string;
  summary: string;
  email: string | null;
  photo: Img | null;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
}

export interface Home {
  slides: { title: string; text: string; image: Img | null }[];
  stats: { value: string; label: string }[];
  steps: { number: string; title: string; text: string; links: { title: string; href: string }[] }[];
  rector: { title: string; text: string; name: string; photo: Img | null; href: string | null }[];
  links: { title: string; href: string }[];
}

export interface Site {
  menu: { title: string; href: string | null; items: { title: string; href: string }[] }[];
  socials: { title: string; href: string }[];
  contacts: { address: string | null; phone: string | null; email: string | null };
  categories: Category[];
  /** This language's root on the old site. */
  source: string;
}

type Modules<T> = Record<string, T>;

/** "../data/kz/pages/about.json" -> "kz" */
const langOf = (file: string) => file.split('/')[2] as Lang;

function byLang<T>(modules: Modules<T>): Record<Lang, T[]> {
  const out = Object.fromEntries(LANGS.map((lang) => [lang, [] as T[]])) as Record<Lang, T[]>;
  for (const [file, value] of Object.entries(modules)) out[langOf(file)]?.push(value);
  return out;
}

// Vite reads the glob options statically, so each call spells them out.
const allPages = byLang(import.meta.glob<Page>('../data/*/pages/*.json', { eager: true, import: 'default' }));
const allNews = byLang(import.meta.glob<NewsItem>('../data/*/news/*.json', { eager: true, import: 'default' }));
const allFaculties = byLang(import.meta.glob<Faculty>('../data/*/faculties/*.json', { eager: true, import: 'default' }));
const allDepartments = byLang(import.meta.glob<Department>('../data/*/departments/*.json', { eager: true, import: 'default' }));
const allPeople = byLang(import.meta.glob<Person>('../data/*/people/*.json', { eager: true, import: 'default' }));
const allHome = byLang(import.meta.glob<Home>('../data/*/home.json', { eager: true, import: 'default' }));
const allSite = byLang(import.meta.glob<Site>('../data/*/site.json', { eager: true, import: 'default' }));
const allLeadership = byLang(
  import.meta.glob<{ groups: { title: string; people: Leader[] }[] }>('../data/*/leadership.json', { eager: true, import: 'default' }),
);

/** Languages that have been migrated; a language without src/data/<lang>/site.json is not built. */
export const availableLangs: Lang[] = LANGS.filter((lang) => allSite[lang].length > 0);

function load(lang: Lang) {
  const site = allSite[lang][0];
  const pages = allPages[lang];
  const news = [...allNews[lang]].sort((a, b) => b.id - a.id);
  const faculties = [...allFaculties[lang]].sort((a, b) => a.id - b.id);
  const departments = [...allDepartments[lang]].sort((a, b) => a.name.localeCompare(b.name, LOCALE[lang]));
  const people = allPeople[lang];
  const categories = site.categories;
  const prefix = PREFIX[lang];

  /** Every path this language generates; used to hide menu entries whose page could not be migrated. */
  const routes = new Set<string>(
    ['/', '/news/', '/faculties/', '/departments/', '/leadership/', '/search/', '/sitemap/'].map((route) => prefix + route),
  );
  for (const page of pages) routes.add(`${prefix}/${page.slug}/`);
  for (const item of news) routes.add(`${prefix}/news/${item.id}/`);
  for (const faculty of faculties) routes.add(`${prefix}/faculties/${faculty.id}/`);
  for (const department of departments) routes.add(`${prefix}/departments/${department.id}/`);
  for (const person of people) routes.add(`${prefix}/leadership/${person.id}/`);
  for (const category of categories) routes.add(`${prefix}/news/category/${category.slug}/`);

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

  return {
    lang,
    site,
    home: allHome[lang][0],
    leadership: allLeadership[lang][0] ?? { groups: [] },
    pages,
    news,
    faculties,
    departments,
    people,
    categories,
    pageBySlug: new Map(pages.map((page) => [page.slug, page])),
    categoryBySlug,
    facultyById: new Map(faculties.map((faculty) => [faculty.id, faculty])),
    /** True for external links and for internal paths this language has a page for. */
    hasRoute: (href: string) => !isInternal(href) || routes.has(href),
    categoryName: (slug: string) => categoryBySlug.get(slug)?.name ?? categories[0]?.name ?? slug,
    /** This language's root on the old site, e.g. https://tashenev.edu.kz/kz */
    originalSite: site.source,
  };
}

export type Content = ReturnType<typeof load>;
const cache = new Map<Lang, Content>();

/** Everything migrated for one language. */
export function getContent(lang: Lang): Content {
  if (!cache.has(lang)) cache.set(lang, load(lang));
  return cache.get(lang)!;
}

export const isInternal = (href: string) => href.startsWith('/') && !href.startsWith('//');

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix a site-relative path with the deploy base (needed when the site lives under a sub-path). */
export function url(path: string): string {
  return isInternal(path) ? `${BASE}${path}` : path;
}

/** The opposite of url(): a request path without the deploy base. */
export function sitePath(pathname: string): string {
  return (BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname) || '/';
}

/**
 * The same page in every migrated language: its path there when it exists,
 * otherwise that language's home page (for the language switcher and hreflang).
 */
export function languageLinks(path: string) {
  const neutral = stripLang(path);
  return availableLangs.map((lang) => {
    const target = localize(neutral, lang);
    const exists = getContent(lang).hasRoute(target);
    return { lang, path: exists ? target : localize('/', lang), exists };
  });
}

/** Same as url() for every href/src inside migrated HTML. */
export function withBase(html: string): string {
  return BASE ? html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`) : html;
}

/** Short plain-text description for meta tags. */
export function summarize(html: string, max = 160): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : text;
}
