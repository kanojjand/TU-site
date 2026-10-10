#!/usr/bin/env node
// Migrates the Russian version of tashenev.edu.kz into JSON files under
// src/data and resized images under public/media. Pages and images are cached
// in .cache/, so re-running only rebuilds the output.
//
//   npm run scrape                       everything (~1400 pages; 10–20 min the first time)
//   npm run scrape -- --news-limit=40    only the 40 newest news items (quick check)

import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { cleanHtml, excerpt, fixMixedScript, internalLinks } from './lib/clean.mjs';
import { getPage } from './lib/http.mjs';
import { imageFailures, localImage } from './lib/images.mjs';
import { MEDIA_CATEGORIES, ORIGIN, absolute, localPath } from './lib/routes.mjs';

const DATA_DIR = path.resolve('src/data');
const GENERATED_DIRS = ['pages', 'news', 'faculties', 'departments', 'people'];
const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const NEWS_LIMIT = Number(args['news-limit']) || Infinity;
const TODAY = new Date().toISOString().slice(0, 10);

const report = { generatedAt: new Date().toISOString(), counts: {}, missing: [], redirected: [], deadLinks: [], imageFailures };

const squash = (value) => fixMixedScript((value || '').replace(/\s+/g, ' ').trim());

/** Load a page; null when it is missing or redirects somewhere else (both are recorded in the report). */
async function load(url) {
  const res = await getPage(url);
  if (!res.body) {
    report.missing.push({ url, status: res.status, ...(res.error ? { error: res.error } : {}) });
    return null;
  }
  const asked = new URL(url).pathname.replace(/\/+$/, '');
  const landed = new URL(res.url).pathname.replace(/\/+$/, '');
  if (asked !== landed) {
    report.redirected.push({ url, to: res.url });
    return null;
  }
  return cheerio.load(res.body);
}

/** Link target for structured fields: a path in the new site when there is one, else the absolute URL. */
function link(href, base) {
  const abs = absolute(href, base);
  if (!abs) return null;
  const local = localPath(abs);
  if (!local) return abs;
  internalLinks.set(local, abs);
  return local;
}

function canonical(abs) {
  const url = new URL(abs);
  url.hash = '';
  url.search = '';
  return url.href.replace(/\/+$/, '');
}

