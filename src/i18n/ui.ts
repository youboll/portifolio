export const defaultLocale = "en" as const;
export const locales = ["en", "pt-br"] as const;
export type Locale = (typeof locales)[number];

export const ui = {
  en: {
    "site.tagline": "full stack engineer",
    "site.defaultTitle": "Pedro Mansan — Full Stack Engineer (Python/Django, Vue)",
    "site.defaultDescription":
      "Full stack developer working on multi-tenant SaaS — Python/Django on the backend, Vue on the frontend. Based in Brazil.",

    "nav.work": "work",
    "nav.writing": "writing",
    "nav.uses": "uses",
    "nav.now": "now",

    "lang.toggle.aria": "Switch language",
    "lang.label": "EN",
    "lang.other": "PT",

    "theme.aria": "Toggle color scheme",

    "footer.email": "email",
    "footer.github": "github ↗",
    "footer.linkedin": "linkedin ↗",
    "footer.rss": "rss",

    "home.role": "Full stack engineer · Brazil",
    "home.lede":
      "I'm a full stack developer working on multi-tenant SaaS — mostly Python/Django on the backend, Vue on the frontend, AWS in between. I like systems with hard edges: auth, multi-tenancy, performance under real load.",
    "home.recent.before": "Most recently at ",
    "home.recent.linkLabel": "Mindz (2022–2026)",
    "home.recent.after":
      ", where I led the migration of a 150-page legacy course platform with a swarm of 40 Claude Code agents in a week. Currently studying CS at UTFPR.",
    "home.cta.before": "Available for remote roles with US/EU teams. Write to ",
    "home.cta.after": ".",
    "home.status": "Available since April 2026",
    "home.section.work": "Selected work",
    "home.section.writing": "Writing",
    "home.section.writing.all": "All writing →",
    "home.work.featuredTag": "case study",

    "work.title": "Work — Pedro Mansan",
    "work.description":
      "Notes on the work I did at Mindz between 2022 and 2026: design system migrations, ABAC, multi-DB routing, OAuth2.",
    "work.heading": "Work",
    "work.role": "2022 – 2026 · Mindz · before that, Frutap",

    "writing.title": "Writing — Pedro Mansan",
    "writing.description":
      "Long-form notes on Django, multi-tenancy, authorization, and orchestrating AI agents at scale.",
    "writing.heading": "Writing",
    "writing.role": "Notes on the systems I've built",
    "writing.draft": "draft",
    "writing.rss": "rss feed →",
    "writing.back": "← writing",

    "uses.title": "Uses — Pedro Mansan",
    "uses.description": "The tools I actually use day to day for shipping multi-tenant SaaS.",
    "uses.heading": "Uses",
    "uses.role": "What I actually use, day to day",
    "uses.intro.before": "Inspired by ",
    "uses.intro.after": ". Only things I reach for at least once a week.",

    "now.title": "Now — Pedro Mansan",
    "now.description": "What I'm focused on right now.",
    "now.heading": "Now",
    "now.role": "A snapshot of what I'm doing this month",
    "now.lastUpdated": "Last updated:",
    "now.inspired.before": "Inspired by ",
    "now.inspired.after": ".",

    "404.title": "Not found — Pedro Mansan",
    "404.description": "This page doesn't exist.",
    "404.heading": "This page doesn't exist.",
    "404.body": "It might have been moved, or the link might be wrong.",
    "404.back": "← Back to home",

    "writing.note": "",
  },
  "pt-br": {
    "site.tagline": "engenheiro full stack",
    "site.defaultTitle": "Pedro Mansan — Engenheiro Full Stack (Python/Django, Vue)",
    "site.defaultDescription":
      "Desenvolvedor full stack trabalhando com SaaS multi-tenant — Python/Django no backend, Vue no frontend. Baseado no Brasil.",

    "nav.work": "trabalhos",
    "nav.writing": "blog",
    "nav.uses": "ferramentas",
    "nav.now": "agora",

    "lang.toggle.aria": "Trocar idioma",
    "lang.label": "PT",
    "lang.other": "EN",

    "theme.aria": "Alternar tema",

    "footer.email": "email",
    "footer.github": "github ↗",
    "footer.linkedin": "linkedin ↗",
    "footer.rss": "rss",

    "home.role": "Engenheiro full stack · Brasil",
    "home.lede":
      "Sou desenvolvedor full stack trabalhando com SaaS multi-tenant — principalmente Python/Django no backend, Vue no frontend e AWS no meio do caminho. Gosto de sistemas com arestas duras: autenticação, multi-tenancy e performance sob carga real.",
    "home.recent.before": "Mais recentemente na ",
    "home.recent.linkLabel": "Mindz (2022–2026)",
    "home.recent.after":
      ", onde liderei a migração de uma plataforma de cursos legada de 150 páginas com um enxame de 40 agentes Claude Code em uma semana. Atualmente cursando Ciência da Computação na UTFPR.",
    "home.cta.before": "Disponível para vagas remotas em times dos EUA/Europa. Escreva para ",
    "home.cta.after": ".",
    "home.status": "Disponível desde abril de 2026",
    "home.section.work": "Trabalhos selecionados",
    "home.section.writing": "Blog",
    "home.section.writing.all": "Todos os posts →",
    "home.work.featuredTag": "estudo de caso",

    "work.title": "Trabalhos — Pedro Mansan",
    "work.description":
      "Notas sobre o trabalho que fiz na Mindz entre 2022 e 2026: migração de design system, ABAC, roteamento multi-DB, OAuth2.",
    "work.heading": "Trabalhos",
    "work.role": "2022 – 2026 · Mindz · antes disso, Frutap",

    "writing.title": "Blog — Pedro Mansan",
    "writing.description":
      "Notas longas sobre Django, multi-tenancy, autorização e orquestração de agentes de IA em escala.",
    "writing.heading": "Blog",
    "writing.role": "Notas sobre os sistemas que construí",
    "writing.draft": "rascunho",
    "writing.rss": "feed rss →",
    "writing.back": "← blog",

    "uses.title": "Ferramentas — Pedro Mansan",
    "uses.description": "As ferramentas que uso no dia a dia para entregar SaaS multi-tenant.",
    "uses.heading": "Ferramentas",
    "uses.role": "O que eu realmente uso, no dia a dia",
    "uses.intro.before": "Inspirado em ",
    "uses.intro.after": ". Apenas coisas que uso pelo menos uma vez por semana.",

    "now.title": "Agora — Pedro Mansan",
    "now.description": "No que estou focado agora.",
    "now.heading": "Agora",
    "now.role": "Um retrato do que estou fazendo este mês",
    "now.lastUpdated": "Última atualização:",
    "now.inspired.before": "Inspirado em ",
    "now.inspired.after": ".",

    "404.title": "Não encontrado — Pedro Mansan",
    "404.description": "Esta página não existe.",
    "404.heading": "Esta página não existe.",
    "404.body": "Pode ter sido movida, ou o link pode estar errado.",
    "404.back": "← Voltar para o início",

    "writing.note": "",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type UIKey = keyof (typeof ui)["en"];

export function getLocale(astroLocale: string | undefined): Locale {
  return astroLocale === "pt-br" ? "pt-br" : "en";
}

export function t(locale: Locale, key: UIKey): string {
  return ui[locale][key] ?? ui.en[key];
}

export function localizePath(path: string, locale: Locale): string {
  const stripped = path.replace(/^\/pt-br(?=\/|$)/, "") || "/";
  if (locale === "en") return stripped;
  return stripped === "/" ? "/pt-br/" : `/pt-br${stripped}`;
}

export function dateLocale(locale: Locale): string {
  return locale === "pt-br" ? "pt-BR" : "en-US";
}

export function htmlLang(locale: Locale): string {
  return locale === "pt-br" ? "pt-BR" : "en";
}
