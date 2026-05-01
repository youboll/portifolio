---
title: "Orchestrating dozens of Claude Code agents to migrate a design system"
description: "Leading a design system migration with orchestrated Claude Code agents — what worked, what didn't, and three things I'd do differently."
pubDate: 2026-04-29
readingTime: "12 min read"
tag: "case study"
---

In 2026, I led one front of a design system migration on the multi-tenant SaaS platform I'd been building with two or three other devs. We moved off Fomantic UI (a Semantic UI fork that drags jQuery along with it) and onto Vuexy Bootstrap 5, all rendered inside Django templates. The whole migration — admin, student portal, checkout, auth flows — took a few weeks of execution, with short bursts where things ran in parallel in a way I couldn't have pulled off alone.

This post is about how I organized my piece of it, what worked, and three things I'd do differently next time.

## The starting point

Fomantic UI had been the project's bet since 2019. The class names were nice to read (`ui large primary button`, `eight wide column`), but the package shipped with jQuery, a LESS+Gulp build, and ~50 components loaded as one block. Modals, dropdowns, calendars, and validators were all initialized imperatively after DOM ready, in `.mjs` files scattered through the tree. Even a simple page pulled a lot of weight.

The decision to migrate wasn't mine alone. Diego, the project's lead architect, had evaluated jumping to Vue 3 + Vuetify and (correctly) backed away from it. The pragmatic choice was Vuexy **Bootstrap 5**, not the Vue edition. That preserved Django's template engine, kept us off the SPA path, and protected SEO. Diego built the initial scaffold — `templates/vuexy/base.html`, the inheritance chain, the `static/vuexy/` layout — in March 2026.

What was left for me to lead was the admin front: dozens of list pages, CRUD screens, dashboards, with the extra wrinkle that the same codebase serves two different servers via a `MEMBERS_MODE` flag (admin and student portal). Same template, conditional inside.

## Why agents instead of doing it by hand

I did the math first. Rewriting an average admin page from Fomantic to Vuexy took me 2 to 4 hours, depending on complexity. There were too many pages. Vuexy also brings its own component vocabulary that you have to internalize — it's not "swap `class='ui button'` for `class='btn'`". You're rethinking the grid (16 columns to 12), swapping icon sets (Font Awesome for Material Design Icons via Iconify), adapting datatables, dealing with markup differences in forms.

By hand, alone, I estimated months. With the whole team on it for six weeks, maybe. With orchestrated agents, I bet we could parallelize in a way humans don't — because the bottleneck stops being developer-time and becomes review-capacity.

The bet paid off, with caveats.

## The architecture: skills + worktrees + subagents

I built three things before I let any agent loose.

**Custom skills inside Claude Code.** Under the repo's `.claude/skills/` directory, I wrote instructions specific to this migration. The main ones:

- `create-vuexy-page` — a "plan → implement → verify" pipeline for rebuilding a Django page in Vuexy from scratch. Its header literally says "never adapt or reuse Fomantic components." That was the rule I had to encode because the natural temptation of any agent (and any human in a hurry) is to do CSS-class find-and-replace. It doesn't work. The components have different contracts.
- `mindzclub-design` — the parent skill, covering Figma-to-Vuexy translation across both servers. It also documented a shortcut I built specifically for agents: a `/ead/mcp-login/` route gated by `DEBUG=True` + localhost that authenticated in one navigation instead of filling out a form. Small detail, huge time savings at volume.
- `vuexy-components` — a catalog of available components. The "documentation I wished I had" for the agents to consult.
- `vuexy-to-figma` — the reverse path, generating a visual fidelity report on a migrated page.

**Specialized subagents.** Inside `mindzclub-design` I split out prompts for four or five distinct roles: design review, functional check, markup integrity check, visual comparison against Figma. The idea: every page, after migration, was audited by more than one pair of automated eyes before I looked at it. Each subagent loaded only the context it needed.

**Git worktrees instead of branches.** Each principal agent worked in an isolated directory via `git worktree add`. That avoids branch-switching hell, keeps each run airtight, and lets several agents edit completely different files at the same time without stomping on each other. At the end, the merge went straight into the main branch — so the GitLab history doesn't show `vuexy-01, vuexy-02`; it shows large squash commits signed by me. That created an annoying side effect (more on that below).

The mental model was: principal agents handle one page at a time, end to end, dispatching subagents to verify specific dimensions. I sat on the queue, validating what came back, stitching PRs together, resolving conflicts.

How many principal agents at once? It varied. At the peak, enough that I had nonstop review work for a full week. In quieter windows, one or two running while I did other things. The exact number lived in my head more than in any formal orchestrator — which is one of the things I'd do differently.

## What worked

The first big win was rewriting the datatable façade. Instead of migrating list page by list page, I rewrote the base — `datatable_base/templates/vuexy_datatable.html` and the `datatable_vuexy.mjs` that goes with it. Dozens of list screens got the new look just by swapping the base include. That's a productivity lever that has nothing to do with agents: it's architecture. But it paired well with the pipeline, because the agents didn't have to relearn each listing's idiosyncrasies.

The second was the `/ead/mcp-login/` shortcut. It sounds trivial. Anyone who's tried running a Chrome DevTools MCP agent against an authenticated app knows 80% of its time goes into the login form. A DEBUG-only route that logs the agent in directly saved an absurd amount of retry budget. Custom tooling for orchestration pays back fast.

The third was automated visual auditing. Subagents generated screenshots and diffed them against the Figma reference. When something diverged, a short report (`sidebar-figma-divergencias.md` was one example) landed and I read it in 30 seconds before approving. Without that, I'd have been opening every page by hand. With it, I was reading diffs as prose.

## What I'd do differently

**The dispatch protocol was informal.** Who decided which page went into which worktree? Me, in my head, looking at the backlog. No queue, no written prioritization, no retry policy when an agent failed. It worked because I was 100% on it, but it's fragile — if I'd been sick for a week, nobody picked up where I left off. Next time, I'd write the dispatch as code (a small queue, a JSON status file, nothing fancy).

**Commit messages came out terrible.** Because each worktree merged via squash, the commits left in the history have labels like "test: add test cases for partial invoice refunds" attached to a 240-file diff full of Vuexy datatable changes. Anyone reading the git log six months later is in for a rough time. The fix is simple — a commit template that summarizes the actual squash content — and I just didn't do it. That's the kind of debt that hurts later. This post is partially exorcising that debt.

**I was the sole quality gate.** Agents generated, subagents audited, I merged. No human code review at volume. On a team operating differently this would be unacceptable; in our case it worked because Diego and the rest had zero bandwidth for review. But it's not a default I'd recommend.

## The question that matters

Was it worth it? For this specific case — design system migration with well-defined components, automated verification possible, and a datatable façade as leverage — yes, with room to spare. The multiplier I felt was an order of magnitude, not two. It didn't replace architectural thinking (Diego still did the most important work: choosing Vuexy Bootstrap 5 over Vue 3 and laying the foundation). It replaced the mechanical work of applying that decision across hundreds of files.

Where I would **not** bet on this methodology: greenfield features with vague requirements, changes that depend on product context that doesn't fit in a prompt, and anything where automated verification is weak (subtle business logic, tax rules, authorization). For those, agents help but the bottleneck remains human.

The migration shipped.
