---
title: "Building a multi-DB router in Django for database-per-tenant SaaS"
description: "Django's database router hook is one paragraph in the docs. Here's what it actually looks like in production when each tenant has its own MySQL database."
pubDate: 2026-02-19
draft: true
readingTime: "10 min read"
tag: "django"
---

<!-- TODO: write the full post. Outline:
  - why database-per-tenant in the first place (regulatory + blast-radius)
  - the four router methods nobody explains well
  - thread-locals vs contextvars for the active tenant
  - migrations across N databases without going insane
  - testing: factories that respect the active connection
  - the gotchas: cross-DB foreign keys, M2M, raw SQL
-->

The standard advice for multi-tenant Django is a shared schema with a tenant
foreign key on every row. We did the other thing — one MySQL database per
tenant — and the routing layer is the load-bearing piece that makes it all
work.

This is a stub. The full write-up is coming.
