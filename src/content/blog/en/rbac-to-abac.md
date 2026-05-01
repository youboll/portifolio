---
title: "From RBAC to ABAC: when role explosion becomes the problem"
description: "When five roles became forty-two, half ending in `_custom_v2`, the model stopped fitting product reality. How I rebuilt authorization around credential-scoped attributes inside a Django SaaS."
pubDate: 2026-04-29
readingTime: "10 min read"
tag: "auth"
---

Before describing the refactor itself, I want to be precise about what I did and didn't do. Inside a multi-tenant Django SaaS platform, I built a new authorization app (`permissions/`) and plugged it into a V2 API where the credential carries **its own** set of roles and custom permissions — decoupled from the human user who owns it. I did not touch the platform's regular login (Django sessions, signup, password reset). What changed was the authorization surface that the API and OAuth2 server expose to external integrations.

In the actual code, the words "RBAC" and "ABAC" never appear in any comment. That framing is my technical reading of what the system became, not a manifesto I wrote. If a colleague greps the repo for either acronym they'll find nothing. Felt fair to open with that.

## The old model, which didn't have a nice name

What existed before the refactor was a hybrid between flag-based and role-based, dressed as RBAC. The user `Profile` had fields like `admin`, `team`, `staff`, plus a pile of `*_perm` flags (`courses_perm`, `gurupay_perm`, `marketing_perm`, etc.). Each flag authorized a fuzzy bucket of actions. There was no single source of truth — to know whether someone could do X, you'd grep three or four places: Profile, course relationships (instructor of which?), team membership, and sometimes the view itself.

The V1 API had the worst of it: it authenticated against a legacy `AppApi` model and returned an `ApiUser` that was basically a sentinel. When an integration called the API and uploaded a file, the file ended up orphan or attributed to the stub. It was the kind of debt nobody touched because the system "worked."

The explosion started when the product asked for cases that no longer fit the model. Things like:

> "This customer wants to grant their integration read access on courses, write access on enrollments, but only on the courses that this specific staff member created."

The "but only on" is the giveaway. It doesn't fit a global `editor` role. It doesn't even fit a fixed combination of roles. It fits a predicate that takes `(subject, target object)` and checks if the subject is the creator. That's ABAC by the book, even if nobody in the room had used the word.

At that point you have three options:

1. Add more roles to the RBAC system. This is the classic explosion — every new slice becomes a new role, and pretty soon you have 80 roles with subtle differences nobody understands.
2. Build an override system on top of roles. Bandage on bandage, and every new feature becomes a prayer that the sum doesn't break.
3. Replace the engine with one that takes attributes as decision input. That's the option I picked.

## The new architecture

I built a Django app called `permissions/` with three pieces.

**`permissions.py` — declaration of standard roles.** It's a dictionary nested by resource → action → predicate. The predicate can be `True`, `False`, or a function (usually a lambda) taking `(subject, object, **kwargs)` and returning a boolean. Eleven standard roles ended up declared (`root`, `admin`, `team`, `courses`, `gurupay`, `statistics`, `marketing`, `editor`, `integration`, `teacher`, `student`), covering resources like enrollment, course, content, exam, forum, certificate, payment, subscription, email suppression, credits, coupons. Six hundred-plus lines just for the role declarations, and that's fine — reading them is trivial, and what matters is that "what can or cannot happen" lives in one place.

**`typing.py` — structural typing for resources.** For each resource there's a `TypedDict` saying which actions it accepts. An enrollment resource exposes `view`/`create`/`update`. A certificate resource exposes `view`/`update`/`download`/`reissue`/`refresh`/`cancel`. That gives me shape guarantees — if anyone writes a new role pointing at an action that doesn't exist, the validator catches it in development, not in production. At the bottom of `permissions.py` I run `JsonValidator(Role, no_extra_keys=False)` over each standard role at startup, gated by `DEBUG`. Broken roles fail loud and early.

**`permission_manager.py` — the engine.** Here's the separation that makes everything click:

```
PermissionManager        ←  for human users
  ├ Oauth2PermissionManager  ←  for Grant (OAuth2 token)
  └ ApiPermissionManager     ←  for ApiCredential (server-side)
```

