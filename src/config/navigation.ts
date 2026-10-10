// Information architecture of the new site. The old menu mixed 7 top-level items
// with 19–23 links each; here pages are regrouped by audience and task. Links to
// pages that were not migrated are filtered out automatically (see hasRoute).
import { faculties, hasRoute, ORIGINAL_SITE, site } from '../lib/content';

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  title: string;
  links: NavLink[];
}

export interface NavSection {
  id: string;
  label: string;
  intro: string;
  href?: string;
  groups: NavGroup[];
  promo?: { title: string; text: string; href: string; cta: string };
}

const ORIGIN = new URL(ORIGINAL_SITE).origin;
const oldMenu = (title: string) => site.menu.find((entry) => entry.title === title)?.items ?? [];

const sections: NavSection[] = [
  {
    id: 'university',
    label: 'Университет',
    intro: 'История, руководство, документы и стратегия развития университета.',
    groups: [
      {
        title: 'Об университете',
        links: [
          { label: 'История университета', href: '/about/' },
          { label: 'Миссия', href: '/mission/' },
          { label: 'Факты и цифры', href: '/facts/' },
          { label: 'Руководство', href: '/leadership/' },
          { label: 'Структура университета', href: '/structure/' },
          { label: 'Учёный совет', href: '/academic-council/' },
          { label: 'Блог ректора', href: '/open-rektor/' },
          { label: 'Медиатека', href: '/news/' },
        ],
      },
      {
        title: 'Документы и качество',
        links: [
          { label: 'Официальные документы', href: '/documents/' },
          { label: 'Устав университета', href: `${ORIGIN}/docs/Academ/ustav.pdf` },
          { label: 'Академическая политика', href: '/academic-policy/' },
          { label: 'Политика качества', href: '/quality-policy/' },
          { label: 'Качество образования', href: '/quality-edu/' },
          { label: 'Программа развития', href: '/development-strategy/' },
          { label: 'Аккредитация', href: '/accreditation/' },
          { label: 'Соискание учёного звания профессора', href: '/announcements/' },
          { label: 'Конкурсное замещение должностей ППС', href: `${ORIGIN}/docs/Academ/konkurs.pdf` },
        ],
      },
      {
        title: 'Кампус и бренд',
        links: [
          { label: 'Устойчивое развитие', href: '/sustainable-development/' },
          { label: 'ECO-CAMPUS', href: '/eco-campus/' },
          { label: 'Карта корпусов', href: '/building-map/' },
          { label: 'Базы практики', href: '/practice-bases/' },
          { label: 'Brand book', href: '/brand-book/' },
          { label: 'Brand shop', href: '/brand-shop/' },
        ],
      },
    ],
  },
  {
    id: 'admission',
    label: 'Поступление',
    intro: 'Всё для абитуриентов 2026 года: программы, экзамены, документы и приёмная комиссия.',
    groups: [
      {
        title: 'Абитуриенту',
        links: [
          { label: 'Информация для абитуриентов', href: '/enrolle/' },
          { label: 'Бакалавриат', href: '/bachelor/' },
          { label: 'Магистратура', href: '/magistracy/' },
          { label: 'Послевузовское образование', href: '/postgraduate-education/' },
          { label: 'Профильные предметы ЕНТ', href: '/profile-pander/' },
          { label: 'Приёмная комиссия', href: '/kabyldau/' },
        ],
      },
      {
        title: 'Первый курс',
        links: [
          { label: 'Информация для первокурсников', href: '/freshman/' },
          { label: 'Карта корпусов', href: '/building-map/' },
          { label: 'Тәшенев тартуы', href: '/news/227/' },
          { label: 'Центр Foundation и языковой подготовки', href: '/foundation-center/' },
        ],
      },
      {
        title: 'Онлайн',
        links: [
          { label: 'Онлайн-приёмная комиссия', href: 'https://talapker.tashenev.edu.kz/ru/login' },
          { label: 'Онлайн-регистрация', href: '/online-registation/' },
        ],
      },
    ],
    promo: {
      title: 'Приём 2026–2027',
      text: 'Подайте документы онлайн — без очередей и поездок.',
      href: 'https://talapker.tashenev.edu.kz/ru/login',
      cta: 'Подать заявку',
    },
  },
  {
    id: 'study',
    label: 'Обучение',
    intro: 'Институты, кафедры, расписание и образовательные сервисы.',
    groups: [
      {
        title: 'Институты и факультеты',
        links: [
          ...faculties.map((faculty) => ({ label: faculty.name, href: `/faculties/${faculty.id}/` })),
          { label: 'Все кафедры', href: '/departments/' },
        ],
      },
      {
        title: 'Учебный процесс',
        links: [
          { label: 'Расписание занятий', href: '/class-schedule/' },
          { label: 'Расписание', href: '/schedule/' },
          { label: 'Образовательный портал', href: '/portal/' },
          { label: 'Академическая мобильность', href: '/academic-mobility/' },
          { label: 'Неформальное образование', href: '/nonformal-education/' },
          { label: 'Календарь событий', href: '/events-calendar/' },
        ],
      },
      {
        title: 'Библиотека',
        links: [
          { label: 'Информационно-образовательный центр', href: '/libary/' },
          { label: 'Электронная библиотека', href: 'https://library.tashenev.edu.kz/' },
          { label: 'Научная библиотека', href: 'https://lib.tashenev.edu.kz/' },
        ],
      },
    ],
  },
  {
    id: 'science',
    label: 'Наука',
    intro: 'Исследования, проекты, публикации и инновации.',
    groups: [
      {
        title: 'Наука и инновации',
        links: [
          { label: 'Наука', href: '/science/' },
          { label: 'Департамент науки и инноваций', href: '/science-innovation/' },
          { label: 'Результаты научных проектов', href: '/research-project-results/' },
          { label: 'Центр коммерциализации', href: '/science-and-commercialization/' },
          { label: 'Центр искусственного интеллекта', href: '/artificial-intelligence/' },
        ],
      },
      {
        title: 'Публикации',
        links: [
          { label: 'Вестник «Хабаршы»', href: '/habarshy/' },
          { label: 'Студенческие работы', href: '/student-works/' },
          { label: 'Статьи Scopus', href: '/news/category/scopus/' },
        ],
      },
    ],
  },
  {
    id: 'students',
    label: 'Студентам',
    intro: 'Учёба, быт, спорт и карьера — всё, что нужно студенту.',
    groups: [
      {
        title: 'Учёба',
        links: [
          { label: 'Информация для студентов', href: '/for-student/' },
          { label: 'Путеводитель студента', href: `${ORIGIN}/docs/Academ/anyktama.pdf` },
          { label: 'Онлайн-регистрация', href: '/online-registation/' },
          { label: 'Центр регистрации и поддержки', href: '/oficce-registration/' },
        ],
      },
      {
        title: 'Жизнь в университете',
        links: [
          { label: 'Студенческий дом', href: '/student-house/' },
          { label: 'Спорт', href: '/sport/' },
          { label: 'Центр молодёжной политики', href: '/zhastar/' },
          { label: 'Студенческая поликлиника', href: '/medical-service/' },
          { label: 'Brand shop', href: '/brand-shop/' },
        ],
      },
      {
        title: 'Карьера',
        links: [
          { label: 'Трудоустройство', href: '/employment/' },
          { label: 'Центр карьеры и трудоустройства', href: '/career-and-employment-center/' },
          { label: 'Выпускники', href: '/graduates/' },
        ],
      },
    ],
  },
  {
    id: 'units',
    label: 'Подразделения',
    intro: 'Департаменты, центры и службы университета.',
    groups: [{ title: 'Отделы и центры', links: oldMenu('Отделы').map((item) => ({ label: item.title, href: item.href })) }],
  },
  {
    id: 'news',
    label: 'Новости',
    intro: '',
    href: '/news/',
    groups: [],
  },
];

