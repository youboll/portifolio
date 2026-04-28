# pedro.mansan.dev

Personal site. Astro + Tailwind, no JS framework, no CDN fonts, no analytics.

## Stack

- [Astro 5](https://astro.build/) — static site generator
- [Tailwind CSS 4](https://tailwindcss.com/) via the official Vite plugin
- [Geist Sans + Geist Mono](https://vercel.com/font), self-hosted via `@fontsource`
- Markdown content collections for `/writing`
- `@astrojs/rss` + `@astrojs/sitemap`
- Deploy target: Cloudflare Pages (static `dist/`)

## Run locally

```bash
npm install
npm run dev      # http://localhost:4321
```

`npm run dev` shows draft posts. The production build hides them — see below.

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # serves the production build locally
```

## Drafts

Each post in `src/content/blog/*.md` has `draft: true` in its frontmatter.
Drafts are filtered out of `/writing` and the RSS feed in production
(`npm run build`), but their individual pages are still generated so links
do not 404. To publish a post, change `draft: true` → `draft: false`.

## Deploy to Cloudflare Pages

The site is fully static. From the Cloudflare dashboard:

1. Connect this repo.
2. Framework preset: **Astro**.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Environment variables: none required.
6. Custom domain: `pedro.mansan.dev` (point a CNAME/Pages-managed record at the
   Pages deployment).

Or via Wrangler:

```bash
npx wrangler pages deploy dist --project-name=pedro-mansan-dev
```

## TODOs left for me

- [ ] Confirm GitHub username (`youboll` placeholder in `src/components/Footer.astro`).
- [ ] `/uses` — fill in terminal preference, laptop model, monitor, keyboard.
- [ ] Flesh out the five draft posts in `src/content/blog/`.
- [ ] Decide whether the agent-swarm post should drop the placeholder numbers
      from `/work` (currently `~280ms p95 → ~45ms` on the ABAC entry — replace
      with real numbers or remove if not validated).
- [ ] Replace `og-default.svg` with a designed OG image if I want richer social
      previews.
- [ ] Add a real favicon (currently a one-letter SVG).

## Project layout

```
.
├── astro.config.mjs
├── tsconfig.json
├── package.json
├── public/
│   ├── favicon.svg
│   ├── og-default.svg
│   └── robots.txt
└── src/
    ├── content.config.ts
    ├── content/blog/*.md         # 5 draft posts
    ├── layouts/Layout.astro
    ├── components/
    │   ├── Nav.astro
    │   ├── Footer.astro
    │   └── ThemeToggle.astro
    ├── pages/
    │   ├── index.astro           # /
    │   ├── work.astro            # /work
    │   ├── now.astro             # /now
    │   ├── uses.astro            # /uses
    │   ├── 404.astro             # /404
    │   ├── rss.xml.js            # /rss.xml
    │   └── writing/
    │       ├── index.astro       # /writing
    │       └── [...slug].astro   # /writing/<post>
    └── styles/globals.css
```
