---
title: "Hunting N+1: how I systematize query bottlenecks in Django datatables"
description: "Slow datatables are almost always N+1. The detective routine I codified into a Claude Code skill — triggers, instrumentation, success criteria, and the two cases where it shipped."
pubDate: 2026-04-29
readingTime: "9 min read"
tag: "performance"
---

A slow datatable is one of the most frustrating experiences a product can deliver. The user runs a search, waits, watches the spinner spin, switches tabs to open YouTube, comes back. The table loaded. You as the dev look at it and you know it's N+1, but where exactly, and how do you prove it?

I turned this detective routine into a Claude Code skill called `optimize-datatable` in the project I worked on. It documents the method I'd already been using by hand — what was a bag of tricks in my head became a reproducible playbook. This post explains the method and shows the two cases where I applied it, with honesty about what's audited and what isn't.

## The premise: detection is static + controlled execution, not magic APM

Some people hear "performance" and picture an expensive APM, pretty dashboards, P95 alerts. That's all valid. But for Django datatables specifically, the path that catches 80% of the problem is more humble:

1. Read the `BaseDatatableView` code and look for known triggers.
2. Instrument a controlled execution via the Django shell, with `connection.queries` enabled.
3. Read `EXPLAIN` on the worst queries.
4. Decide what to change, apply, repeat.

The skill guides the agent (or a disciplined human) to do exactly that. It doesn't replace APM, but it also doesn't require anything you don't have in any Django project.

## The triggers I look for

The patterns that show up most often in Django datatables, in frequency order:

**Heavy annotations in `get_initial_queryset()`.** An `annotate(Sum=...)`, `Count`, `Subquery`, `Case/When`, or `ExpressionWrapper` on the base queryset poisons the `COUNT(*)` that `django_datatables_view` runs to count totals. The ORM tries to replicate the annotation in the count, and the query balloons unnecessarily. Symptom: total count takes much longer than the actual data query.

**Lambda in `add_column(...)` accessing FK or M2M.** The classic N+1. Each row in the table fires a new query loading the relation. Without `select_related` or `prefetch_related` on the base queryset, this multiplies linearly.

**`@property` or model method that runs an internal query.** This is the subtle one. You read the datatable code and it looks clean, but the column accesses `item.profile.last_active` — and `last_active` is a `@property` doing `Action.objects.filter(actor=self.user).order_by('-timestamp').first()`. `select_related` doesn't help, because the ORM doesn't know that property runs a query.

**`__icontains` in `search_fields` over a non-indexed column.** Works, but full table scan on every search. On a big table, that's UI seconds.

**Column with `orderable=True` pointing at an annotation.** If you mark the column as orderable and it's an annotation, sorting the table fires the annotation in the `ORDER BY`, which usually forces `Using temporary; Using filesort` in `EXPLAIN`.

## Instrumentation

The most useful part of the skill is the measurement instrumentation. It's not hard but most devs don't have it on tap.

```python
from django.test import RequestFactory, override_settings
from django.db import connection, reset_queries

with override_settings(DEBUG=True):
    reset_queries()
    factory = RequestFactory()
    request = factory.get('/admin/datatable/users/', {
        'draw': 1,
        'start': 0,
        'length': 50,
        'order[0][column]': 0,
        'order[0][dir]': 'asc',
    })
    request.user = some_admin_user
    
    view = UsersDatatable.as_view()
    response = view(request)
    
    print(f"Queries: {len(connection.queries)}")
    print(f"Slowest: {sorted(connection.queries, key=lambda q: float(q['time']), reverse=True)[:5]}")
```

That gives you, in seconds, the exact query count per request and which were the worst. On a datatable with serious N+1, you'll see 50+ queries. On a healthy one, 3 to 5.

For reading `EXPLAIN`, the skill keeps a mental table of what to look at:

- `type: ALL` → table scan, missing index or malformed query.
- `Extra: Using temporary` → the server materialized in memory, usually because of GROUP BY or ORDER BY on a non-indexed column.
- `Extra: Using filesort` → sorting outside the index, cost proportional to result set size.
- `key: NULL` on a column that should be indexed → the index wasn't picked (could be low cardinality, could be a silent type conversion).
- `rows: <very large>` → the optimizer estimates scanning a lot; revisit filters.

## Success criteria

The part of the skill I find most important, and that I see few people codify, are the **acceptance criteria**. What counts as "optimized"?

- **Query count is constant in N**, doesn't grow with table size. If page 1 (50 items) runs 5 queries, page 100 (50 items) needs to also run 5. If it runs 55, it's masked N+1.
- **COUNT time grows at most proportional to N**, not to N². If you have a duplicating JOIN in `get_initial_queryset()` (a careless reverse M2M), COUNT silently goes O(N²).
- **`EXPLAIN` shows no `type: ALL`** on big tables.
- **Total time < 1s for tables up to 100k rows.**

These criteria are what stop the "I think I optimized this" cycle. Without them, you change something, feel it improved, and six months later realize the curve is still quadratic, just with a smaller constant.

