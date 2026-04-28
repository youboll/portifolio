---
title: "Migrating from RBAC to ABAC: when role explosion becomes unmanageable"
description: "We started with five roles. Three years later we had forty-two of them, half ending in _custom_v2. Here's how we collapsed the model into attributes."
pubDate: 2026-03-08
draft: true
readingTime: "8 min read"
tag: "auth"
---

<!-- TODO: write the full post. Outline:
  - the warning signs of role explosion
  - what we tried first (role inheritance, scoped roles) and why it didn't help
  - the ABAC mental model: subject, resource, action, environment
  - the policy engine we landed on, and why we didn't use OPA
  - the migration: shadow-checking ABAC against RBAC for two weeks before flipping
  - perf trade-offs and the single-CTE rewrite
-->

Role-based access control is a beautiful abstraction right up until it isn't.
Ours stopped being one the day we shipped a role called
`affiliate_manager_with_billing_readonly_v2_temporary`.

This is a stub. The full write-up is coming.
