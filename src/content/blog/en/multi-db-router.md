---
title: "Database-per-tenant in Django: dynamic routing and cross-platform login"
description: "Each customer has their own MySQL database. The router was easy. Letting an admin log into platform A and click through to platform B without re-authenticating was the hard part."
pubDate: 2026-04-29
readingTime: "11 min read"
tag: "django"
---

The platform I worked on is multi-tenant database-per-tenant: each customer has their own MySQL database, and routing is resolved at runtime by the hostname (`<tenant>.ead.guru`, `<tenant>.mindz.com.br`, or a custom domain the customer pointed at us). The foundation already existed when I picked up this feature — Diego had written a lean `TenantMiddleware` and a `TenantRouter` that returned the current tenant's database name in `db_for_read` / `db_for_write`. It worked fine for the normal case: one browser, one hostname, one database.

Things got interesting when the product asked for something new: **the same user needs to access multiple platforms with a single login**. Picture a teacher selling courses on three different brands, each one running as a separate tenant. Today they have to remember three URLs and log in three times. We wanted: they log in once, see a small list of platforms they have access to, and click one to "enter" — without typing a password again.

That deceptively simple sentence touches almost everything: middleware, session, database router, identity model across databases, ORM, cache, signals, and bypass for payment webhooks. This post is the anatomy of the solution that ended up running.

## Background assumptions

Identity across databases is the **email**. There's no ID synchronization. The Pedro user exists in tenant A's database with `id=42`, in tenant B's database with `id=7`, and the only thing tying them together is the `email` field. I know that design has trade-offs — you give up cross-database FKs — but given the system's state when this work started, it was the realistic path. Switching identity to a shared UUID would be a migration of a different magnitude.

There's a small "shared" database (I'll call it `multi_tenant`) holding the registry of which workspaces exist, which users belong to which (the `UserWorkspace` table), cross-tenant settings, and that kind of metadata. The per-tenant databases hold the actual content (courses, students, payments, etc.).

And there's Diego's foundation: `setup_db_connection` dynamically registers connections in `connections.databases` with names like `eadguru_<id>` and a password derived via HMAC-SHA256, so the ORM can talk to the tenant's database during the request.

## What I built on top

Three pieces.

### 1. `TenantMiddleware` gets three resolution modes

It used to be hostname-only. Now it's a chain in precedence order:

1. **Hostname** — traditional members mode. Kept working as before, with no change for end users hitting the platform's URL directly.
2. **Signed `selected_ead_id` cookie** — HTTP-only, `samesite=Lax`, 30-day expiry, signed via `request.get_signed_cookie` with its own salt. This cookie is the user's selection memory. When they click a platform from the list, I issue this cookie and the middleware reads it on every following request. Tampering with the cookie raises `BadSignature` and falls through.
3. **DEV fallback** — first `UserWorkspace` for the user. Useful in development, not exercised in production.

The piece that makes the switch persist is `_sync_cookie`: whenever the `THREAD_LOCAL.EAD_ID` resolved this request differs from the value received in the cookie, I reissue the cookie. That avoids drift between what the middleware decided and what the browser believes.

A prosaic but important detail: I also added `_is_affiliate_path`, which separates affiliate paths into a thread-local flag consumed by the router and by a third piece, `profile_table_patch` — explained below.

### 2. `DatabaseBoundaryMiddleware` — the seam between "logged in to A" and "now I'm in B"

This is the central piece. It compares two values on every request: the `THREAD_LOCAL.EAD_ID` resolved this request (from hostname or cookie) and `request.session.authenticated_ead_id` (recorded when the user logged in). If they differ, the user crossed a database boundary — left tenant A for tenant B without logging out. The middleware then calls `cross_database_boundary`.

What `cross_database_boundary` does:

1. The right connection is already registered (`set_current_ead` stamped it in `THREAD_LOCAL` and Sentry tags).
2. Look up the User in the target database by the logged-in user's email.
3. If they don't exist, force `logout`. The user has no account in this tenant, end of story.
4. If they do, `logout` from the old context and `login` in the new database. That re-runs Django's login on the new boundary without prompting for a password.

The part that might raise eyebrows: **there's no password verification**. Login on the target database is by trust in an already-authenticated session. The natural question is "what stops an attacker from forging `selected_ead_id`?" Answer: the cookie is signed. Forgery requires the `SECRET_KEY`. If the attacker has the `SECRET_KEY`, the game ended long before they got to this middleware.

