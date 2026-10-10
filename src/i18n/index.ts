// Languages of the site. Russian stays at the root (its URLs match the old site's
// /ru pages without the prefix); Kazakh lives under /kz/ and English under /en/,
// the same prefixes tashenev.edu.kz uses.
import { ui, plurals, type PluralKey, type UiKey } from './ui';

export const LANGS = ['ru', 'kz', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'ru';

/** Path prefix of each language. */
export const PREFIX: Record<Lang, string> = { ru: '', kz: '/kz', en: '/en' };
/** BCP 47 tag for <html lang>, hreflang and Intl. Kazakh is "kk"; only the URLs keep the old site's "kz". */
export const LOCALE: Record<Lang, string> = { ru: 'ru', kz: 'kk', en: 'en' };
export const OG_LOCALE: Record<Lang, string> = { ru: 'ru_RU', kz: 'kk_KZ', en: 'en_US' };
/** Each language named in itself, for the switcher. */
export const LANG_SHORT: Record<Lang, string> = { ru: 'Рус', kz: 'Қаз', en: 'Eng' };
export const LANG_NAME: Record<Lang, string> = { ru: 'Русский', kz: 'Қазақша', en: 'English' };

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Language of a page from its URL path, with or without the deploy base. */
export function langFromPath(pathname: string): Lang {
  const path = BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const match = path.match(/^\/(kz|en)(?=\/|$)/);
  return (match?.[1] as Lang | undefined) ?? DEFAULT_LANG;
}

/** A site path without its language prefix: "/kz/about/" -> "/about/". */
export function stripLang(path: string): string {
  const match = path.match(/^\/(kz|en)(?=\/|$)/);
  return match ? path.slice(match[0].length) || '/' : path;
}

/** Put a language-neutral site path into a language: localize("/about/", "kz") -> "/kz/about/". External links pass through. */
export function localize(path: string, lang: Lang): string {
  return path.startsWith('/') && !path.startsWith('//') ? `${PREFIX[lang]}${path}` : path;
}

/** Value of the [...lang] route segment: none for Russian (the root), "kz" or "en". */
export const langParam = (lang: Lang) => (lang === DEFAULT_LANG ? undefined : lang);

const MONTHS: Record<Lang, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  kz: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** Strings, plurals and dates in one language. */
export function useTranslations(lang: Lang) {
  /** t("news.moreIn", { category: "Новости" }): the string with {placeholders} filled in. */
  const t = (key: UiKey, vars: Record<string, string | number> = {}) =>
    ui[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));

  /** plural(3, "departments") -> "3 кафедры" / "3 кафедра" / "3 departments". */
  const plural = (n: number, key: PluralKey) => {
    const forms = plurals[key][lang];
    if (lang === 'kz') return `${n} ${forms[0]}`; // Kazakh nouns stay singular after a number.
    if (lang === 'en') return `${n} ${n === 1 ? forms[0] : forms[1]}`;
    const mod10 = n % 10;
    const mod100 = n % 100;
    const form = mod10 === 1 && mod100 !== 11 ? 0 : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 1 : 2;
    return `${n} ${forms[form]}`;
  };

  /** "2026-10-09" -> "9 октября 2026" / "9 қазан 2026" / "9 October 2026". */
  const date = (iso: string | null) => {
    if (!iso) return '';
    const [year, month, day] = iso.split('-').map(Number);
    return `${day} ${MONTHS[lang][month - 1]} ${year}`;
  };

  return { t, plural, date };
}