The way roles are derived changes per case, but the engine that evaluates the predicate is identical. For a human user, I derive the applicable roles at runtime from profile attributes (admin, staff, team, `*_perm` flags, instructor relationships). For an OAuth2 token, I take the token owner's maximal roles and **intersect them with the token's scopes** — roles outside the scope are dropped before any decision. For an `ApiCredential`, I **don't consult the owner user**: I take the roles and `custom_role` stored on the credential itself. This is where the fine-grained granularity lives.

The `ApiCredential` has a `custom_role` field, a `JSONField` validated against the `Role` `TypedDict`. That product scenario — "read on courses, write on enrollments, but only the courses the staff member created" — literally becomes a `custom_role` written ad-hoc for that credential. In the UI, the customer composes a "permissions personality" for their integration and the credential carries that personality with it. It's not the owner user that has the permission. It's the credential.

## Unifying V1 and V2 credentials

The step that cleaned house most was credential unification. Before the refactor, V1 and V2 had separate models — V1 against `AppApi`, V2 starting fresh with something new. I deleted the legacy branch and pointed V1 at `ApiCredential` too. That's subtle but important: V1 wasn't rewritten; it just changed identity source. Endpoints stayed the same, contracts stayed the same. But now every V1 or V2 call knows exactly who the real owner is (`credential.user`) and what effective roles the credential has.

Side effect: uploads stopped going orphan. Before, I had files in S3 attributed to an `ApiUser` stub. After, every API upload is credited to the credential's owner — which fixed auditing and recovery. The commit doing this (`fix: Using the credential owner to upload the files`) looks small but it's one of the most important pieces of the story, because it's the point where ABAC predicates like `lambda user, obj: user.id == obj.created_by_id` finally start to mean something — before that commit, `user` was a sentinel and the comparison was meaningless.

## OAuth2 scopes mapped onto roles

The OAuth2 server's scopes didn't become a separate technical entity. Each scope maps directly onto one of the standard roles (`webhook`, `courses`, `gurupay`, `statistics`, `marketing`, `editor`, `team`, `admin`). Two effects come from this. First, it's easy for the customer to understand — when they authorize an external integration, they see a list of scopes that match areas they already recognize in the product. Second, the `Oauth2PermissionManager` applies the scope intersection with no translation table: role *is* scope.

A real incident confirmed the choice: an N8N integration broke because its token didn't have the `webhook` scope. Instead of creating an exception or a special role, the fix was to add `webhook` as an available scope and adjust the selection UI. That's the kind of incident that, in an RBAC model, becomes refactor time. In the new model, it was configuration.

## What's still pending, honestly

The `Student` role in `permissions.py` carries a comment from me: `# TODO Needs refactoring to be used in production`. I wrote it as a prototype to unblock the student flow and never went back to refine it. It's probably still there. It works, but it's more permissive than it should be for the level of granularity the rest of the system offers. I left the TODO as visible debt rather than a casual remark exactly so it would nag at me.

Another thing I didn't cover: the ABAC refactor lives in the `solyd_ead/` project. The other project in the monorepo (`eadguru/`) has its own `accounts/` and stays on the previous model. That wasn't oversight — it was scope. ABAC was born to solve API/integration authorization, and that surface lives in `solyd_ead`. `eadguru` is a central manager with a different authorization profile, and tackling it would require a dedicated round.

And the uncomfortable item: the commit messages on this work are short. Good isolated branches (`api_v2_credential_unification`, `webhook_permission_scope_error`, `move_oauth2_auth_page_to_integrations_submenu`), good MR discipline on GitLab. But the written justification for "why ABAC" isn't in the repo. It's in the heads of people who lived it, and in conversations that never became an ADR. This post is the first serious attempt to put that justification in writing.

## What I learned

The most important thing I learned from this refactor is that **authorization has three things that look like one**: how you describe what can happen (roles), how you decide whether it happens (engine), and where you decide (call site). Mixing all three in the same file is what creates the chaos. Separating them — roles in `permissions.py`, engine in `permission_manager.py`, call sites in the authenticators — is what lets each evolve without dragging the others. ABAC isn't a better model just because "attributes are more flexible than roles." It's a better model because, when implemented right, it forces that separation.

The second thing is that **the credential needs its own identity**. In the old model, an API key was a fuzzy extension of the human user. In the new model, it's a first-class entity — has an owner, has roles, has `custom_role`, has a lifecycle. That's what unblocks serious integrations. Serious customers don't want to grant "admin user access" to a third-party integration; they want to grant restricted access that makes sense for their case. ABAC with first-class credentials makes that cheap.
