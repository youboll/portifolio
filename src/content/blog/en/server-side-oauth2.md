---
title: "Server-side OAuth2 in Django: when django-oauth-toolkit isn't enough"
description: "django-oauth-toolkit covers the client side. Issuing tokens for a federated multi-tenant SaaS with rotating credentials lives outside the happy path — and that's where the work actually is."
pubDate: 2026-04-29
readingTime: "9 min read"
tag: "auth"
---

We usually think of OAuth2 from the **client** side: you're an app, you want to talk to Google's API, you follow the dance, you receive an access token, you stick it in a header, done. That's the common case, it's pedagogical, and the entire internet documents it. The trouble is it only tells half the story.

The other half is when **you are the OAuth2 server**. Other tools — N8N, Zapier, third-party integrations your customer wants to plug in — will ask for access to their account inside your product. You need the consent screen ("Allow App X to access your data?"), grants, scopes, refresh tokens, revocation. And you need all that integrated with your application's authorization model, not as a parallel system.

That's the painful half, and it's the half I worked on inside the multi-tenant SaaS platform I was at.

## Why `django-oauth-toolkit` alone isn't enough

`django-oauth-toolkit` (DOT, from here on) is a solid library. It gives you the endpoints (`/o/authorize/`, `/o/token/`, `/o/revoke_token/`), the models (`Application`, `Grant`, `AccessToken`, `RefreshToken`), and the standard flows. For a simple application, you install it, configure `AUTHENTICATION_BACKENDS`, declare your scopes in `settings.py`, and you're done.

What it does **not** give you:

- Integration between OAuth2 scopes and your internal authorization model. If you have a system of roles or permission flags, fitting that into the "can this token do X?" decision is on you.
- Good UX on the consent screen. The default template is functional and ugly. No serious customer authorizes an integration looking at that.
- Defense against subtle flows. For example: an unauthenticated user hits `/o/authorize/` and DOT routes them straight to the consent screen — without requiring login first. That's a real bug I fixed.
- Scope vocabulary aligned with your product. Out of the box you end up with technical scopes (`read`, `write`) that mean nothing to your end customer.
- Action attribution. When an external integration creates a resource via OAuth2, who's the "creator"? The token's owner? The integration itself? Without deciding and implementing, it ends up orphan.

DOT is the foundation, but it's deliberately generic. The layer that makes it useful for your product, you have to build.

## The approach: vendor + surgical customization

The first decision was *vendoring*. Instead of keeping `django-oauth-toolkit` as an external dependency, I (and whoever came before me) copied its code into the repo at `solyd_ead/oauth2_provider/`. That's a controversial decision — you take on the maintenance burden, you lose easy upgrades, you gain total control.

For this case, it was worth it. The customizations we needed weren't trivial enough to fit into subclasses or monkey-patching. They were in templates, in `views/base.py`, in serializers — scattered. Having the whole tree in the repo made both understanding and surgical changes easier.

A caveat: most of the code in this app is upstream. Anyone cloning this from me isn't seeing my work — they're seeing the work of the `jazzband/django-oauth-toolkit` team. My commits there are small and specific, never a core rewrite.

## What I changed (in impact order)

### 1. Login required before consent

Classic bug. The OAuth2 flow sends the user to the server's authorization endpoint with `client_id`, `redirect_uri`, `response_type`, `scope`, `state`. If the user is **not logged in** when they hit that URL, what should happen? Right answer: redirect to login, then back to consent. DOT, at our version, was showing the consent screen directly.

The practical consequence: the user landed on "Allow App X to access your data?" without authenticating, and clicking "Authorize" errored because there was no `request.user`. Worse: in some browsers with a recycled session, you could authorize as the last user who'd been logged in there. Not an active exploit, but a smell of one.

The fix was adding `LoginRequiredMixin` (or equivalent, depending on the view) to the `AuthorizationView` hierarchy. Isolated branch, small MR, easy review. It's the kind of cleanup that looks insignificant but rules out a whole class of incident.

