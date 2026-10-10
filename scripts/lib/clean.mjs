// Turns legacy CMS markup (Bootstrap/Tailwind class soup, Word paste, inline
// styles, "paragraphs" glued together with <br>) into small semantic HTML that
// the new templates can style consistently.
import * as cheerio from 'cheerio';
import { localImage } from './images.mjs';
import { absolute, fileExtension, isOwn, localPath } from './routes.mjs';

const KEEP = new Set([
  'p', 'br', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'a', 'img', 'strong', 'em', 'u', 's', 'sub', 'sup', 'small', 'mark',
  'blockquote', 'figure', 'figcaption', 'hr', 'iframe', 'video',
  'details', 'summary', 'code', 'pre',
]);
const RENAME = { b: 'strong', i: 'em', h1: 'h2', strike: 's', del: 's', ins: 'u', big: 'strong' };
const BLOCKS = new Set(['div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav', 'center', 'address']);
const BLOCK_CHILDREN = 'p, div, section, article, ul, ol, dl, table, h1, h2, h3, h4, h5, h6, blockquote, figure, iframe, video, details, hr, pre';
const INLINE = new Set(['a', 'strong', 'em', 'u', 's', 'sub', 'sup', 'small', 'mark', 'code', 'br', 'img']);
const FORMATTING = new Set(['strong', 'em', 'u', 's', 'sub', 'sup', 'small', 'mark']);
const DROP = 'script, style, noscript, link, meta, form, input, button, select, textarea, label, svg, canvas, object, embed, template, map';
const NOISE = [
  '.title_img__wrap', '.title_img__crumb', '.crumb__wrap', '.crumb', '.breadcrumb', '[aria-label="breadcrumb"]',
  '.navextra_wrap', '.accordionKafedra-icon', '.icon_box',
  '[style*="display:none"]', '[style*="display: none"]', '[hidden]',
].join(', ');
const ATTRS = {
  a: ['href'],
  img: ['src', 'alt'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
  ol: ['start', 'type'],
  iframe: ['src', 'title'],
  video: ['src', 'poster'],
};
const EMBED_RE =
  /^https?:\/\/(www\.)?(youtube(-nocookie)?\.com|youtu\.be|player\.vimeo\.com|docs\.google\.com|drive\.google\.com|google\.com\/maps|maps\.google\.com|yandex\.(ru|kz)\/map-widget|widgets\.2gis\.com)/i;
const LONG_LINE = 110;

/** Every internal link written by the cleaner: new path -> original URL (used to repair dead links). */
export const internalLinks = new Map();

const LOOKALIKES = {
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х',
};

/** Replace Latin look-alike letters inside Cyrillic words, e.g. "Иcтория" typed with a Latin "c". */
export function fixMixedScript(text) {
  return text.replace(/\p{L}+/gu, (word) => {
    if (!/[Ѐ-ӿ]/.test(word)) return word;
    const latin = word.match(/[A-Za-z]/g);
    if (!latin || !latin.every((ch) => ch in LOOKALIKES)) return word;
    return word.replace(/[A-Za-z]/g, (ch) => LOOKALIKES[ch]);
  });
}

/** Plain text of an HTML fragment with collapsed whitespace. */
export function textOf(html) {
  return cheerio.load(html || '', null, false).root().text().replace(/\s+/g, ' ').trim();
}

/** Short plain-text summary for cards and meta descriptions. */
export function excerpt(html, max = 220) {
  const text = textOf(html);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > max * 0.6 ? space : max).replace(/[\s,.;:–—-]+$/, '')}…`;
}

/**
 * Clean a fragment of legacy markup.
 * @param {string} html   inner HTML of the content root
 * @param {{ base: string, image?: string }} options  base resolves relative links; image is the image preset
 */
export async function cleanHtml(html, { base, image = 'content' } = {}) {
  const $ = cheerio.load(html || '', null, false);
  const root = $.root();

  pdfEmbedsToLinks($, root, base);
  root.find(DROP).remove();
  root.find(NOISE).remove();
  root.find('*').addBack().contents().filter((_, node) => node.type === 'comment').remove();
  convertAccordions($, root);
  root.find('.section__title').each((_, el) => {
    el.name = 'h2';
  });
  keepEmbeds($, root, base);
  simplifyTags($, root);
  rewriteLinks($, root, base);
  await rewriteImages($, root, base, image);
  splitBreaks($, root);
  normalizeText($, root);
  removeEmpty($, root);
  wrapLooseInline($, root);
  root.children('br').remove();
  linkParagraphsToLists($, root);

  root.find('table').wrap('<div class="table-wrap"></div>');
  root.find('iframe').each((_, el) => {
    $(el).attr({ loading: 'lazy', allowfullscreen: '' }).wrap('<div class="embed"></div>');
  });
  root.find('video').attr({ controls: '', preload: 'metadata' });
  return (root.html() || '').trim();
}

/** Embedded PDF viewers become plain document links (the viewer markup is dropped later). */
function pdfEmbedsToLinks($, root, base) {
  root.find('iframe, embed, object').each((_, el) => {
    const $el = $(el);
    const src = absolute($el.attr('src') || $el.attr('data'), base);
    if (!src || fileExtension(src) !== 'pdf') return;
    $el.replaceWith(`<p><a href="${src}">Открыть документ (PDF)</a></p>`);
  });
}

/** Checkbox/Bootstrap accordions become native <details>, which work without JavaScript. */
function convertAccordions($, root) {
  root.find('[class*="accordion"]').each((_, el) => {
    const $item = $(el);
    if (!/accordion\S*-item\b|accordion__item/.test($item.attr('class') || '')) return;
    const $title = $item
      .find('[class*="title"], [class*="header"], [class*="button"]')
      .filter((__, node) => $(node).text().trim() !== '')
      .first();
    const $content = $item.find('[class*="content"], [class*="collapse"], [class*="body"]').first();
    if (!$title.length || !$content.length) return;
    const $summary = $('<summary></summary>').text($title.text().replace(/\s+/g, ' ').trim());
    $item.replaceWith($('<details></details>').append($summary).append($content.contents()));
  });
}

function keepEmbeds($, root, base) {
  root.find('iframe').each((_, el) => {
    const $el = $(el);
    const src = absolute($el.attr('src') || $el.attr('data-src'), base);
    if (src && EMBED_RE.test(src)) $el.attr('src', src.replace(/^http:/, 'https:'));
    else $el.remove();
  });
  root.find('video').each((_, el) => {
    const $el = $(el);
    const src = absolute($el.attr('src') || $el.find('source').attr('src'), base);
    if (!src) {
      $el.remove();
      return;
    }
    $el.attr('src', src);
    $el.find('source').remove();
  });
}

/** Rename, unwrap or strip elements bottom-up so unwrapping a parent never skips a child. */
function simplifyTags($, root) {
  for (const el of root.find('*').get().reverse()) {
    const $el = $(el);
    let name = el.name.toLowerCase();
    if (name.includes(':')) {
      $el.replaceWith($el.contents()); // Word leftovers such as <o:p>
      continue;
    }
    if (RENAME[name]) {
      el.name = RENAME[name];
      name = el.name;
    }
    // <b> wrapped around whole sections (seen on the contacts page) carries no meaning.
    if (FORMATTING.has(name) && $el.find(BLOCK_CHILDREN).length) {
      $el.replaceWith($el.contents());
      continue;
    }
    if (!KEEP.has(name)) {
      if (BLOCKS.has(name) && $el.text().trim() && !$el.find(BLOCK_CHILDREN).length) {
        el.name = 'p';
        el.attribs = {};
      } else {
        $el.replaceWith($el.contents());
      }
      continue;
    }
    const attribs = el.attribs || {};
    if (name === 'img' && !attribs.src) attribs.src = attribs['data-src'] || attribs['data-lazy-src'] || '';
    const allowed = ATTRS[name] || [];
    el.attribs = Object.fromEntries(Object.entries(attribs).filter(([key]) => allowed.includes(key)));
  }
}

function rewriteLinks($, root, base) {
  root.find('a').each((_, el) => {
    const $a = $(el);
    const href = ($a.attr('href') || '').trim();
    if (/^mailto:/i.test(href)) return;
    if (/^tel:/i.test(href)) {
      if (href.replace(/\D/g, '').length < 6) $a.replaceWith($a.contents());
      return;
    }
    const abs = href.startsWith('#') ? null : absolute(href, base);
    if (!abs) {
      $a.replaceWith($a.contents());
      return;
    }
    const local = localPath(abs);
    if (local) {
      $a.attr('href', local);
      internalLinks.set(local, abs);
      return;
    }
    $a.attr('href', abs);
    const ext = fileExtension(abs);
    if (ext) $a.attr('data-file', ext);
    if (ext || !isOwn(abs)) $a.attr({ target: '_blank', rel: 'noopener' });
  });
}

async function rewriteImages($, root, base, preset) {
  await Promise.all(
    root.find('img').get().map(async (el) => {
      const $img = $(el);
      const src = absolute($img.attr('src'), base);
      if (!src) {
        $img.remove();
        return;
      }
      const local = await localImage(src, preset);
      if (!local) {
        $img.remove(); // missing on the old site as well, so it would only show a broken icon
        return;
      }
      $img.attr('src', local.src);
      if (local.width) $img.attr({ width: String(local.width), height: String(local.height) });
      $img.attr({ alt: fixMixedScript(($img.attr('alt') || '').trim()), loading: 'lazy', decoding: 'async' });
    }),
  );
}

const plain = (html) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, '_')
    .trim();

function markerKind(line) {
  const text = plain(line);
  if (/^\d{1,2}[.)]\s/.test(text)) return 'ol';
  if (/^[-–—•●▪■◦*✓✔➤►▶]\s?/.test(text)) return 'ul';
  return null;
}

function stripMarker(line, kind) {
  const re = kind === 'ol' ? /^((?:\s*<[^>]+>)*\s*)\d{1,2}[.)]\s*/ : /^((?:\s*<[^>]+>)*\s*)[-–—•●▪■◦*✓✔➤►▶]\s*/;
  return line.replace(re, '$1');
}

/**
 * Old pages often put a whole article into one <p> separated by <br>.
 * Long lines become their own paragraphs, runs of bullet/number lines become
 * lists, and short lines (addresses, signatures) stay together.
 */
function splitBreaks($, root) {
  root.find('p').each((_, el) => {
    const $p = $(el);
    if (!$p.find('br').length) return;
    const lines = ($p.html() || '')
      .split(/<br\s*\/?>/i)
      .map((line) => line.trim())
      .filter((line) => plain(line));
    if (lines.length === 0) {
      $p.remove();
      return;
    }

    const out = [];
    let i = 0;
    while (i < lines.length) {
      const kind = markerKind(lines[i]);
      if (kind && markerKind(lines[i + 1] || '') === kind) {
        const items = [];
        while (i < lines.length && markerKind(lines[i]) === kind) items.push(stripMarker(lines[i++], kind));
        out.push(`<${kind}>${items.map((item) => `<li>${item}</li>`).join('')}</${kind}>`);
        continue;
      }
      if (plain(lines[i]).length > LONG_LINE) {
        out.push(`<p>${lines[i++]}</p>`);
        continue;
      }
      const run = [lines[i++]];
      while (
        i < lines.length &&
        plain(lines[i]).length <= LONG_LINE &&
        !(markerKind(lines[i]) && markerKind(lines[i + 1] || '') === markerKind(lines[i]))
      ) {
        run.push(lines[i++]);
      }
      out.push(`<p>${run.join('<br>')}</p>`);
    }
    $p.replaceWith(out.join(''));
  });
}

function normalizeText($, root) {
  root
    .find('*')
    .addBack()
    .contents()
    .each((_, node) => {
      if (node.type !== 'text') return;
      node.data = fixMixedScript(
        node.data
          .replace(/[­​﻿]/g, '')
          .replace(/ /g, ' ')
          .replace(/[ \t\r\n]{2,}/g, ' '),
      );
    });
}

const EMPTYABLE =
  'p, li, ul, ol, dl, dt, dd, strong, em, u, s, sub, sup, small, mark, h2, h3, h4, h5, h6, a, blockquote, figure, figcaption, details, summary';

function removeEmpty($, root) {
  let changed = true;
  while (changed) {
    changed = false;
    root.find(EMPTYABLE).each((_, el) => {
      const $el = $(el);
      if ($el.find('img, iframe, video, table, hr').length) return;
      if ($el.text().replace(/\s+/g, '') === '') {
        $el.remove();
        changed = true;
      }
    });
  }
  const isBlank = (node) => node && (node.name === 'br' || (node.type === 'text' && !node.data.trim()));
  root.find('p, li, td, th').each((_, el) => {
    const $el = $(el);
    while (isBlank($el.contents().first()[0])) $el.contents().first().remove();
    while (isBlank($el.contents().last()[0])) $el.contents().last().remove();
  });
}

/** A paragraph made only of links (old "link cards") becomes a list the templates style as cards. */
function linkParagraphsToLists($, root) {
  root.find('p').each((_, el) => {
    const $p = $(el);
    const nodes = $p
      .contents()
      .get()
      .filter((node) => node.name !== 'br' && !(node.type === 'text' && !node.data.trim()));
    if (nodes.length < 2 || !nodes.every((node) => node.name === 'a')) return;
    $p.replaceWith(`<ul class="links">${nodes.map((node) => `<li>${$.html(node)}</li>`).join('')}</ul>`);
  });
}

/**
 * Text and inline elements left at the top level after unwrapping get their own paragraph.
 * Rebuilt as a string: cheerio's before()/wrap() silently skip text nodes, which would
 * drop the content instead of wrapping it.
 */
function wrapLooseInline($, root) {
  const parts = [];
  let run = '';
  let meaningful = false;
  const flush = () => {
    if (run) parts.push(meaningful ? `<p>${run}</p>` : run);
    run = '';
    meaningful = false;
  };
  for (const node of root.contents().get()) {
    if (node.type === 'text' || (node.type === 'tag' && INLINE.has(node.name))) {
      run += $.html(node);
      if (node.name === 'img' || $(node).text().trim()) meaningful = true;
    } else {
      flush();
      parts.push($.html(node));
    }
  }
  flush();
  root.empty().append(parts.join(''));
}