const clean = (links: NavLink[]) => links.filter((link) => link.href && hasRoute(link.href));

export const navigation: NavSection[] = sections.map((section) => ({
  ...section,
  groups: section.groups
    .map((group) => ({ ...group, links: clean(group.links) }))
    .filter((group) => group.links.length > 0),
}));

/** e-University services from the old site's menu (Platonus, mail, libraries, ...). */
export const services: NavLink[] = clean(oldMenu('e-University').map((item) => ({ label: item.title, href: item.href })));

export const footerColumns: NavGroup[] = [
  {
    title: 'Университет',
    links: clean([
      { label: 'История', href: '/about/' },
      { label: 'Руководство', href: '/leadership/' },
      { label: 'Структура', href: '/structure/' },
      { label: 'Документы', href: '/documents/' },
      { label: 'Факты и цифры', href: '/facts/' },
      { label: 'Новости', href: '/news/' },
    ]),
  },
  {
    title: 'Поступление',
    links: clean([
      { label: 'Абитуриенту', href: '/enrolle/' },
      { label: 'Бакалавриат', href: '/bachelor/' },
      { label: 'Магистратура', href: '/magistracy/' },
      { label: 'Приёмная комиссия', href: '/kabyldau/' },
      { label: 'Первокурснику', href: '/freshman/' },
    ]),
  },
  {
    title: 'Обучение',
    links: clean([
      { label: 'Институты и факультеты', href: '/faculties/' },
      { label: 'Кафедры', href: '/departments/' },
      { label: 'Расписание', href: '/class-schedule/' },
      { label: 'Студентам', href: '/for-student/' },
      { label: 'Наука', href: '/science/' },
    ]),
  },
];

/** The menu section a path belongs to (used for breadcrumbs and the "in this section" list). */
export function sectionFor(path: string): NavSection | undefined {
  return navigation.find((section) =>
    section.groups.some((group) => group.links.some((link) => link.href === path)),
  );
}

export const isExternal = (href: string) => /^https?:\/\//.test(href);
