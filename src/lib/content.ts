// Typed access to the JSON produced by `npm run scrape` (scripts/scrape.mjs).
import homeData from '../data/home.json';
import leadershipData from '../data/leadership.json';
import siteData from '../data/site.json';

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

const values = <T>(modules: Record<string, T>): T[] => Object.values(modules);

export const pages = values(import.meta.glob<Page>('../data/pages/*.json', { eager: true, import: 'default' }));
export const news = values(import.meta.glob<NewsItem>('../data/news/*.json', { eager: true, import: 'default' })).sort(
  (a, b) => b.id - a.id,
);
export const faculties = values(
  import.meta.glob<Faculty>('../data/faculties/*.json', { eager: true, import: 'default' }),
).sort((a, b) => a.id - b.id);
export const departments = values(
  import.meta.glob<Department>('../data/departments/*.json', { eager: true, import: 'default' }),
).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
export const people = values(import.meta.glob<Person>('../data/people/*.json', { eager: true, import: 'default' }));

export const home = homeData;
export const site = siteData;
export const leadership = leadershipData as { groups: { title: string; people: Leader[] }[] };
export const categories: Category[] = siteData.categories;

export const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
export const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
export const facultyById = new Map(faculties.map((faculty) => [faculty.id, faculty]));

/** Every path the site generates; used to hide menu entries whose page could not be migrated. */
const routes = new Set<string>(['/', '/news/', '/faculties/', '/departments/', '/leadership/', '/search/', '/sitemap/']);
for (const page of pages) routes.add(`/${page.slug}/`);
for (const item of news) routes.add(`/news/${item.id}/`);
for (const faculty of faculties) routes.add(`/faculties/${faculty.id}/`);
for (const department of departments) routes.add(`/departments/${department.id}/`);
for (const person of people) routes.add(`/leadership/${person.id}/`);
for (const category of categories) routes.add(`/news/category/${category.slug}/`);

export const isInternal = (href: string) => href.startsWith('/') && !href.startsWith('//');
export const hasRoute = (href: string) => !isInternal(href) || routes.has(href);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix a site-relative path with the deploy base (needed when the site lives under a sub-path). */
export function url(path: string): string {
  return isInternal(path) ? `${BASE}${path}` : path;
}

/** Same as url() for every href/src inside migrated HTML. */
export function withBase(html: string): string {
  return BASE ? html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`) : html;
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** "2026-10-09" -> "9 октября 2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Russian plural: plural(3, ['кафедра', 'кафедры', 'кафедр']) -> "3 кафедры" */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${word}`;
}

export function categoryName(slug: string): string {
  return categoryBySlug.get(slug)?.name ?? 'Новости';
}

/** Short plain-text description for meta tags. */
export function summarize(html: string, max = 160): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : text;
}

export const ORIGINAL_SITE = siteData.source;