The more interesting question is "what stops a user from selecting a tenant that isn't theirs?" Answer: `UserWorkspace` is the source of truth. Even if the cookie points at any `EAD_ID`, if the user doesn't exist in the target database, `cross_database_boundary` logs them out. Email is the validation key.

### 3. `TenantRouter` gets write protection

The original router simply returned the database name in `db_for_read` and `db_for_write`. No protection. It trusted that the ORM, in the current tenant's context, would write to the right database.

That almost never breaks. But "almost" is the problem. All it took was a misconfigured signal, an `obj.save()` in an unexpected place, or a migration running off-hours, to write to the shared database what should have gone to the tenant. And because the shared database is cross-tenant, that becomes a leak.

I added two layers:

- `ALLOWED_APPS_DEFAULT_WORKSPACE`: allowlist of apps that **may** write to the shared database.
- `ALLOWED_MODELS_ON_DEFAULT_WORKSPACE`: a whitelist of models with field-level granularity. Stricter than the app-level allowlist.

If a write doesn't pass the whitelist, it falls into `_route_to_user_workspace`. That function tries to find the user's correct workspace via `UserWorkspace`. If the workspace hasn't been provisioned yet, it asks eadguru to create one and polls until it's ready (timeout of `WORKSPACE_PROVISION_TIMEOUT`, default 30s, polling 2s). If even that doesn't resolve, it **raises** instead of accepting the write silently.

The stance is fail-loud rather than fail-open. I'd much rather have a broken request and a Sentry error than a silent write to the wrong place.

In development I short-circuit all of this with `EAD_FORCE_DEFAULT_DB=True`. The comment in the code says it: "only makes sense in prod where each tenant has its own workspace." In dev each person has just one database and the protection gets in the way.

## `profile_table_patch` (the weirdest piece)

There's a case where the same `User` has different profiles in different databases — affiliate paths use `multi_tenant.Profile`, the rest use `ead.Profile`. Both are bound to the same `User` via a `OneToOne` relation, but they live in different apps. The ORM caches the descriptor at runtime and gets confused if you switch contexts without warning it.

The fix was a context manager that swaps the `User.profile` descriptor at runtime depending on whether the request is affiliate or not. It's ugly. I know it's ugly. But the alternatives — duplicating `User`, building a model abstraction layer — were more invasive than the scope warranted.

This is the kind of piece that lives in a dedicated file (`profile_table_patch.py`) with a giant comment explaining why it exists, exactly because nobody will figure it out from the name.

## Other seams

**Payment webhooks bypass.** The middleware's `ALLOWED_URLS` list contains the payment gateway webhook endpoints. They reach any database to record the charge result, skipping suspended/maintenance/cookie checks. This is necessary because the gateway doesn't know the user's session — it hits the URL with an event token, and we have to process it.

**Sentry tag per request.** `set_current_ead` stamps `ead_name` and `ead_id` as tags, so any Sentry error already comes labeled by tenant. Without this, multi-tenant debugging is a lottery.

**Tenant-prefixed cache.** This already came from Diego's work: `cache_prefix` (django-redis) and `cacheops_prefix` (cacheops) use `<ead_id>:` as a prefix. I added a per-request `APICache` that clears at the end of the middleware's `__call__` — useful for avoiding cache leaks between requests on the same process.

**Migrations.** `allow_migrate` orchestrates the separation: the `multi_tenant` app migrates to the shared database in production, to `default` in tests; other apps migrate to per-tenant databases. That sounds small until you forget and migrate the `UserWorkspace` table into every database in the world.

## Where this is and isn't honest

Some of this feature was coded by Diego before me — `setup_db_connection`, the initial `multi_tenant` app structure, the `TenantRouter` baseline. I built on top. The architectural leap (selection cookie, `DatabaseBoundaryMiddleware`, `cross_database_boundary`, write protection, `profile_table_patch`, `UserWorkspace` in eadguru) was mine, but it was possible because the foundation was there.

I haven't confirmed in production that `_route_to_user_workspace` is a cold path (I hope so — inadvertent writes should be rare). I don't have metrics on how many users actually switch between platforms day to day. The whole feature got consolidated into a giant squash in March 2026, so the iteration history is partly lost in the log — another debt this post tries to repair narratively.

The question that always lingers in multi-tenant is: how long does database-per-tenant scale? It depends on tenant volume and per-tenant weight. For this project, we had dozens of databases, not thousands, and each one was small. For that profile, database-per-tenant is comfortable. For other profiles (thousands of small tenants sharing resources), schema-per-tenant or row-level with a tenant column on the key would be a better fit. Not a religious decision, a load decision.
