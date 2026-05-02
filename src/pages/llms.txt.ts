export const prerender = true;

const body = `# Pedro Mansan

> Brazilian full stack developer, about four years building a multi-tenant SaaS for online courses and membership areas. Python/Django on the backend, Vue on the frontend. The work I'm proudest of sits at the harder end of web engineering: a server-side OAuth2 authorization server, an RBAC→ABAC rewrite of the platform's authorization model, dynamic multi-database routing for database-per-tenant, and a large refactor I orchestrated with parallel AI agents. Native Portuguese, English C1 (MET, University of Michigan). Available for remote roles.

## About

I'm Pedro Henrique Jesus Mansan, full stack developer in Brazil. My first job, at 17, was as an admin apprentice at Frutap, a yogurt and dairy company in the interior of São Paulo. I was supposed to file invoices; instead I taught myself enough Python to write a Naive Bayes classifier that did the categorization for me, and with better accuracy than the spreadsheet I was replacing. They moved me to the technical side a few months later and I never went back.

From mid-2022 to early 2026 I worked as a contractor at Mindz, a Brazilian SaaS for online courses and membership communities — checkout, video hosting, email marketing, affiliates, gamification, the works, all in one Django monolith. I joined as a junior and grew into mid-level full stack over about four years, shipping features end-to-end and owning the more architecturally demanding pieces.

Currently in the third semester of a B.Sc. in Computer Science at UTFPR (Federal University of Technology — Paraná).

## Why I might be a good fit

The work I've been doing for the last couple of years — a server-side OAuth2 server, an RBAC→ABAC migration, multi-DB routing for database-per-tenant — is what most teams give to senior engineers. I've been doing it as a mid-level. I'm comfortable across Django, Vue, MySQL, Redis, Docker, Linux and AWS, and I've owned features from data model to UI and from local dev to production.

I use Claude Code heavily, but as a tool, not as a substitute for thinking. The Mindz design system migration is a fair example: I designed an orchestration of 10 lead agents with 4 sub-agents each to refactor 150+ pages of UI in a week. The interesting part wasn't "I used AI" — it was decomposing the problem so that 40 agents working in parallel actually converged on something correct.

My English is C1 by MET (University of Michigan), not self-assessed. I'm comfortable working in English-speaking teams.

## Highlights

- Migrated the Mindz platform from Fomantic UI to Vuexy (150+ pages) in a week by orchestrating 10 Claude Code agents with 4 sub-agents each. By hand it would have taken months.
- Led the authorization rewrite from role-based to attribute-based access control, so permissions can be expressed as predicates over the user and the resource instead of role flags.
- Built a server-side OAuth2 authorization server (the issuer side, not a client integration) that handles authentication and authorization of platform integrations.
- Designed and implemented dynamic database routing in Django so a single user can authenticate once and switch between the tenant platforms they own.
- Wrote a new version of the platform's private API, end-to-end.
- Built a small library of reusable Vue components (a configurable selector among them) that the front-end team picked up as the default.
- Hunted N+1s systematically on high-traffic pages and took the slowest dashboards from twelve seconds to under a second.
- Wrote a custom n8n node so customers could wire Mindz events into the rest of their stack without going through me.

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
