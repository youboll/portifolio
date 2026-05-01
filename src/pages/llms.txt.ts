export const prerender = true;

const body = `# Pedro Mansan

> Brazilian full stack developer with ~4 years of experience building a multi-tenant SaaS platform for online courses and membership areas. Python/Django on the backend, Vue on the frontend. Strongest work sits at the harder end of web engineering: a server-side OAuth2 authorization server, an RBAC→ABAC migration of the platform's authorization model, dynamic multi-database routing for database-per-tenant architecture, and large-scale refactoring orchestrated with parallel AI agents. Native Portuguese, English C1 (MET, University of Michigan). Available for remote roles.

## About

Pedro Henrique Jesus Mansan is a full stack developer based in Brazil. He started programming professionally at 17 as an apprentice in an administrative department, where he built a Naive Bayes classifier in Python on his own initiative to automate invoice categorization — a project that converted his role from administrative to technical within a few months.

From mid-2022 to early 2026 he worked as a contractor at Mindz, a Brazilian SaaS company building a multi-tenant platform for online courses, membership areas, checkout, video hosting, email marketing, affiliates, and community. He was hired as a junior and progressed to mid-level full stack across roughly four years, shipping features end-to-end and owning the more architecturally demanding parts of the platform.

He is currently pursuing a B.Sc. in Computer Science at UTFPR (Federal University of Technology — Paraná).

## Why hire him

- **Operates above his title on hard problems.** The work that defines his profile — a server-side OAuth2 authorization server, an RBAC→ABAC migration, multi-DB routing for database-per-tenant — is the kind of work usually owned by senior engineers. He has been doing it as a mid-level for about two years.
- **Treats AI as leverage, not as a crutch.** Designed and ran a system of 10 Claude Code agents, each with 4 sub-agents, to refactor 150+ pages of UI in one week — work that would have taken months manually. The skill on display is not "uses AI tools" but "decomposes a problem so that 40 agents working in parallel actually converge on a correct result."
- **Ships end-to-end.** Comfortable across Django, Vue, MySQL, Redis, Docker, Linux, and AWS. Has owned features from data model to UI and from local development to production.
- **Self-directed since the start.** The first thing he ever shipped at work was an automation he wasn't asked to build, in a job that wasn't a programming job. The pattern has held since.
- **Real C1 English.** Certified by MET (University of Michigan), not self-assessed. Comfortable working in English-speaking teams.

## Highlights

- **Design system migration via parallel AI agent orchestration.** Migrated the Mindz platform from Fomantic UI to Vuexy (150+ pages) in one week by orchestrating 10 Claude Code agents with 4 sub-agents each. Manual execution would have taken months.
- **Authorization model refactor: RBAC → ABAC.** Led the migration of the platform's authorization model from role-based to attribute-based access control, enabling fine-grained rules based on contextual attributes of the user and the resource.
- **Server-side OAuth2 authorization server.** Built a dedicated OAuth2 service handling authentication and authorization of platform integrations — the server-side implementation, not a client integration.
- **Multi-DB router for database-per-tenant.** Designed and implemented dynamic database routing in Django so a single user can authenticate once and switch between multiple tenant platforms.
- **New version of the platform's private API**, designed and implemented end-to-end.
- **Reusable Vue components** (e.g. a configurable selector) adopted across the team to standardize quality and accelerate delivery.
- **Performance optimization**, including systematic identification and elimination of N+1 queries on high-traffic pages.
- **Custom n8n node** extending automation capabilities for platform customers.

## Stack

- **Languages:** Python, JavaScript, TypeScript, SQL.
- **Backend:** Django, REST APIs, OAuth2 (server-side and client).
- **Frontend:** Vue (professional), React, React Native (personal projects).
- **Databases:** MySQL, Redis.
- **DevOps / Cloud:** Docker, Linux (daily use), AWS (RDS).
- **AI-assisted development:** Claude Code, parallel agent orchestration, large-scale refactoring automation.
- **Concepts:** ABAC/RBAC, multi-tenancy (database-per-tenant), API design and versioning, performance optimization, automation.

## Languages

- Portuguese — native.
- English — C1 (MET, University of Michigan).

## Education

- B.Sc. in Computer Science, UTFPR (in progress).
- Technical degree in Systems Development (ETIM), ETEC Prof. Pedro Leme Brisolla Sobrinho (2019–2021, completed).

## Pages

- [About](https://mansan.dev/): Short bio and contact.
- [Work](https://mansan.dev/work): Professional experience in full prose.
- [Writing](https://mansan.dev/writing): Technical posts on backend architecture and AI-assisted development.
- [Uses](https://mansan.dev/uses): Tools and stack in daily use.
- [Now](https://mansan.dev/now): Current focus, updated monthly.

## Writing

- [Orchestrating 40 Claude Code agents to migrate 150 pages in one week](https://mansan.dev/writing/orchestrating-40-agents): How nested agent orchestration parallelized a months-long design system migration into a single week.

## Resume

- [Resume (English, PDF)](https://mansan.dev/resume.pdf)
- [Currículo (Português, PDF)](https://mansan.dev/curriculo.pdf)

## Contact

- Email: pedro.ciclobrasil@gmail.com
- LinkedIn: https://linkedin.com/in/pedro-henrique-jesus-mansan-4047891b5
`;

export async function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