The skill includes a scale benchmark — you run the datatable at growing volumes (100, 1k, 5k, 10k, 50k, 100k rows via `bulk_create` in batches), save the timings to JSON, and heuristically classify growth by comparing the ratio `time_final / time_initial` against `N_final / N_initial`. If the first is ≈ to the second, it's O(n). If much larger, O(n²) or worse. If constant, O(1). Pretty to plot with `matplotlib` (Agg backend, no GUI).

## Case 1: `UsersDatatable` — "Last Active" column

This is the case that motivated `BulkBinder`, a helper I added to `datatable_base/utils.py`.

The "Last Active" column showed the date of the user's last action in the system. Innocent implementation:

```python
def render_last_active(self, item):
    return item.profile.last_active  # property running a query
```

The `last_active` `@property` on `Profile` did:

```python
@property
def last_active(self):
    return Action.objects.filter(
        actor_object_id=self.user_id
    ).order_by('-timestamp').first().timestamp
```

For each row of a 50-user page: 1 query on `Action`. 50 queries just for that column. Worse: `select_related('profile')` helps load the profile but not the property — the property keeps firing its own query.

The fix was to stop evaluating the property per row. Instead:

1. In the datatable's `prepare_results()`, after fetching the paginated queryset, fire **a single aggregated query**: `Action.objects.values('actor_object_id').annotate(last=Max('timestamp'))` filtered by the page's `user_id`s.
2. Build a `{user_id: last_timestamp}` dict in memory.
3. "Bind" that dict to the queryset items via a virtual key — hence `BulkBinder.bind('last_active', ...)`.
4. The column now reads `item.last_active_bound`, just a dict lookup, zero queries.

50 queries become 1. At page volume that's near the ceiling of possible savings for a column like that.

A trap I codified into the skill and almost got bitten by the first time: if `Action.Meta.ordering` is set (it was), and you use `.values('actor_object_id').annotate(...)`, Django **injects the ordering fields into the GROUP BY**. Result: you think you're getting one row per user and you get one row per (user, timestamp), which is one row per action — nothing grouped. The fix is calling `.order_by()` (empty) before `.values().annotate()` to disable the default ordering. It's one of those ORM gotchas that isn't in any tutorial.

## Case 2: manager dashboard — duplicating JOIN

This one's subtler. The base query of the manager's payments dashboard did:

```python
Payment.objects.filter(
    Q(account_key=key) | Q(splits__account_key=key)
)
```

The intent: get payments where the manager account is the holder **or** one of the split parties. Makes sense in your head. Less sense in SQL.

`splits` is a reverse M2M. When you use `Q(splits__account_key=...)`, the ORM creates a JOIN with the splits table. That means **a payment with 3 splits appears 3 times in the raw result set**. Django tries to hide this with `DISTINCT` (which has its own cost), or you end up handling duplication in code.

Worse: the `COUNT(*)` the datatable runs is now over the duplicating JOIN. You count 3000 rows instead of 1000 payments.

The fix was swapping the JOIN for a semi-join via `Exists`:

```python
Payment.objects.filter(
    Q(account_key=key) | Q(
        pk__in=PaymentSplit.objects.filter(account_key=key).values('payment_id')
    )
)
```

Or, equivalently:

```python
Payment.objects.filter(
    Q(account_key=key) | Exists(
        PaymentSplit.objects.filter(payment=OuterRef('pk'), account_key=key)
    )
)
```

`Exists` doesn't duplicate rows — it answers "is there or isn't there a split with this account?". The result set comes out clean, COUNT goes back to being real, and the execution plan is symmetric.

## What I don't have

Let me be explicit about what this skill does **not** numerically document. I have no commit or PR record of "before" and "after" times for the two optimizations above. I know they improved because the method I described proves it qualitatively, and because you could feel it clicking around. But if you ask me "did it go from 800ms to 80ms?", I don't have the number.

Calibrated honesty: the `UsersDatatable` case in particular had visible N+1 with `connection.queries` in the console — we went from a few dozen down to a single-digit number. The manager dashboard case eliminated row duplication, so the gain depends on the average number of splits per payment in the customer's data, which I didn't measure.

The skill was also formally applied to only those two cases, although I'd applied the same method by hand in several other places before it became a skill. Anyone reading the repo right now will see only one use of `BulkBinder` — in `UsersDatatable`. The abstraction exists; adoption is still low.

## What I took away from this work

The most important thing: **a Django datatable is a surface that rewards reusable tooling much more than one-off optimizations**. Investing 1h in `BulkBinder` pays back on every datatable touching the same column pattern. Investing 1h optimizing one specific column pays back only there.

The second: **writing down the success criteria is what separates "I think it improved" from "it improved."** The scale benchmark sounds like overkill for an optimization. It isn't. It's what stops you from accepting a constant-factor win when the problem was order-of-magnitude.

The third, more philosophical: **writing the skill is half the fun**. Before the skill, I had this method in my head, and applying it depended on me remembering the right pattern. After the skill, it applies the method to any datatable I point it at. I didn't replace the intuition — I codified it. And the act of codifying forces you to make explicit things you didn't know you knew.
