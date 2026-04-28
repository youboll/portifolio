# Prompt pro Claude Code — construir pedro.mansan.dev

> Cole isso no Claude Code dentro de um diretório vazio. Ele deve construir o site inteiro, fazer commits incrementais, e deixar pronto pra deploy em Cloudflare Pages.

---

## Quem sou eu e por que esse site existe

Sou Pedro Henrique Jesus Mansan, dev full stack pleno, 4 anos de experiência, stack principal Python/Django + Vue. Mirando mercado gringo (US$ 4.5k–7k/mês remoto). Domínio `mansan.dev` já comprado no Cloudflare Registrar. Esse site vai em `pedro.mansan.dev`.

Função do site: ser o link de portfólio que vai no LinkedIn, no GitHub, no currículo, em toda aplicação. Um recrutador técnico ou um engineering manager abre o site, lê por 60–90 segundos, e fica com uma ideia clara de quem eu sou, o que eu construí, e como eu penso.

Não é um site comercial. Não tem CTA de "Hire me!". Não tem testimonials. Não tem hero gradient. É um site de engenheiro que escreve software sério.

## Stack obrigatória

- **Framework:** Astro (última versão estável)
- **Styling:** Tailwind CSS (integração oficial do Astro)
- **Conteúdo do blog:** Markdown ou MDX, usando Content Collections do Astro
- **Deploy alvo:** Cloudflare Pages — configurar `wrangler.toml` ou apenas garantir que `npm run build` produz `dist/` estático compatível
- **Tipografia:** uma serif boa pro corpo de texto + uma mono pra código. Sugestão: **Source Serif 4** (corpo) + **JetBrains Mono** (código). Carregar via `@fontsource` (self-hosted, sem Google Fonts CDN — privacy + performance). Sans-serif só se realmente precisar em UI.
- **Sem React, sem Vue, sem framer-motion, sem shadcn-ui.** É um site estático de conteúdo. Astro puro com componentes `.astro`.

## Estrutura de páginas

### `/` (home)

- Nome do topo
- Bio de 2–4 linhas em prosa, **sem bullets, sem buzzword**. Algo tipo:
  > "I'm a full stack developer working on multi-tenant SaaS — mostly Python/Django on the backend, Vue on the frontend. I like systems with hard edges: auth, multi-tenancy, performance under real load. Currently studying CS at UTFPR. Based in Brazil."
  
  (Você pode ajustar a redação, mas mantém o tom — primeira pessoa, sem floreio, sem "passionate about".)
- Links pra `/work`, `/writing`, `/uses`, `/now`
- Footer minúsculo com: GitHub (placeholder `github.com/youboll` — TODO: confirmar antes de publicar), LinkedIn (`linkedin.com/in/pedro-henrique-4047891b5`), email (`pedro.ciclobrasil@gmail.com`)

### `/work`

Texto humano sobre o que fiz na Mindz, escrito em prosa. **Não copiar o currículo em bullets.** Escreve como se eu tivesse contado a um colega num bar.

Material bruto pra você reescrever em prosa (entregas-chave em ordem de impressão técnica):

1. **Migração de Design System** (Fomantic UI → Vuexy, 150+ páginas) em **uma semana**, orquestrando 10 agentes Claude Code com 4 sub-agentes cada (40+ agentes em paralelo). Trabalho que tipicamente leva meses manualmente.
2. **Refatoração RBAC → ABAC** do modelo de autorização da plataforma.
3. **Multi-DB router em Django** pra arquitetura database-per-tenant — usuário loga uma vez e alterna entre múltiplas plataformas.
4. **OAuth2 server side dedicado** (parte servidor, não cliente).
5. Nova versão da API privada da plataforma.
6. Componentes Vue reutilizáveis adotados pelo time.
7. Otimização de performance — caça sistemática a N+1.
8. Node customizado pra n8n.

Estrutura sugerida da página: parágrafo de abertura sobre a Mindz (SaaS multi-tenant de área de membros e cursos online — checkout, hospedagem de vídeo, e-mail marketing, afiliados, comunidade). Depois 3–5 parágrafos curtos, cada um sobre uma entrega ou tema (autorização, multi-tenancy, agentes, performance). No fim, antes da Mindz, mencionar a história curta da Frutap: aos 17 anos, Jovem Aprendiz num setor administrativo, classifiquei notas fiscais com Naive Bayes em Python por iniciativa própria, fui realocado pra função técnica.