### 2. Consent modal redesign

DOT's default screen is a raw `<form>` with the scopes in a `<ul>`. It works. It inspires zero confidence in the end user — it looks like phishing. I redesigned it on the design system (Vuexy Bootstrap 5) with layout consistent with the rest of the product: header with the integration's name, description, scopes laid out in explanatory cards, clear "Authorize" and "Cancel" buttons, and a discreet link to revoke later.

Important detail: the **text** of each scope was rewritten from "view_courses" to "Read your courses and lesson contents." Whoever authorizes isn't a dev. It's the customer's admin, and they need to understand what's happening.

### 3. Moved the OAuth2 management page to the Integrations submenu

Information architecture detail. The page where the end customer saw the OAuth2 apps they'd authorized was at the top level of the admin, with poor discoverability. I moved it inside the "Integrations" submenu, alongside Webhooks and API Keys, and adjusted the sidebar entry. Small, but the discoverability bump was visible.

### 4. Scopes aligned with roles

This is the point where OAuth2 touches the ABAC refactor I did in the same window (I wrote about it in another post). Scopes didn't become a separate technical concept. Each scope maps directly onto a role in the authorization system: `webhook`, `courses`, `gurupay`, `statistics`, `marketing`, `editor`, `team`, `admin`. Two effects.

First: `Oauth2PermissionManager` applies the intersection between the token owner's maximal roles and the token's scopes, with no translation table needed. Role is scope.

Second: the customer authorizing sees a list matching areas they already recognize in the product. "Allow X to read your **courses**" is understandable; "Allow X to access scope `read:resources:c`" isn't.

That decision cost nothing and simplified maintenance. Every time I added a new role, the corresponding scope came along free.

### 5. The N8N case: missing `webhook` scope

A real case I resolved that illustrates how the integration with the internal model pays off. A customer plugged in N8N. N8N requested the `webhook` scope. The scope wasn't in the server's available scopes list, so the token came out without that permission and N8N automations silently failed.

In a model where scopes are a separate technical entity, that would be a bug with rework. In the model where scope = role, it was: add `webhook` as an available scope, adjust the selection UI, merge, deploy. Done. Dedicated branch, small MR, everything in place.

## How the ABAC design pairs with OAuth2

I'll keep this short because there's a whole post just about ABAC, but the point is: the OAuth2 server issues tokens in two ways, and how the system decides what each token can do is different.

- **`Grant` / `AccessToken` (regular OAuth2)**: the token belongs to a human user. `Oauth2PermissionManager` derives the user's maximal roles and intersects with the token's scopes.
- **`ApiCredential` (server-side, outside the OAuth2 flow)**: the credential has its own `roles` and `custom_role`. `ApiPermissionManager` **does not consult the owner user** — it uses what's on the credential. Fine-grained granularity.

The separation is what lets each one evolve without dragging the other. OAuth2 is the path for the end customer to authorize third-party integrations. `ApiCredential` is the path for the customer themselves to create a server-side key with custom permissions for one of their own apps. Different cases, needing different UX and different models.

## Points that deserve qualification

Most of the code in the `oauth2_provider/` app isn't mine — it's `django-oauth-toolkit`'s. My commits there focus on the changes listed above. If you read the repo, the perception might be "he barely touched anything." That's true. But the few things I touched are exactly what made DOT viable for our product.

I didn't write an OAuth2 server from scratch. Anyone wanting to learn the protocol at the deepest level should read [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) and maybe implement a simple draft just to learn. But for a production product on a real timeline, vendor-and-customize was the right bet, and it's the bet I'd make again.

The integration with the ABAC refactor was what made everything click. If you're thinking about adding server-side OAuth2 to a product that already has a rich authorization model, do it in the same work cycle. Trying to do them separately leaves loose ends that hurt for years.
