export const prerender = true;

const body = `# Pedro Mansan

> Brazilian full stack developer with ~4 years of experience. Python/Django on the backend, Vue on the frontend. Focus areas: multi-tenant SaaS architecture, OAuth2 authorization servers, RBAC/ABAC, performance optimization, and AI-assisted refactoring at scale. Native Portuguese, English C1 (MET). Based in Brazil, working remotely, currently looking for mid-level international roles.

## About

Pedro Henrique Jesus Mansan started programming professionally at 17 as an apprentice in the administrative department of Frutap Alimentos, where he built a Naive Bayes classifier in Python on his own initiative to automate invoice categorization — a project that converted his apprenticeship from administrative to technical.

From mid-2022 to early 2026, he worked as a contractor (PJ) at Mindz, a Brazilian SaaS company building a multi-tenant platform for online courses, membership areas, checkout, video hosting, email marketing, affiliates, and community. He was hired as a junior and progressed to mid-level full stack across roughly four years, owning features end-to-end in short cycles.

He is currently pursuing a B.Sc. in Computer Science at UTFPR (Federal University of Technology — Paraná), in his third semester.

## Status

The Mindz engineering team was dismantled at the end of April 2026. Pedro is available immediately and is targeting mid-level remote roles with international companies, with a fallback plan focused on Brazilian scale-ups if no offer materializes within ~60 days.

## Highlights

- **Design system migration via parallel AI agent orchestration.** Migrated the Mindz platform from Fomantic UI to Vuexy (150+ pages) in one week by designing a system of 10 Claude Code agents, each with 4 sub-agents, refactoring in parallel. Manual execution would have taken months.
- **Authorization model refactor: RBAC → ABAC.** Led the migration of the platform's authorization model from role-based to attribute-based access control, enabling fine-grained rules based on contextual attributes of the user and the resource.
- **Server-side OAuth2 authorization server.** Built a dedicated OAuth2 service (not a client integration) handling authentication and authorization of platform integrations.
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

- B.Sc. in Computer Science, UTFPR (in progress, 3rd semester).
- Technical degree in Systems Development (ETIM), ETEC Prof. Pedro Leme Brisolla Sobrinho (2019–2021, completed).

## Pages

- [About](https://pedro.mansan.dev/): Short bio and contact.
- [Work](https://pedro.mansan.dev/work): Professional experience in full prose.
- [Writing](https://pedro.mansan.dev/writing): Technical posts on backend architecture and AI-assisted development.
- [Uses](https://pedro.mansan.dev/uses): Tools and stack in daily use.
- [Now](https://pedro.mansan.dev/now): Current focus, updated monthly.

## Writing

- [Orchestrating 40 Claude Code agents to migrate 150 pages in one week](https://pedro.mansan.dev/writing/orchestrating-40-agents): How nested agent orchestration parallelized a months-long design system migration into a single week.

## Resume

- [Resume (English, PDF)](https://pedro.mansan.dev/resume.pdf)
- [Currículo (Português, PDF)](https://pedro.mansan.dev/curriculo.pdf)

## Contact

- Email: pedro.ciclobrasil@gmail.com
- LinkedIn: https://linkedin.com/in/pedro-henrique-4047891b5
`;

export async function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
