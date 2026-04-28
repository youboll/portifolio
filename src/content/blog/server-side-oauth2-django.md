---
title: "Server-side OAuth2 in Django: when django-oauth-toolkit isn't enough"
description: "The library covers the happy path. Producing tokens for a federated multi-tenant SaaS with rotating client credentials is not the happy path."
pubDate: 2026-01-30
draft: true
readingTime: "9 min read"
tag: "auth"
---

<!-- TODO: write the full post. Outline:
  - what django-oauth-toolkit gives you for free
  - why we needed to be the OAuth2 *server*, not just a client
  - the grant flows we actually use (auth code with PKCE, client credentials)
  - rotating client secrets without locking customers out
  - tokens in cookies vs. tokens in headers for embedded iframes
  - audit: every issued token traceable to a request
-->

Most teams reach for `django-oauth-toolkit` and call it a day. We needed to be
the identity provider for a fleet of white-labeled embeds, which meant doing
some things the toolkit does and a lot of things it does not.

This is a stub. The full write-up is coming.