Tom: factual, sem se gabar, sem se diminuir.

### `/writing`

Lista de posts do blog, ordem cronológica reversa. Cada item: título, data, tempo de leitura estimado.

Posts a criar como **placeholder com frontmatter completo + um parágrafo de stub**, pra eu preencher depois:

1. `orchestrating-40-claude-code-agents.md` — "Orchestrating 40 Claude Code agents to migrate 150 pages in one week"
2. `rbac-to-abac-migration.md` — "Migrating from RBAC to ABAC: when role explosion becomes unmanageable"
3. `multi-db-router-django.md` — "Building a multi-DB router in Django for database-per-tenant SaaS"
4. `server-side-oauth2-django.md` — "Server-side OAuth2 in Django: when django-oauth-toolkit isn't enough"
5. `hunting-n-plus-one.md` — "Hunting N+1: how I systematically find query bottlenecks in Django"

Frontmatter: `title`, `description`, `pubDate`, `draft: true` em todos por enquanto. Configura a listagem pra esconder drafts em build de produção.

Estrutura individual de post: título grande, data + tempo de leitura logo abaixo em texto pequeno cinza, conteúdo em Markdown puro com bom estilo de tipografia (parágrafos com `max-width` legível, code blocks com syntax highlighting via Shiki — vem incluído no Astro).

### `/uses`

