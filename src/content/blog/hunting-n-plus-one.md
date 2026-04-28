---
title: "Hunting N+1: how I systematically find query bottlenecks in Django"
description: "ORM laziness is a feature until your dashboard is doing twelve thousand queries per request. The diff between a slow page and a fast one is usually one select_related call."
pubDate: 2026-01-12
draft: true
readingTime: "7 min read"
tag: "performance"
---

<!-- TODO: write the full post. Outline:
  - why ORMs make N+1 the default
  - the tooling I trust: django-silk, django-debug-toolbar, manual `connection.queries`
  - reading EXPLAIN like a normal person
  - select_related vs prefetch_related — when each one is wrong
  - the Prefetch object is the sharpest tool in the box
  - guarding against regression: assertNumQueries in CI
-->

The fastest way to make a Django page slow is to render a list of objects and
loop over a related manager inside the template. The fastest way to make it
fast again is to notice you're doing that.

This is a stub. The full write-up is coming.
