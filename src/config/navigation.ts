// Information architecture of the new site. The old menu mixed 7 top-level items
// with 19–23 links each; here pages are regrouped by audience and task. Every label
// is written as [Russian, Kazakh, English]. Links to pages that were not migrated
// in a language are filtered out automatically (see hasRoute).
import { localize, type Lang } from '../i18n';
import { getContent } from '../lib/content';

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

type Tr = [ru: string, kz: string, en: string];
const INDEX: Record<Lang, number> = { ru: 0, kz: 1, en: 2 };
const TALAPKER = 'https://talapker.tashenev.edu.kz/ru/login';

function build(lang: Lang) {
  const content = getContent(lang);
  const ORIGIN = new URL(content.originalSite).origin;
  const tr = (text: Tr) => text[INDEX[lang]];
  const link = (label: Tr, href: string): NavLink => ({ label: tr(label), href: localize(href, lang) });
  // Items of the old site's own menu, already in this language with language-prefixed paths.
  const oldMenu = (title: Tr) =>
    (content.site.menu.find((entry) => entry.title === tr(title))?.items ?? []).map((item) => ({ label: item.title, href: item.href }));
  const clean = (links: NavLink[]) => links.filter((item) => item.href && content.hasRoute(item.href));

  const sections: NavSection[] = [
    {
      id: 'university',
      label: tr(['Университет', 'Университет', 'University']),
      intro: tr([
        'История, руководство, документы и стратегия развития университета.',
        'Университеттің тарихы, басшылығы, құжаттары және даму стратегиясы.',
        "The university's history, leadership, documents and development strategy.",
      ]),
      groups: [
        {
          title: tr(['Об университете', 'Университет туралы', 'About the university']),
          links: [
            link(['История университета', 'Университет тарихы', 'History of the university'], '/about/'),
            link(['Миссия', 'Миссия', 'Mission'], '/mission/'),
            link(['Факты и цифры', 'Сандар мен фактілер', 'Facts and figures'], '/facts/'),
            link(['Руководство', 'Басшылық', 'Leadership'], '/leadership/'),
            link(['Структура университета', 'Университет құрылымы', 'University structure'], '/structure/'),
            link(['Учёный совет', 'Ғылыми кеңес', 'Academic Council'], '/academic-council/'),
            link(['Блог ректора', 'Ректор блогы', "Rector's blog"], '/open-rektor/'),
            link(['Медиатека', 'Медиатека', 'Media library'], '/news/'),
          ],
        },
        {
          title: tr(['Документы и качество', 'Құжаттар және сапа', 'Documents and quality']),
          links: [
            link(['Официальные документы', 'Ресми құжаттар', 'Official documents'], '/documents/'),
            link(['Устав университета', 'Университет жарғысы', 'University charter'], `${ORIGIN}/docs/Academ/ustav.pdf`),
            link(['Академическая политика', 'Академиялық саясат', 'Academic policy'], '/academic-policy/'),
            link(['Политика качества', 'Сапа саясаты', 'Quality policy'], '/quality-policy/'),
            link(['Качество образования', 'Білім сапасы', 'Quality of education'], '/quality-edu/'),
            link(['Программа развития', 'Даму бағдарламасы', 'Development program'], '/development-strategy/'),
            link(['Аккредитация', 'Аккредиттеу', 'Accreditation'], '/accreditation/'),
            link(
              ['Соискание учёного звания профессора', 'Профессор ғылыми атағына ізденуші', 'Applying for the title of professor'],
              '/announcements/',
            ),
            link(
              ['Конкурсное замещение должностей ППС', 'ПОҚ лауазымдарына конкурс', 'Competition for teaching positions'],
              `${ORIGIN}/docs/Academ/konkurs.pdf`,
            ),
          ],
        },
        {
          title: tr(['Кампус и бренд', 'Кампус және бренд', 'Campus and brand']),
          links: [
            link(['Устойчивое развитие', 'Тұрақты даму', 'Sustainable development'], '/sustainable-development/'),
            link(['ECO-CAMPUS', 'ECO-CAMPUS', 'ECO-CAMPUS'], '/eco-campus/'),
            link(['Карта корпусов', 'Ғимараттар картасы', 'Campus map'], '/building-map/'),
            link(['Базы практики', 'Практика базалары', 'Internship sites'], '/practice-bases/'),
            link(['Brand book', 'Brand book', 'Brand book'], '/brand-book/'),
            link(['Brand shop', 'Brand shop', 'Brand shop'], '/brand-shop/'),
          ],
        },
      ],
    },
    {
      id: 'admission',
      label: tr(['Поступление', 'Түсу', 'Admissions']),
      intro: tr([
        'Всё для абитуриентов 2026 года: программы, экзамены, документы и приёмная комиссия.',
        '2026 жылғы талапкерлерге барлығы: бағдарламалар, емтихандар, құжаттар және қабылдау комиссиясы.',
        'Everything for 2026 applicants: programs, exams, documents and the admissions office.',
      ]),
      groups: [
        {
          title: tr(['Абитуриенту', 'Талапкерге', 'Applicants']),
          links: [
            link(['Информация для абитуриентов', 'Талапкерлерге арналған ақпарат', 'Information for applicants'], '/enrolle/'),
            link(['Бакалавриат', 'Бакалавриат', "Bachelor's programs"], '/bachelor/'),
            link(['Магистратура', 'Магистратура', "Master's programs"], '/magistracy/'),
            link(['Послевузовское образование', 'Жоғары оқу орнынан кейінгі білім', 'Postgraduate education'], '/postgraduate-education/'),
            link(['Профильные предметы ЕНТ', 'ҰБТ бейіндік пәндері', 'UNT profile subjects'], '/profile-pander/'),
            link(['Приёмная комиссия', 'Қабылдау комиссиясы', 'Admissions office'], '/kabyldau/'),
          ],
        },
        {
          title: tr(['Первый курс', 'Бірінші курс', 'First year']),
          links: [
            link(['Информация для первокурсников', 'Бірінші курс студенттеріне', 'Information for first-year students'], '/freshman/'),
            link(['Карта корпусов', 'Ғимараттар картасы', 'Campus map'], '/building-map/'),
            link(['Тәшенев тартуы', 'Тәшенев тартуы', 'Tashenev Tartuy'], '/news/227/'),
            link(
              ['Центр Foundation и языковой подготовки', 'Foundation және тілдік дайындық орталығы', 'Foundation and Language Center'],
              '/foundation-center/',
            ),
          ],
        },
        {
          title: tr(['Онлайн', 'Онлайн', 'Online']),
          links: [
            link(['Онлайн-приёмная комиссия', 'Онлайн қабылдау комиссиясы', 'Online admissions office'], TALAPKER),
            link(['Онлайн-регистрация', 'Онлайн тіркелу', 'Online registration'], '/online-registation/'),
          ],
        },
      ],
      promo: {
        title: tr(['Приём 2026–2027', 'Қабылдау 2026–2027', 'Admissions 2026–2027']),
        text: tr([
          'Подайте документы онлайн — без очередей и поездок.',
          'Құжаттарды онлайн тапсырыңыз — кезексіз әрі жол жүрмей-ақ.',
          'Apply online — no queues and no trips.',
        ]),
        href: TALAPKER,
        cta: tr(['Подать заявку', 'Өтінім беру', 'Apply now']),
      },
    },
    {
      id: 'study',
      label: tr(['Обучение', 'Оқу', 'Study']),
      intro: tr([
        'Институты, кафедры, расписание и образовательные сервисы.',
        'Институттар, кафедралар, сабақ кестесі және білім беру сервистері.',
        'Institutes, departments, schedules and learning services.',
      ]),
      groups: [
        {
          title: tr(['Институты и факультеты', 'Институттар мен факультеттер', 'Institutes and faculties']),
          links: [
            ...content.faculties.map((faculty) => ({ label: faculty.name, href: localize(`/faculties/${faculty.id}/`, lang) })),
            link(['Все кафедры', 'Барлық кафедралар', 'All departments'], '/departments/'),
          ],
        },
        {
          title: tr(['Учебный процесс', 'Оқу үдерісі', 'Learning']),
          links: [
            link(['Расписание занятий', 'Сабақ кестесі', 'Class schedule'], '/class-schedule/'),
            link(['Расписание', 'Кесте', 'Schedule'], '/schedule/'),
            link(['Образовательный портал', 'Білім беру порталы', 'Educational portal'], '/portal/'),
            link(['Академическая мобильность', 'Академиялық ұтқырлық', 'Academic mobility'], '/academic-mobility/'),
            link(['Неформальное образование', 'Бейресми білім беру', 'Non-formal education'], '/nonformal-education/'),
            link(['Календарь событий', 'Іс-шаралар күнтізбесі', 'Events calendar'], '/events-calendar/'),
          ],
        },
        {
          title: tr(['Библиотека', 'Кітапхана', 'Library']),
          links: [
            link(['Информационно-образовательный центр', 'Ақпараттық-білім беру орталығы', 'Information and Education Center'], '/libary/'),
            link(['Электронная библиотека', 'Электрондық кітапхана', 'Digital library'], 'https://library.tashenev.edu.kz/'),
            link(['Научная библиотека', 'Ғылыми кітапхана', 'Research library'], 'https://lib.tashenev.edu.kz/'),
          ],
        },
      ],
    },
    {
      id: 'science',
      label: tr(['Наука', 'Ғылым', 'Research']),
      intro: tr([
        'Исследования, проекты, публикации и инновации.',
        'Зерттеулер, жобалар, жарияланымдар және инновациялар.',
        'Research, projects, publications and innovation.',
      ]),
      groups: [
        {
          title: tr(['Наука и инновации', 'Ғылым және инновациялар', 'Research and innovation']),
          links: [
            link(['Наука', 'Ғылым', 'Research'], '/science/'),
            link(['Департамент науки и инноваций', 'Ғылым және инновациялар департаменті', 'Department of Research and Innovation'], '/science-innovation/'),
            link(['Результаты научных проектов', 'Ғылыми жобалардың нәтижелері', 'Research project results'], '/research-project-results/'),
            link(['Центр коммерциализации', 'Коммерцияландыру орталығы', 'Commercialization Center'], '/science-and-commercialization/'),
            link(['Центр искусственного интеллекта', 'Жасанды интеллект орталығы', 'Artificial Intelligence Center'], '/artificial-intelligence/'),
          ],
        },
        {
          title: tr(['Публикации', 'Жарияланымдар', 'Publications']),
          links: [
            link(['Вестник «Хабаршы»', '«Хабаршы» журналы', 'Khabarshy journal'], '/habarshy/'),
            link(['Студенческие работы', 'Студенттік жұмыстар', 'Student papers'], '/student-works/'),
            link(['Статьи Scopus', 'Scopus мақалалары', 'Scopus articles'], '/news/category/scopus/'),
          ],
        },
      ],
    },
    {
      id: 'students',
      label: tr(['Студентам', 'Студенттерге', 'Students']),
      intro: tr([
        'Учёба, быт, спорт и карьера — всё, что нужно студенту.',
        'Оқу, тұрмыс, спорт және мансап — студентке қажеттің бәрі.',
        'Study, everyday life, sports and careers — everything a student needs.',
      ]),
      groups: [
        {
          title: tr(['Учёба', 'Оқу', 'Study']),
          links: [
            link(['Информация для студентов', 'Студенттерге арналған ақпарат', 'Information for students'], '/for-student/'),
            link(['Путеводитель студента', 'Студент анықтамалығы', 'Student guide'], `${ORIGIN}/docs/Academ/anyktama.pdf`),
            link(['Онлайн-регистрация', 'Онлайн тіркелу', 'Online registration'], '/online-registation/'),
            link(['Центр регистрации и поддержки', 'Тіркеу және қолдау орталығы', 'Registration and Support Center'], '/oficce-registration/'),
          ],
        },
        {
          title: tr(['Жизнь в университете', 'Университеттегі өмір', 'University life']),
          links: [
            link(['Студенческий дом', 'Студенттер үйі', 'Student residence'], '/student-house/'),
            link(['Спорт', 'Спорт', 'Sports'], '/sport/'),
            link(['Центр молодёжной политики', 'Жастар саясаты орталығы', 'Youth Policy Center'], '/zhastar/'),
            link(['Студенческая поликлиника', 'Студенттік емхана', 'Student clinic'], '/medical-service/'),
            link(['Brand shop', 'Brand shop', 'Brand shop'], '/brand-shop/'),
          ],
        },
        {
          title: tr(['Карьера', 'Мансап', 'Career']),
          links: [
            link(['Трудоустройство', 'Жұмысқа орналасу', 'Employment'], '/employment/'),
            link(['Центр карьеры и трудоустройства', 'Мансап және жұмысқа орналасу орталығы', 'Career and Employment Center'], '/career-and-employment-center/'),
            link(['Выпускники', 'Түлектер', 'Alumni'], '/graduates/'),
          ],
        },
      ],
    },
    {
      id: 'units',
      label: tr(['Подразделения', 'Бөлімшелер', 'Offices']),
      intro: tr([
        'Департаменты, центры и службы университета.',
        'Университеттің департаменттері, орталықтары мен қызметтері.',
        "The university's offices, centers and services.",
      ]),
      groups: [{ title: tr(['Отделы и центры', 'Бөлімдер мен орталықтар', 'Offices and centers']), links: oldMenu(['Отделы', 'Бөлімдер', 'Departments']) }],
    },
    {
      id: 'news',
      label: tr(['Новости', 'Жаңалықтар', 'News']),
      intro: '',
      href: localize('/news/', lang),
      groups: [],
    },
  ];

  const navigation: NavSection[] = sections.map((section) => ({
    ...section,
    groups: section.groups
      .map((group) => ({ ...group, links: clean(group.links) }))
      .filter((group) => group.links.length > 0),
  }));

  /** e-University services from the old site's menu (Platonus, mail, libraries, ...). */
  const services = clean(oldMenu(['e-University', 'e-University', 'e-University']));

  const footerColumns: NavGroup[] = [
    {
      title: tr(['Университет', 'Университет', 'University']),
      links: clean([
        link(['История', 'Тарих', 'History'], '/about/'),
        link(['Руководство', 'Басшылық', 'Leadership'], '/leadership/'),
        link(['Структура', 'Құрылым', 'Structure'], '/structure/'),
        link(['Документы', 'Құжаттар', 'Documents'], '/documents/'),
        link(['Факты и цифры', 'Сандар мен фактілер', 'Facts and figures'], '/facts/'),
        link(['Новости', 'Жаңалықтар', 'News'], '/news/'),
      ]),
    },
    {
      title: tr(['Поступление', 'Түсу', 'Admissions']),
      links: clean([
        link(['Абитуриенту', 'Талапкерге', 'Applicants'], '/enrolle/'),
        link(['Бакалавриат', 'Бакалавриат', "Bachelor's programs"], '/bachelor/'),
        link(['Магистратура', 'Магистратура', "Master's programs"], '/magistracy/'),
        link(['Приёмная комиссия', 'Қабылдау комиссиясы', 'Admissions office'], '/kabyldau/'),
        link(['Первокурснику', 'Бірінші курс студентіне', 'First-year students'], '/freshman/'),
      ]),
    },
    {
      title: tr(['Обучение', 'Оқу', 'Study']),
      links: clean([
        link(['Институты и факультеты', 'Институттар мен факультеттер', 'Institutes and faculties'], '/faculties/'),
        link(['Кафедры', 'Кафедралар', 'Departments'], '/departments/'),
        link(['Расписание', 'Сабақ кестесі', 'Class schedule'], '/class-schedule/'),
        link(['Студентам', 'Студенттерге', 'Students'], '/for-student/'),
        link(['Наука', 'Ғылым', 'Research'], '/science/'),
      ]),
    },
  ];

  /** The menu section a path belongs to (used for breadcrumbs and the "in this section" list). */
  const sectionFor = (path: string) =>
    navigation.find((section) => section.groups.some((group) => group.links.some((item) => item.href === path)));

  return { navigation, services, footerColumns, sectionFor };
}

const cache = new Map<Lang, ReturnType<typeof build>>();

/** Menu, e-University services and footer columns in one language. */
export function getNavigation(lang: Lang) {
  if (!cache.has(lang)) cache.set(lang, build(lang));
  return cache.get(lang)!;
}

export const isExternal = (href: string) => /^https?:\/\//.test(href);