/** ISO date if the value looks like a real publication date, otherwise null. */
function validDate(raw) {
  const m = (raw || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return Number(m[1]) >= 2010 && iso <= TODAY ? iso : null;
}

async function readHero($, base, preset = 'hero') {
  const $wrap = $('main .title_img__wrap').first();
  const src = absolute($wrap.find('.title_img__photo').attr('src'), base);
  return {
    title: squash($wrap.find('.title_img__name').text()),
    description: squash($wrap.find('.title_img__description').text()),
    image: src ? await localImage(src, preset) : null,
  };
}

/** Drop the first heading or paragraph of the body when it just repeats the page title. */
// A date at the end of a title: "… 17.09.2026г", "… 03.02.2026 ж.", sometimes with a Latin "r".
const TRAILING_DATE = /\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s*(?:г|ж|r)?\.?\s*$/i;

function withoutLeadingTitle(html, title) {
  const $ = cheerio.load(html, null, false);
  const $first = $.root().children().first();
  // Same words in the same order: spacing, punctuation and a trailing date do not count.
  const normalize = (text) => squash(text).replace(TRAILING_DATE, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const key = normalize(title);
  if (key && $first.is('h2, h3, h4, p') && normalize($first.text()) === key) $first.remove();
  return ($.root().html() || '').trim();
}

/** "Head of institute / department" block used on faculty and department pages. */
async function readHead($, $main, base) {
  const $box = $main.find('.head_department__subtitle').first().closest('section');
  const name = squash($box.find('.head_department__subtitle').first().text());
  if (!name) return null;
  const contacts = [];
  $box.find('.head_department__contact').each((_, el) => {
    const [label, ...rest] = squash($(el).text()).split(':');
    const value = rest.join(':').trim();
    if (!value) return;
    let href = ($(el).find('a').attr('href') || '').trim();
    if (!href || href === '#') {
      if (value.includes('@')) href = `mailto:${value}`;
      else if (value.replace(/\D/g, '').length >= 6) href = `tel:${value.replace(/[^\d+]/g, '')}`;
    }
    contacts.push({ label: label.trim(), value, href: href || null });
  });
  const photoUrl = absolute($box.find('img').first().attr('src'), base);
  return {
    role: squash($box.find('.head_department__title, .section__title').first().text()),
    name,
    photo: photoUrl ? await localImage(photoUrl, 'person') : null,
    bio: await cleanHtml($box.find('.head_department__text').html() || '', { base }),
    contacts,
  };
}

async function scrapePage(url, $, label) {
  const slug = localPath(url).replace(/^\/|\/$/g, '');
  const hero = await readHero($, url);
  const $main = $('main').first().clone();
  $main.find('.title_img__wrap').remove();
  const title = hero.title || squash($main.find('h1, h2, .section__title').first().text()) || label || slug;
  const html = withoutLeadingTitle(await cleanHtml($main.html() || '', { base: url }), title);
  return { slug, title, description: hero.description, hero: hero.image, html, source: url };
}

async function scrapeFaculty(id, url, $) {
  const hero = await readHero($, url);
  const $main = $('main').first();
  const departments = [];
  $main.find('a.list_curriculum, .list_curriculum a').each((_, el) => {
    const m = (absolute($(el).attr('href'), url) || '').match(/\/department\/(\d+)/);
    if (m && !departments.some((d) => d.id === Number(m[1]))) {
      departments.push({ id: Number(m[1]), name: squash($(el).find('.list_curriculum__name').text() || $(el).text()) });
    }
  });
  let $about = $main.find('.section_corporate .left_col').first();
  if (!$about.length) {
    $about = $main.clone();
    $about.find('.title_img__wrap, .list_curriculum__wrap').remove();
    $about.find('.head_department__subtitle').closest('section').remove();
  }
  return {
    id,
    title: hero.title,
    hero: hero.image,
    html: await cleanHtml($about.html() || '', { base: url }),
    head: await readHead($, $main, url),
    departments,
    source: url,
  };
}

async function scrapeDepartment(id, url, $) {
  const hero = await readHero($, url);
  const $main = $('main').first();
  const $content = $main.clone();
  $content.find('.title_img__wrap, .video_box__wrap').remove();
  $content.find('.head_department__subtitle').closest('section').remove();
  const video = absolute($main.find('.video_box__wrap iframe').attr('src'), url);
  return {
    id,
    title: hero.title,
    hero: hero.image,
    html: await cleanHtml($content.html() || '', { base: url }),
    head: await readHead($, $main, url),
    video,
    source: url,
  };
}

async function scrapeLeadership(url, $) {
  const groups = [];
  let current = null;
  const cards = [];
  $('main')
    .find('.section__title, .leader')
    .each((_, el) => {
      const $el = $(el);
      if ($el.hasClass('section__title')) {
        current = { title: squash($el.text()), people: [] };
        groups.push(current);
        return;
      }
      if (!current) {
        current = { title: '', people: [] };
        groups.push(current);
      }
      cards.push({ group: current, $el });
    });
  for (const { group, $el } of cards) {
    const m = (absolute($el.find('.leader__goto').attr('href'), url) || '').match(/leadership-in\/(\d+)/);
    const email = squash($el.find('.leader__contact').text()).replace(/^e-?mail:\s*/i, '');
    const photoUrl = absolute($el.find('.leader__img').attr('src'), url);
    group.people.push({
      id: m ? Number(m[1]) : null,
      name: squash($el.find('.leader__name').text()),
      position: group.title,
      summary: await cleanHtml($el.find('.leader__description').html() || '', { base: url }),
      email: email.includes('@') ? email : null,
      photo: photoUrl ? await localImage(photoUrl, 'person') : null,
    });
  }
  return { groups: groups.filter((g) => g.people.length) };
}

async function scrapePerson(id, url, $) {
  const hero = await readHero($, url);
  const $section = $('main .leaderPageItem').first().length ? $('main .leaderPageItem').first().clone() : $('main').first().clone();
  $section.find('.title_img__wrap').remove();
  const photoUrl = absolute($section.find('img').first().attr('src'), url);
  $section.find('img').first().remove();
  return {
    id,
    name: hero.title,
    photo: photoUrl ? await localImage(photoUrl, 'person') : null,
    html: await cleanHtml($section.html() || '', { base: url }),
    source: url,
  };
}

/** Drop a trailing "17.09.2026г" (the card shows the date) unless the title is little more than that date. */
function withoutTrailingDate(title) {
  const trimmed = title.replace(TRAILING_DATE, '').trim();
  return trimmed.split(/\s+/).length >= 3 ? trimmed : title;
}

async function scrapeNewsItem(id, url, $, meta) {
  const $hero = $('main .title_img__wrap').first();
  const heroTitle = squash($hero.find('.title_img__name').text());
  const heroUrl = absolute($hero.find('.title_img__photo').attr('src'), url);
  const $section = $('main .section_history').first().length ? $('main .section_history').first() : $('main').first();
  const gallery = [];
  $section.find('.imgsBlockInNewItem a[href], .imgsBlockInNewItem img').each((_, el) => {
    const src = absolute($(el).attr('href') || $(el).attr('src'), url);
    if (src && /\.(jpe?g|png|webp|gif)$/i.test(new URL(src).pathname) && !gallery.includes(src)) gallery.push(src);
  });
  const $body = ($section.find('.text_p').first().length ? $section.find('.text_p').first() : $section).clone();
  $body.find('.imgsBlockInNewItem').remove();
  const fullTitle = heroTitle || meta.title || `Новость №${id}`;
  const title = withoutTrailingDate(fullTitle);
  const html = withoutLeadingTitle(await cleanHtml($body.html() || '', { base: url }), fullTitle);
  const $firstImage = cheerio.load(html, null, false)('img').first();
  return {
    id,
    title,
    date: meta.date,
    rawDate: meta.rawDate || null,
    category: meta.category,
    cover: null,
    coverSource: null,
    excerpt: excerpt(html),
    html,
    gallery,
    source: url,
    // used to pick the cover once all items are known
    heroUrl,
    bodyImage: $firstImage.length
      ? { src: $firstImage.attr('src'), width: Number($firstImage.attr('width')) || null, height: Number($firstImage.attr('height')) || null }
      : null,
  };
}

/**
 * The old site shows the same stock photo in the header of every news item; the real
 * photos are in the galleries. Cover = own header photo, else first gallery photo,
 * else first picture of the text.
 */
async function chooseCovers(news) {
  const heroUses = new Map();
  for (const item of news) if (item.heroUrl) heroUses.set(item.heroUrl, (heroUses.get(item.heroUrl) || 0) + 1);
  let done = 0;
  await Promise.all(
    news.map(async (item) => {
      if (item.heroUrl && heroUses.get(item.heroUrl) <= 3) {
        item.cover = await localImage(item.heroUrl, 'card');
        item.coverSource = item.cover ? 'hero' : null;
      }
      if (!item.cover && item.gallery[0]) {
        item.cover = await localImage(item.gallery[0], 'card');
        item.coverSource = item.cover ? 'gallery' : null;
      }
      if (!item.cover && item.bodyImage?.src) {
        item.cover = item.bodyImage;
        item.coverSource = 'body';
      }
      delete item.heroUrl;
      delete item.bodyImage;
      done += 1;
      if (done % 100 === 0 || done === news.length) console.log(`  обложки: ${done}/${news.length}`);
    }),
  );
}

// Titles the old site takes from link text, writes in capitals or with typos.
const PAGE_FIXES = {
  bachelor: { title: 'Бакалавриат' },
  magistracy: { title: 'Магистратура', description: 'Приём в магистратуру в 2026–2027 учебном году' },
  freshman: { title: 'Первокурснику' },
  leadership: { title: 'Руководство университета' },
  contacts: { title: 'Контакты' },
  question: { title: 'Открытый ректорат: вопросы и ответы' },
  'accreditation-licensing': { title: 'Центр аккредитации и лицензирования' },
};

function fixPage(page) {
  Object.assign(page, PAGE_FIXES[page.slug] ?? {});
  page.title = page.title.replace(/^\p{Extended_Pictographic}️?\s*/u, '').replace(/\.$/, '');
  return page;
}

/** /ru/media lists every item with its date and a "Новости"/"Объявления" label. */
async function scrapeMediaIndex() {
  const $ = await load(`${ORIGIN}/ru/media`);
  const items = new Map();
  if (!$) return items;
  $('.section_news__block').each((_, el) => {
    const $el = $(el);
    const m = (absolute($el.find('a.section_news__title').attr('href')) || '').match(/media\/item\/(\d+)/);
    if (!m) return;
    const rawDate = squash($el.find('.section_news__date').text());
    items.set(Number(m[1]), {
      title: squash($el.find('.section_news__title').text()),
      rawDate,
      date: validDate(rawDate),
      label: squash($el.find('.section_news__type').text()),
    });
  });
  $('.fresh_news').each((_, el) => {
    const m = (absolute($(el).find('a[href*="/media/item/"]').attr('href')) || '').match(/media\/item\/(\d+)/);
    if (!m) return;
    const item = items.get(Number(m[1])) || { title: squash($(el).find('.fresh_news__title').text()), rawDate: '', date: null, label: '' };
    if (!item.date) item.date = validDate(squash($(el).find('.fresh_news__date').text()));
    items.set(Number(m[1]), item);
  });
  return items;
}

/** Category pages decide the section of each item; specific sections win over the general news feed. */
async function scrapeMediaCategories() {
  const categoryOf = new Map();
  for (const category of [...MEDIA_CATEGORIES].reverse()) {
    const $ = await load(`${ORIGIN}/ru/media/${category.id}`);
    if (!$) continue;
    let $links = $('main .section_news__block a[href*="/media/item/"]');
    if (!$links.length) $links = $('main a[href*="/media/item/"]').filter((_, a) => !$(a).closest('.fresh_news__wrap').length);
    let count = 0;
    $links.each((_, a) => {
      const m = (absolute($(a).attr('href')) || '').match(/media\/item\/(\d+)/);
      if (m && !categoryOf.has(Number(m[1]))) {
        categoryOf.set(Number(m[1]), category.slug);
        count += 1;
      }
    });
    console.log(`  раздел «${category.name}»: ${count}`);
  }
  return categoryOf;
}

async function scrapeHome($) {
  const base = `${ORIGIN}/ru`;
  // Each slide keeps its picture next to the title; the first slide plays a video instead.
  const slides = [];
  for (const el of $('.home_slider__title').toArray()) {
    const $slide = $(el).parent();
    const src = absolute($slide.find('img').first().attr('src'), base);
    slides.push({
      title: squash($(el).text()),
      text: squash($slide.find('.home_slider__text').first().text() || $(el).next().text()),
      image: src ? await localImage(src, 'hero') : null,
    });
  }
  const stats = $('.section_statistics__numb')
    .map((_, el) => ({
      value: squash($(el).find('.section_statistics__int').text()),
      label: $(el)
        .find('.section_statistics__text')
        .map((__, t) => squash($(t).text()))
        .get()
        .join(' '),
    }))
    .get();
  const steps = $('.proceed__block')
    .map((_, el) => ({
      number: squash($(el).find('.proceed__int').text()),
      title: squash($(el).find('.proceed__title').text()),
      text: squash($(el).find('.proceed__text').text()),
      links: $(el)
        .find('a')
        .map((__, a) => ({ title: squash($(a).text()), href: link($(a).attr('href'), base) }))
        .get()
        .filter((l) => l.href && l.title),
    }))
    .get();
  const rector = [];
  for (const el of $('.section_rectorat__slide').toArray()) {
    const photoUrl = absolute($(el).find('img').first().attr('src'), base);
    rector.push({
      title: squash($(el).find('.section_rectorat__title span').first().text()),
      text: squash($(el).find('.section_rectorat__description').text()),
      name: squash($(el).find('.section_rectorat__name').text()),
      photo: photoUrl ? await localImage(photoUrl, 'person') : null,
      href: link($(el).find('a.section_rectorat__btn').attr('href'), base),
    });
  }
  const links = $('.section_links a')
    .map((_, a) => ({ title: squash($(a).find('.section_links__text').text() || $(a).text()), href: link($(a).attr('href'), base) }))
    .get()
    .filter((l) => l.title && l.href);
  return { slides, stats, steps, rector, links };
}

async function scrapeSite($home) {
  const base = `${ORIGIN}/ru`;
  const menu = $home('header nav .menuItem')
    .map((_, item) => {
      const $top = $home(item).children('a.nav__link');
      return {
        title: squash($top.text()),
        href: link($top.attr('href'), base),
        items: $home(item)
          .find('.dropBlock a')
          .map((__, a) => ({ title: squash($home(a).text()), href: link($home(a).attr('href'), base) }))
          .get()
          .filter((entry) => entry.href && entry.title),
      };
    })
    .get()
    .filter((entry) => entry.title && entry.title.length > 2);

  const socials = $home('footer a[href]')
    .map((_, a) => ({ title: squash($home(a).text()), href: $home(a).attr('href') }))
    .get()
    .filter((s) => /facebook|instagram|youtube|t\.me|tiktok|vk\.com/i.test(s.href));

  const contacts = { address: null, phone: null, email: null };
  const $c = await load(`${ORIGIN}/ru/contacts`);
  if ($c) {
    const text = squash($c('main').text());
    contacts.address = (text.match(/Адрес:\s*(.+?)\.?\s*(?:Телефон|Факс|E-mail|$)/i) || [])[1] || null;
    contacts.phone = (text.match(/Телефон:\s*([+\d][\d\s()+-]{6,}\d)/i) || [])[1] || null;
    contacts.email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || null;
    $c('main a[href]').each((_, a) => {
      const href = $c(a).attr('href');
      if (/telegram|t\.me/i.test(href) && !socials.some((s) => s.href === href)) socials.push({ title: 'Telegram', href });
    });
  }
  return { menu, socials, contacts };
}

async function writeJson(file, data) {
  const target = path.join(DATA_DIR, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  console.log('Главная и меню…');
  const $home = await load(`${ORIGIN}/ru`);
  if (!$home) throw new Error('Не удалось загрузить https://tashenev.edu.kz/ru');
  const site = await scrapeSite($home);
  const home = await scrapeHome($home);

  // ---- crawl regular pages ---------------------------------------------------
  const titles = new Map();
  const seen = new Set();
  const queue = [];
  const extraNewsIds = new Set();
  const enqueue = (abs, label) => {
    if (!abs || !localPath(abs)) return;
    const url = canonical(abs);
    const itemMatch = url.match(/\/ru\/media\/item\/(\d+)$/);
    if (itemMatch) extraNewsIds.add(Number(itemMatch[1]));
    if (/\/ru\/media(\/|$)/.test(new URL(url).pathname) || localPath(url) === '/' || seen.has(url)) return;
    seen.add(url);
    queue.push(url);
    if (label && !titles.has(url)) titles.set(url, label);
  };
  $home('header a[href], footer a[href], main a[href]').each((_, a) => enqueue(absolute($home(a).attr('href')), squash($home(a).text())));
  const sitemap = await getPage(`${ORIGIN}/sitemap_ru.xml`);
  for (const m of (sitemap.body || '').matchAll(/<loc>([^<]+)<\/loc>/g)) enqueue(m[1].trim());

  console.log('Страницы…');
  const pages = [];
  const faculties = [];
  const departments = [];
  const people = [];
  let leadership = { groups: [] };
  while (queue.length) {
    const batch = queue.splice(0, queue.length);
    await Promise.all(
      batch.map(async (url) => {
        const $ = await load(url);
        if (!$) return;
        $('main a[href]').each((_, a) => enqueue(absolute($(a).attr('href'), url), squash($(a).text())));
        const local = localPath(url);
        let m;
        if ((m = local.match(/^\/faculties\/(\d+)\/$/))) faculties.push(await scrapeFaculty(Number(m[1]), url, $));
        else if ((m = local.match(/^\/departments\/(\d+)\/$/))) departments.push(await scrapeDepartment(Number(m[1]), url, $));
        else if ((m = local.match(/^\/leadership\/(\d+)\/$/))) people.push(await scrapePerson(Number(m[1]), url, $));
        else {
          if (local === '/leadership/') leadership = await scrapeLeadership(url, $);
          pages.push(await scrapePage(url, $, titles.get(url)));
        }
        console.log(`  ✓ ${local}`);
      }),
    );
  }

  // Short department names come from the footer list ("Математики и физики").
  const shortNames = new Map();
  $home('footer a[href*="/department/"]').each((_, a) => {
    const m = ($home(a).attr('href') || '').match(/department\/(\d+)/);
    if (m) shortNames.set(Number(m[1]), squash($home(a).text()));
  });
  for (const faculty of faculties) for (const d of faculty.departments) if (!shortNames.has(d.id)) shortNames.set(d.id, d.name);
  for (const department of departments) {
    department.name = shortNames.get(department.id) || department.title;
    department.facultyId = faculties.find((f) => f.departments.some((d) => d.id === department.id))?.id ?? null;
  }
  const facultyNames = new Map();
  $home('footer a[href*="/faculties/"]').each((_, a) => {
    const m = ($home(a).attr('href') || '').match(/faculties\/(\d+)/);
    if (m) facultyNames.set(Number(m[1]), squash($home(a).text()));
  });
  for (const faculty of faculties) faculty.name = facultyNames.get(faculty.id) || faculty.title;

  // ---- news ------------------------------------------------------------------
  console.log('Медиатека…');
  const index = await scrapeMediaIndex();
  const categoryOf = await scrapeMediaCategories();
  for (const id of extraNewsIds) if (!index.has(id)) index.set(id, { title: '', rawDate: '', date: null, label: '' });
  for (const id of categoryOf.keys()) if (!index.has(id)) index.set(id, { title: '', rawDate: '', date: null, label: '' });
  const ids = [...index.keys()].sort((a, b) => b - a).slice(0, NEWS_LIMIT);
  const news = [];
  let done = 0;
  await Promise.all(
    ids.map(async (id) => {
      const url = `${ORIGIN}/ru/media/item/${id}`;
      const $ = await load(url);
      if ($) {
        const meta = index.get(id);
        const category = categoryOf.get(id) || (meta.label === 'Объявления' ? 'obyavleniya' : 'novosti');
        news.push(await scrapeNewsItem(id, url, $, { ...meta, category }));
      }
      done += 1;
      if (done % 100 === 0 || done === ids.length) console.log(`  новости: ${done}/${ids.length}`);
    }),
  );
  console.log('Обложки новостей…');
  await chooseCovers(news);
  pages.forEach(fixPage);

  // ---- repair links that point to pages we could not migrate -----------------
  const routes = new Set(['/', '/news/', '/faculties/', '/departments/', '/leadership/', '/search/', '/sitemap/']);
  for (const page of pages) routes.add(`/${page.slug}/`);
  for (const f of faculties) routes.add(`/faculties/${f.id}/`);
  for (const d of departments) routes.add(`/departments/${d.id}/`);
  for (const p of people) routes.add(`/leadership/${p.id}/`);
  for (const n of news) routes.add(`/news/${n.id}/`);
  for (const c of MEDIA_CATEGORIES) routes.add(`/news/category/${c.slug}/`);
  // Pages that 404 on the old site too are dropped; others link back to the original.
  const gone = new Set(report.missing.filter((m) => m.status === 404).map((m) => canonical(m.url)));
  const dead = new Set();
  const fixHref = (href) => {
    if (!href || !href.startsWith('/') || routes.has(href)) return href;
    dead.add(href);
    const original = internalLinks.get(href);
    return original && !gone.has(canonical(original)) ? original : null;
  };
  const fixHtml = (html) => {
    if (!html || !html.includes('href="/')) return html;
    const $ = cheerio.load(html, null, false);
    $('a[href^="/"]').each((_, a) => {
      const $a = $(a);
      const href = $a.attr('href');
      if (routes.has(href)) return;
      const fixed = fixHref(href);
      if (fixed) $a.attr({ href: fixed, target: '_blank', rel: 'noopener' });
      else $a.replaceWith($a.contents());
    });
    return ($.root().html() || '').trim();
  };
  for (const item of [...pages, ...news, ...faculties, ...departments, ...people]) item.html = fixHtml(item.html);
  for (const item of [...faculties, ...departments]) if (item.head) item.head.bio = fixHtml(item.head.bio);
  for (const group of leadership.groups) for (const person of group.people) person.summary = fixHtml(person.summary);
  for (const entry of site.menu) {
    entry.href = fixHref(entry.href);
    for (const item of entry.items) item.href = fixHref(item.href);
    entry.items = entry.items.filter((item) => item.href);
  }
  for (const step of home.steps) step.links = step.links.filter((l) => (l.href = fixHref(l.href)));
  home.links = home.links.filter((l) => (l.href = fixHref(l.href)));
  for (const r of home.rector) r.href = fixHref(r.href);
  report.deadLinks = [...dead].sort();

  // ---- write -----------------------------------------------------------------
  for (const dir of GENERATED_DIRS) await fs.rm(path.join(DATA_DIR, dir), { recursive: true, force: true });
  for (const page of pages) await writeJson(`pages/${page.slug}.json`, page);
  for (const item of news) await writeJson(`news/${item.id}.json`, item);
  for (const f of faculties) await writeJson(`faculties/${f.id}.json`, f);
  for (const d of departments) await writeJson(`departments/${d.id}.json`, d);
  for (const p of people) await writeJson(`people/${p.id}.json`, p);
  await writeJson('leadership.json', leadership);
  await writeJson('home.json', home);
  await writeJson('site.json', { ...site, categories: MEDIA_CATEGORIES, source: `${ORIGIN}/ru` });

  report.counts = {
    pages: pages.length,
    news: news.length,
    faculties: faculties.length,
    departments: departments.length,
    people: people.length,
    missing: report.missing.length,
    redirected: report.redirected.length,
    deadLinks: report.deadLinks.length,
    imageFailures: imageFailures.length,
  };
  await writeJson('report.json', report);
  console.log('\nГотово:', report.counts);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