Lista do que eu uso de verdade, no estilo [usesthis.com](https://usesthis.com). Categorias:

- **Editor & terminal:** (TODO: preencher — provavelmente VS Code ou Neovim, terminal, etc)
- **Linguagens & frameworks principais:** Python, Django, JavaScript, TypeScript, Vue
- **AI tooling:** Claude Code (orquestração de agentes em paralelo pra refatorações), também usei outras ferramentas mas Claude Code é a principal
- **Infra & DBs:** Docker, Linux daily driver, MySQL, Redis, AWS (RDS)
- **Outras ferramentas:** Git, n8n
- **Hardware:** (TODO: preencher)

Deixa TODOs explícitos como `<!-- TODO: preencher -->` onde eu precisar completar. Não inventa.

### `/now`

Página curta, primeira pessoa, sobre o que tô fazendo nesse momento. Inspiração: [nownownow.com](https://nownownow.com).

Conteúdo inicial (você pode polir):

> Cursando o 3º período de Ciência da Computação na UTFPR, em Marechal Cândido Rondon/PR. Procurando posição de full stack mid-level, preferência remoto. Escrevendo sobre sistemas que construí nos últimos anos. Estudando system design e refinando inglês falado pra entrevistas.
>
> *Última atualização: [data automática do build]*

Idealmente o "última atualização" é gerado automaticamente do timestamp do arquivo no build.

### `/404`

404 minimalista, com link de volta pra `/`. Texto seco, tipo "This page doesn't exist." Sem ASCII art. Sem piada.

## Design / vibe

**Minimalismo de engenheiro sério.** Referências mentais: [paulgraham.com](http://paulgraham.com) (mas com tipografia melhor), [danluu.com](https://danluu.com), [fly.io blog](https://fly.io/blog/), [registerspill.thorstenball.com](https://registerspill.thorstenball.com).

**Cores:**
- Fundo: branco quase puro (`#FAFAF8` ou similar) ou preto quase puro pra dark mode (`#0E0E0E`)
- Texto: cinza muito escuro no light mode (`#1A1A1A`), cinza muito claro no dark (`#E8E8E8`)
- Acento (links, ênfase muito pontual): um único tom, **sem azul royal**. Sugestão: um vermelho-tijolo escuro tipo `#8B2635` ou um verde-floresta tipo `#1F4D2C`. Escolhe um e usa em tudo.
- **Sem gradientes. Sem sombras decorativas. Sem rounded-2xl em tudo.**

**Tipografia:**
- Corpo: serif (Source Serif 4 ou similar). Tamanho confortável (~18–19px). Line-height generoso (1.6–1.7).
- `max-width` do conteúdo entre 65–72ch. Texto que respira.
- Títulos: mesma serif, peso semibold, sem tudo-em-caps.
- Mono: JetBrains Mono pra inline `code` e blocos.

**Layout:**
- Single column. Conteúdo centralizado. Margens generosas em mobile e desktop.
- Nav simples no topo: nome à esquerda como link pra home, links pras 4 páginas à direita. Texto só. Sem logo.
- Footer minúsculo: 1 linha com os 3 links externos (GitHub, LinkedIn, email) e ano.

**Dark mode:**
- Implementa toggle persistente em `localStorage`. Detecta `prefers-color-scheme` na primeira visita.
- Toggle discreto no canto do nav, sem ícone gigante.

## Extras necessários

- **Open Graph + Twitter cards** em todas as páginas (título, descrição, imagem padrão simples — pode ser SVG gerado com o nome em uma cor sólida)
- **RSS feed** do blog em `/rss.xml` (Astro tem integração oficial `@astrojs/rss`)
- **Sitemap** em `/sitemap.xml` (`@astrojs/sitemap`)
- **`robots.txt`** permitindo tudo
- **Lighthouse 100 ou perto disso** em performance, SEO e accessibility — sem JS desnecessário, imagens otimizadas se houver
- Componente `<Layout>` reutilizável que aplica nav, footer, head meta, etc

## Anti-padrões — coisas que NÃO faz

- ❌ Não importa React, Vue ou qualquer framework de UI. Astro puro com `.astro`.
- ❌ Não usa shadcn-ui, Radix, Headless UI. Não precisa.
- ❌ Não usa framer-motion, lottie, GSAP. Site é estático e silencioso.
- ❌ Não usa gradient roxo-rosa em hero. Não usa gradient nenhum.
- ❌ Não inventa números, métricas, percentuais que eu não te dei. Se faltar dado, deixa TODO.
- ❌ Não inventa nomes de empresas, clientes, depoimentos.
- ❌ Não cria página `/contact` com formulário (precisaria backend). `mailto:` no footer resolve.
- ❌ Não usa Google Fonts via CDN (privacy + performance). Self-host com `@fontsource`.
- ❌ Não enche de emoji decorativo na UI. Texto limpo.
- ❌ Não escreve "passionate about", "rockstar", "ninja", "10x", "synergy", "leveraging cutting-edge".
- ❌ Não enche o `package.json` de dependências. Mínimo necessário.

## Estrutura de arquivos esperada (referência)

```
.
├── astro.config.mjs
├── tailwind.config.cjs
├── package.json
├── tsconfig.json
├── public/
│   ├── robots.txt
│   └── favicon.svg
└── src/
    ├── content/
    │   ├── config.ts
    │   └── blog/
    │       ├── orchestrating-40-claude-code-agents.md
    │       ├── rbac-to-abac-migration.md
    │       ├── multi-db-router-django.md
    │       ├── server-side-oauth2-django.md
    │       └── hunting-n-plus-one.md
    ├── layouts/
    │   └── Layout.astro
    ├── components/
    │   ├── Nav.astro
    │   ├── Footer.astro
    │   └── ThemeToggle.astro
    ├── pages/
    │   ├── index.astro
    │   ├── work.astro
    │   ├── now.astro
    │   ├── uses.astro
    │   ├── 404.astro
    │   ├── rss.xml.js
    │   └── writing/
    │       ├── index.astro
    │       └── [slug].astro
    └── styles/
        └── globals.css
```

## Como entregar

1. Inicializa o projeto Astro (`npm create astro@latest`), escolhe template mínimo, TypeScript strict.
2. Adiciona Tailwind via integração oficial.
3. Constrói tudo acima.
4. **Faz commits incrementais conforme avança** (não um commit gigante no fim). Mensagens claras: `init astro project`, `add tailwind + base layout`, `add home page`, etc.
5. Testa `npm run build` no fim — tem que rodar sem erro nem warning.
6. Roda `npm run preview` e confere visualmente as 5 páginas + um post draft.
7. Cria um `README.md` na raiz com: stack, como rodar local, como deployar no Cloudflare Pages, lista de TODOs que ficaram pra eu resolver (links, hardware no `/uses`, números reais nas histórias do `/work` se quisermos adicionar depois).

## Critério de pronto

- `npm run build` sem erro
- 5 páginas (`/`, `/work`, `/writing`, `/uses`, `/now`) + 404 + 5 posts draft
- Dark mode funcionando
- RSS, sitemap, robots.txt presentes
- Lighthouse > 95 em todas as métricas em build local
- Zero referências a "passionate", "rockstar", emoji decorativo, gradient roxo
- TODOs claros no código onde precisar de input meu

Quando terminar, me dá um resumo do que foi feito, lista de TODOs pendentes, e o comando exato pra eu deployar.
