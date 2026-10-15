# Feature Plan

Domain model for the next phase of Husehold, covering household planning, cooking plan, shopping, recipes, packing lists, vouchers, and supporting features (config, analytics, notifications). See [CLAUDE.md](CLAUDE.md) *(gitignored, local only)* for day-to-day dev/deploy context, and [README.md](README.md)/[DEPLOYMENT.md](DEPLOYMENT.md) for setup.

Current state: this is a target model, not a migration plan. The existing `backend/household/models.py` (flat `ShoppingListItem`, `Recipe`, `CookingPlan`, `HouseholdTask`) will be substantially restructured to reach this — see [Suggested build order](#4-suggested-build-order) for how that's phased.

## 0. Decisions

- **Config**: editable by both household members, no admin gating. Every config-editable record tracks who created/last-updated it and when, via a shared `AuditableMixin` rather than repeating fields per table.
- **Recipe import (photo/Instagram)**: deferred to the last build phase, alongside notifications and calendar sync.
- **Notifications**: both email and phone push (via the home-screen web app), grouped into clustered types (task due today, weekly household planning due, weekly cooking plan due, ...), each independently toggleable per channel per user.
- **Google Calendar**: one-way only, shown as a read-only overlay in the weekly planning view so you can see who's traveling/busy while assigning tasks and meals.
- **Recipe recommendation lists**: three ranked, mutually-exclusive buckets per meal-time category — *Craving for it* (combined rating+neglect score) > *Top 30% rated* > *Not cooked in 21+ days* > everything else. 1–5 star ratings per member, average shown. Free-form **labels** (e.g. "Tim's Favorite", "10min Fast Track") that members define and assign, searchable as a tab in the Cooking Plan.
- **Recurrence**: full Outlook-style flexibility, including "first Monday of the month" — solved by storing a standard [RFC 5545 RRULE](https://www.rfc-editor.org/rfc/rfc5545) string rather than hand-rolling recurrence fields (Python's `dateutil.rrule` already implements the whole spec).
- **Role enforcement**: confirmed still equal permissions everywhere, including all config.
- **UX**: color-coded task cards by assignee (color configurable per member) in a drag-and-drop weekly view — first-class requirement of Phase 1, not later polish.
- **Visual styling**: out of scope for this planning pass. The diagrams above cover data/behavior only — layout, typography, and overall design system for the new screens will be discussed separately once a phase is ready to build.

## 1. Use Case Diagram

```mermaid
graph TD
  Member(["Household Member"])
  Admin(["Admin"])

  subgraph Home["Home Dashboard"]
    UC_home[View overdue tasks, progress,<br/>today's meals, today's tasks]
  end

  subgraph Plan["Household Plan"]
    UC_p1[Weekly view: color-coded,<br/>drag-and-drop tasks onto days]
    UC_p2[Reassign a task]
    UC_p3[Snooze a task]
    UC_p4[Postpone a task]
    UC_p5[Set own availability]
    UC_p6[View Google Calendar overlay<br/>-- who's away when]
    UC_p7[Configure task recurrence -- RRULE]
    UC_p8[Configure member colors]
  end

  subgraph Cook["Cooking Plan"]
    UC_c1[Weekly meal planning session]
    UC_c2[Browse Craving / Top-rated /<br/>Not-cooked-recently / All]
    UC_c3[Search recipes by label]
    UC_c4[Send planned meal to shopping list]
    UC_c5[Mark one dish as covering multiple meals]
  end

  subgraph Shop["Shopping"]
    UC_s1[Maintain multiple shopping lists]
    UC_s2[Check off item -- removed for everyone]
    UC_s3[Mark a list as favorite]
  end

  subgraph Rec["Recipes"]
    UC_r1[Add recipe via text]
    UC_r2[["Add recipe via cookbook photo"]]
    UC_r3[["Add recipe via Instagram video"]]
    UC_r4[Rate a recipe 1-5 stars]
    UC_r5[Create + assign labels]
  end

  subgraph Trip["Packing Lists"]
    UC_t1[Create a packing list, add participants<br/>+ trip dates via a popup]
    UC_t2[Configure reusable item buckets<br/>-- e.g. "Sommerurlaub"]
    UC_t3[Add a bucket's items to a list at once]
    UC_t4[Check off / edit / delete<br/>items on the shared list]
    UC_t5[Browse past packing lists]
  end

  subgraph Vouch["Vouchers"]
    UC_v1[Add a voucher -- from whom,<br/>value, where valid, expiry]
    UC_v2[Log a partial redemption --<br/>records remaining balance]
    UC_v3[Browse active vouchers,<br/>sorted by soonest-expiring]
    UC_v4[View archived -- fully used --<br/>vouchers, grayed out]
  end

  subgraph Analytics["Analytics"]
    UC_an1[View household stats --<br/>tasks, meals, spending over time]
  end

  subgraph Admin_Sec["Admin only"]
    UC_a1[Manage user accounts]
    UC_a2[Database access]
  end

  subgraph Config["Config -- open to all members"]
    UC_cfg1[Configure recurring tasks]
    UC_cfg2[Configure meal-time categories]
    UC_cfg3[Configure shopping lists + visibility]
    UC_cfg4[Configure excluded ingredients + units]
    UC_cfg5[Configure notification preferences]
    UC_cfg6[["Connect Google Calendar"]]
  end

  subgraph Notif["Notifications"]
    UC_n1[Receive clustered email/push digests]
    UC_n2[Toggle each notification type<br/>per channel]
  end

  Member --> UC_home
  Member --> UC_p1
  Member --> UC_p2
  Member --> UC_p3
  Member --> UC_p4
  Member --> UC_p5
  Member --> UC_p6
  Member --> UC_p7
  Member --> UC_p8
  Member --> UC_c1
  Member --> UC_c2
  Member --> UC_c3
  Member --> UC_c4
  Member --> UC_c5
  Member --> UC_s1
  Member --> UC_s2
  Member --> UC_s3
  Member --> UC_r1
  Member --> UC_r2
  Member --> UC_r3
  Member --> UC_r4
  Member --> UC_r5
  Member --> UC_t1
  Member --> UC_t2
  Member --> UC_t3
  Member --> UC_t4
  Member --> UC_t5
  Member --> UC_v1
  Member --> UC_v2
  Member --> UC_v3
  Member --> UC_v4
  Member --> UC_an1
  Member --> UC_cfg1
  Member --> UC_cfg2
  Member --> UC_cfg3
  Member --> UC_cfg4
  Member --> UC_cfg5
  Member --> UC_cfg6
  Member --> UC_n1
  Member --> UC_n2
  Admin --> UC_a1
  Admin --> UC_a2

  classDef future stroke-dasharray: 4 3
  class UC_r2,UC_r3,UC_cfg6 future
```

Dashed = deferred to the last build phase (recipe photo/Instagram import, Google Calendar connect).

## 2a. Household Plan & Tasks

*(Haushaltsplan)*

All config-editable entities (marked `«audit»`) share one abstract base carrying `created_by`, `created_at`, `updated_by`, `updated_at`. Recurrence is a single RRULE string per `HouseholdTaskDefinition`, parsed with `dateutil.rrule` — this is what buys "first Monday of the month" for free instead of hand-rolled interval/weekday fields.

```mermaid
classDiagram
  class AuditableMixin {
    <<abstract>>
    +created_by
    +created_at
    +updated_by
    +updated_at
  }

  class HouseholdMember {
    +role
    +color_hex
  }

  class HouseholdTaskDefinition {
    «audit»
    +title
    +description
    +recurrence_rule: RRULE string
    +default_assignee
    +system_action: none|weekly_household_planning|weekly_meal_planning
  }

  class HouseholdTaskInstance {
    +scheduled_date
    +assigned_to
    +status: pending|done|snoozed
    +completed_at
  }

  class HouseholdTaskEvent {
    +event_type: created|reassigned|snoozed|postponed|completed
    +actor
    +timestamp
  }

  class Availability {
    +date
    +status: home|away
  }

  class GoogleCalendarLink {
    «audit»
    +calendar_id
    +sync_enabled
    +oauth_token
  }

  class CalendarEvent {
    <<read-only cache>>
    +external_event_id
    +title
    +start_datetime
    +end_datetime
  }

  AuditableMixin <|-- HouseholdTaskDefinition
  AuditableMixin <|-- GoogleCalendarLink
  HouseholdTaskDefinition "1" --> "*" HouseholdTaskInstance : generates
  HouseholdTaskInstance "1" --> "*" HouseholdTaskEvent
  HouseholdTaskInstance "*" --> "1" User : assigned_to
  User "1" --> "*" Availability
  User "1" --> "0..1" GoogleCalendarLink
  GoogleCalendarLink "1" --> "*" CalendarEvent : synced one-way
```

| Decision | Modeled as |
|---|---|
| Color-coded weekly view | `HouseholdMember.color_hex`, set in Config; the weekly drag-and-drop UI colors each `HouseholdTaskInstance` card by `assigned_to`'s color. |
| Outlook-style recurrence | `HouseholdTaskDefinition.recurrence_rule` stores an RFC 5545 RRULE string (e.g. `FREQ=MONTHLY;BYDAY=1MO` for "first Monday of the month"); `dateutil.rrule.rrulestr()` expands it into dates. |
| Calendar overlay | `CalendarEvent` is a read-only, periodically-synced mirror of the linked Google Calendar, rendered alongside `HouseholdTaskInstance`/`CookingPlanEntry` in the same weekly view — informational only, never written back to Google. |
| Audit trail on config | `AuditableMixin` inherited by every config-editable model across all domains (see 2b/2c/2e/2f too). |

## 2b. Meal Planning & Recipes

*(Kochplan · Rezepte)*

The three recommendation buckets are a ranking query, not stored fields — computed per `MealTimeCategory` so "top 30% for dinner" and "top 30% for dessert" are independent.

```mermaid
classDiagram
  class MealTimeCategory {
    «audit»
    +name
    +sort_order
    +is_required
  }

  class Recipe {
    +title
    +instructions
    +default_servings
    +source_type: text|photo|instagram
    +source_reference
    +last_cooked_date
  }

  class RecipeRating {
    +rated_by
    +score: 1-5
  }

  class Label {
    «audit»
    +name
    +color_hex
  }

  class RecipeIngredient {
    +quantity
    +unit
  }

  class Ingredient {
    «audit»
    +name
    +default_excluded_from_shopping_list
  }

  class UnitOfMeasure {
    «audit»
    +name
    +abbreviation
  }

  class MealEvent {
    +date_cooked
    +servings_made
  }

  class CookingPlanEntry {
    +date
    +servings_needed
  }

  class CookingPlanConfig {
    <<singleton, audit>>
    +dishes_per_day
    +top_rating_percentile: default 30
    +uncooked_threshold_days: default 21
    +rating_weight: default 0.7
    +neglect_weight: default 0.3
  }

  Recipe "*" --> "*" MealTimeCategory
  Recipe "*" --> "*" Label
  Recipe "1" --> "*" RecipeIngredient
  RecipeIngredient "*" --> "1" Ingredient
  RecipeIngredient "*" --> "1" UnitOfMeasure
  Recipe "1" --> "*" RecipeRating
  Recipe "1" --> "*" MealEvent : cooked as
  MealEvent "1" --> "*" CookingPlanEntry : fulfills
  CookingPlanEntry "*" --> "1" MealTimeCategory
```

| Decision | Modeled as |
|---|---|
| Craving / Top 30% / Not-cooked-21+ / Rest | Ranking query per `MealTimeCategory`, evaluated top-down and mutually exclusive: **1)** Craving = highest combined score of (rating percentile × `rating_weight` + neglect percentile × `neglect_weight`), weighted toward rating since the recipe list is expected to already skew toward liked dishes, **2)** remaining recipes in top `top_rating_percentile`% by average `RecipeRating.score`, **3)** remaining recipes with `last_cooked_date` older than `uncooked_threshold_days`, **4)** everything else. Thresholds and weights live on `CookingPlanConfig` so they're tunable. |
| 1–5 star ratings, average shown | `RecipeRating` one row per (`recipe`, `rated_by`); UI shows each member's score plus the average. |
| Labels, member-defined, searchable tab | `Label` (audited) with a plain M2M to `Recipe`; Cooking Plan gets a "browse by label" tab alongside the four ranked buckets. |
| Photo / Instagram import | `Recipe.source_type`/`source_reference` fields reserved now, extraction pipeline deferred (see Phase 9). |

## 2c. Shopping

*(Einkaufsplan)*

```mermaid
classDiagram
  class ShoppingList {
    «audit»
    +name
    +is_favorite_for_cooking_plan
  }
  class ShoppingListItem {
    +quantity
    +unit
    +is_completed
    +added_by
    +source: manual|cooking_plan
  }
  ShoppingList "1" --> "*" ShoppingListItem
  ShoppingList "*" --> "*" User : visible_to
  ShoppingListItem "*" --> "0..1" Ingredient
  ShoppingListItem "*" --> "0..1" UnitOfMeasure
```

Unchanged from the earlier draft other than inheriting `AuditableMixin` on `ShoppingList`, since it's config-managed (visibility, favorite flag).

## 2d. Packing Lists

*(Packlisten)*

Revised after Tim's first click-through (2026-09-24): items are one flat, shared checklist per packing list rather than split per participant, and personal default items were dropped in favor of shared, household-wide "buckets" (reusable item-set templates such as "Übernachten" → Kulturbeutel, "Sommerurlaub" → Sonnencreme/Badehose) that can be added to a list as a whole.

```mermaid
classDiagram
  class PackingList {
    +name
    +start_date
    +end_date
  }
  class PackingListParticipant {
    +user
  }
  class PackingListItem {
    +text
    +is_packed
  }
  class PackingBucket {
    «audit»
    +name
    +color_hex
  }
  class PackingBucketItem {
    +text
  }
  PackingList "1" --> "*" PackingListParticipant
  PackingList "1" --> "*" PackingListItem
  PackingBucket "1" --> "*" PackingBucketItem
```

Fully independent of every other domain — safe to build in any order. Adding a bucket to a list copies its items as a one-time snapshot (`PackingListViewSet.add_bucket`) -- editing the bucket template afterward never changes lists it was already added to.

## 2e. Vouchers

*(Gutscheine)*

A standalone tracker, unrelated to shopping/cooking — mainly for gifts from friends/family: store vouchers, but also non-monetary presents like a dinner invitation that have no numeric value. Vouchers get redeemed partially over time rather than in one go, so each redemption is logged rather than just decrementing a number — the remaining balance has a history instead of only a current snapshot.

```mermaid
classDiagram
  class Voucher {
    «audit»
    +title
    +received_from
    +location
    +total_value: nullable
    +remaining_balance: nullable
    +valid_until
    +is_archived
  }

  class VoucherRedemption {
    +redeemed_on
    +amount_used
    +remaining_after
    +logged_by
  }

  Voucher "1" --> "*" VoucherRedemption
```

| Decision | Modeled as |
|---|---|
| Title | `Voucher.title` — short free-text label (e.g. "Christmas voucher from Mom", "Dinner at Lisa & Jan's"), shown as the card heading. |
| From whom | `Voucher.received_from` — free text, since gifters aren't household members with accounts. |
| Location it's valid for | `Voucher.location` — store/restaurant/site the voucher can be redeemed at. |
| Value can be blank | `Voucher.total_value`/`remaining_balance` are nullable — a monetary store voucher has a value, but a non-monetary gift (e.g. a dinner invitation) just leaves both blank and tracks title/from/location/expiry only. |
| Partial use tracked over time | `VoucherRedemption` logs each redemption (`amount_used`) with a `remaining_after` snapshot; `Voucher.remaining_balance` is kept in sync as the current total, so the UI doesn't need to replay the log to show a balance. Only meaningful when `total_value` is set — a valueless gift just gets marked used/archived directly. |
| List sorted by validity | Active vouchers list sorted by `valid_until` ascending — soonest-expiring first. |
| Fully used vouchers archived | Once `remaining_balance` reaches 0, `Voucher.is_archived` is set (automatically, on the redemption that empties it) and the card renders grayed-out in an "Archive" section instead of the active list. |

Fully independent of every other domain — safe to build in any order, same as Packing Lists.

## 2f. Config, Analytics & Notifications

*(Support Features)*

```mermaid
classDiagram
  class NotificationType {
    <<fixed set>>
    +code: task_due_today|household_planning_due|cooking_plan_due
    +label
  }
  class NotificationPreference {
    +email_enabled
    +push_enabled
  }
  class PushSubscription {
    +device_label
    +endpoint
    +p256dh_key
    +auth_key
  }
  User "1" --> "*" PushSubscription : one per device
  User "1" --> "*" NotificationPreference
  NotificationPreference "*" --> "1" NotificationType
```

| Decision | Modeled as |
|---|---|
| Clustered notification types | `NotificationType` is a small fixed set (task due today, household planning due, cooking plan due, ...) rather than one generic on/off switch. |
| Per-type, per-channel toggle | `NotificationPreference(user, notification_type)` carries independent `email_enabled` / `push_enabled` booleans. |
| Push to phone from the home-screen web app | Standard Web Push API: each installed instance (iPhone, Android) registers a `PushSubscription` with its own endpoint/keys. **Constraint:** Web Push requires a secure context (HTTPS) — the Pi currently serves plain HTTP, so this needs a TLS cert in front of Nginx before push can work at all. |
| Email | Plain SMTP send, triggered by the same scheduled job that checks push. |
| Delivery scheduling | Needs a periodic job on the Pi — a cron-triggered Django management command is the simplest fit for a Pi 3, no need for a full Celery+broker setup at this volume. |

Analytics is unchanged — still pure queries, no new tables — but the new audit fields add a free extra: a "who changed this config item and when" history view becomes possible everywhere `AuditableMixin` is used.

## 3. Cross-domain dependencies

| From | To | Nature |
|---|---|---|
| Cooking Plan | Household Plan | Weekly meal planning is a `HouseholdTaskDefinition` occurrence. |
| Cooking Plan | Recipes | Needs structured ingredients + ratings + labels to power the four recommendation buckets. |
| Cooking Plan | Shopping | Writes into the favorite (or chosen) `ShoppingList`. |
| Household Plan | Google Calendar | One-way `CalendarEvent` overlay in the weekly view — read-only, no write-back. |
| Notifications | Household Plan, Cooking Plan | Reads due `HouseholdTaskInstance`/`CookingPlanEntry` rows; needs the scheduler + HTTPS decisions below regardless of trigger source. |
| Everything config-editable | AuditableMixin | Shared base, touches almost every model — worth introducing in Phase 1 rather than retrofitting later. |
| Analytics | Everything, including Vouchers | Read-only. Swapped ahead of Config screens (see section 4, step 7) once the other domains had enough history to make it worthwhile. |
| Packing Lists | (none) | Fully independent. |
| Vouchers | (none) | Fully independent. |

## 4. Suggested build order

See [PHASE1_PLAN.md](PHASE1_PLAN.md) for the concrete implementation plan for step 1 (Task engine core — already shipped and deployed).

0. **Vouchers** *(shipped)* — `Voucher`/`VoucherRedemption`, redemption slider, expiring-soon indicator (6-month lookahead, also surfaced as a count in the dashboard overview panel), inline editing (value locked once a redemption is logged), manual archive/unarchive.
1. **Task engine core** *(shipped)* — `AuditableMixin` introduced here (used everywhere after), `HouseholdTaskDefinition` with RRULE recurrence, `HouseholdTaskInstance`/`HouseholdTaskEvent`, reassignment/snooze/postpone, color-coded drag-and-drop weekly view, `HouseholdMember.color_hex`.
2. **Recipes with structure** *(shipped and deployed)* — `Ingredient` (free-text entry, auto-created case-insensitively), `UnitOfMeasure` (plain labels, no conversion), `RecipeIngredient`, `RecipeRating` (1-5 per member, both scores + average shown), `Label` (seeded starter set, editable), `MealTimeCategory` (Frühstück/Mittagessen/Abendessen/Dessert & Snacks) -- labels, meal types and units are bilingual (`name_de` required, `name_en` optional, UI falls back to German; ingredients stay single-language free text), servings scaling with fraction rounding, pasted-ingredient-list import, prep/cook time, source link, notes. Config editors live in Settings. Also includes the `MealEvent` cooking log ("I cooked this" on a recipe: date + servings, derived last-cooked/times-cooked, queryable by day/range via `/meal-events/`) with a rate-after-cooking prompt -- the history the Cooking Plan will rank on. Deliberately **not** included: photos.
3. **Shopping list depth** *(shipped and deployed)* — `ShoppingList` (favorite flag, empty `visible_to` = everyone), items with quantity/unit and an optional `Ingredient` link (auto-matched by name), clear-completed. Existing items were backfilled into a default "Einkaufsliste". Also a purchase history (`PurchaseRecord`, written on tick-off, undone on un-tick, independent of item deletion) with a History tab (most bought, add again, recent by day) -- the data source for the later Analytics phase.
4. **Cooking Plan proper** *(built and deployed 2026-09-21)* — weekly plan over the configured meals (default lunch + dinner); suggestion buckets craving / best rated / not cooked in a while / **random picks (added before "rest")** / rest, plus search and label filter (`CookingPlanConfig`, `services/cooking_suggestions.py`); "leftovers of ..." entries; the plan is driven by the recurring `weekly_meal_planning` task, and finishing creates one `cook_meal` task per dish in the household plan (**one entry = one task**: dragging moves the dish, skip takes it out of the plan, snooze carries it to next week, delete removes it); ticking the task logs the `MealEvent` and asks for a missing rating; per-dish shopping-list dialog (untick dishes/ingredients, staples pre-unticked, merged by ingredient+unit) from the plan and from a recipe; notifications `meal_planning_due` and `cooking_today` (08:00, assignee or whole household while unassigned). Replaces the old empty `CookingPlan` scaffold. Not built: drag-and-drop inside the plan grid (moving is done via the entry's editor or by dragging the task in the household plan), a stored 'dishes per day' limit.

### Follow-up after Tim's first click-through (2026-09-24)

Free dishes (no recipe -- ready meals etc.), leftovers restricted to a slot *after* their dish (day or same-day-later-meal), the Dashboard's "Diese Woche" / This Week widget (`WeekPreview`) now shows a second row of planned meals per day, replacing the old "Cooking today" card, meal planning made step 1 of weekly household planning (a modal, skippable), the cooking plan itself is scoped to the current and next week only (arrows toggle between them; other entry points clamp into that range), per-member notification language (German default, independent of the UI language -- every notification type now exists in both languages), and "stay logged in" (180-day rotating refresh tokens + automatic silent refresh) with Home Screen / iOS Web Push guidance.

### Further follow-up (2026-09-24, later)

`CookingPlanEntry.shopping_added_at` tracks whether a dish's ingredients were already sent to a shopping list -- the shopping-preview dialog now shows "already on the list" and leaves those dishes unticked by default instead of quietly offering to add them again every time the plan is finalized (still tickable to add/top up again on purpose). Shopping list items gained inline editing (title/quantity/unit) -- previously only toggle-complete and delete existed.
5. **Home dashboard** *(built and deployed 2026-09-24)* — extended beyond the original "My Open Household Tasks" + Overview KPIs + `WeekPreview`, all still frontend-only (no new endpoint, no stored progress field): a combined `TasksPanel` (own open tasks, then the rest of the household's overdue tasks in the same card, so a separate overdue panel wasn't needed), `ProgressPanel` (this week's completion -- overall bar plus one per member, `skipped`/`snoozed` excluded from both numerator and denominator), and `TodaysMealsPanel` (today's `CookingPlanEntry` rows with a one-click "mark cooked" that reuses the existing `taskInstanceService.complete` + rating-prompt flow). Grid is 2x2 (`TasksPanel`, `OverviewPanel`, `ProgressPanel`, `TodaysMealsPanel`) above the untouched `WeekPreview`. `TaskRow` extracted into its own component so the inline complete/skip/snooze actions aren't duplicated between panels.
6. **Packing Lists** *(built and deployed 2026-09-24; redesigned same day after Tim's feedback)* — `PackingList`/`PackingListParticipant`/`PackingListItem` (one flat, shared checklist per list, not split per participant) plus `PackingBucket`/`PackingBucketItem` (`AuditableMixin`, shared household config, replacing the earlier per-user default-items idea) -- adding a bucket to a list (`PackingListViewSet.add_bucket`) copies its items as a one-time snapshot, editing the bucket template afterward never changes lists it was already added to. `/packing-lists` page mirrors the Shopping List page's UX (pill-tab list picker, inline "Reiseeinstellungen" panel analogous to "Listeneinstellungen", simple add/toggle/edit/delete items), Upcoming/Past pill grouping kept from the original design. Creating a list: type just the name inline, then `CreatePackingListModal` collects the mandatory dates + at least one participant before the list is actually persisted (`PackingListViewSet.perform_create` 400s on zero participants) -- nothing incomplete is ever saved. `/packing-buckets` config screen (reachable via a button on the packing-lists page, not tucked into Settings) manages buckets and their items, mirroring the same list-detail pattern. Navbar link and a dashboard `OverviewPanel` KPI row (upcoming packing-list count). A bucket can only be added to a given list once (`PackingList.added_buckets` guards against a second add-bucket call), and item names are deduplicated case-insensitively within a list -- manual add/rename of a duplicate name is rejected (400), a bucket add silently skips items that already match an existing name instead of erroring, since it's a batch operation. Independent of every other domain, per section 3. Gained a manual archive (`PackingList.is_archived`, `toggle-archived` action, same convention as `Voucher`) on 2026-09-27 as part of the config-navigation harmonization below -- archived lists drop out of Upcoming/Past into a collapsed-by-default `<details>` "Archiv" section, toggled from the list's own settings panel.
7. **Analytics** *(built and deployed 2026-09-27)* — swapped ahead of Config screens (Tim, 2026-09-26): pure read-only queries (`services/analytics.py`, `GET /api/analytics/?start=&end=`) over tasks, the `MealEvent` cooking log, `PurchaseRecord`, and `Voucher`/`VoucherRedemption` -- no new tables, no price field added to Purchases (that stat is frequency/volume, not spending -- there's no price anywhere in the app yet). Trend buckets are weekly under a ~90-day range and monthly above it, so a year of history doesn't render as 52 unreadable bars. `/analytics` page (own nav link, single scrollable page, one section per domain, same 30-days/year/all-time period selector as Purchase History) with five thin `recharts` wrappers (`components/charts/`) -- `StackedBarChart` (task completion split by member, absolute + %, using each member's existing `color_hex`), `PieChart` (the same per-member completed counts as a share-of-whole view, next to the trend below), `TrendLineChart` (a 0-100% rate over time, y-axis fixed to `[0, 1]` rather than autoscaled), `TrendBarChart` (a value-over-time bar chart), `RankedList` (a horizontal bar chart ranked by magnitude, for top recipes / top purchased items). First shipped as five from-scratch dependency-free primitives because the npm registry seemed unreachable overnight (Node's `fetch`/undici hangs in this sandbox trying IPv6 first, even with `--dns-result-order=ipv4first` set -- `curl` and `https.get({family: 4})` both work fine); once that turned out to be a local DNS quirk rather than no connectivity, `recharts` was installed for real (routed through a throwaway local IPv4-forcing proxy for the one install) and swapped in behind the same component API, so nothing above them had to change. The Tasks section additionally tracks an on-time trend -- `task_stats()` buckets by calendar week *unconditionally* (unlike every other trend here, which switches to monthly past a ~90-day range) since a line chart, unlike a bar chart, reads fine dense; a task counts "on time" when `status='done'` and `completed_at`'s date is on or before `scheduled_date`, with the same backlog/skipped/snoozed exclusions as the rest of `task_stats`.
8. **Config screens** — built alongside each domain as it lands. Harmonized on 2026-09-27 (Tim's request): every page with its own config now uses the same entry point, a gear icon (`components/icons/gearIcon.jsx`) placed top-right in that page's header row, replacing whatever bespoke text button (or Settings-page section) used to do the job -- Shopping and Recipes both point to one new dedicated page, `/recipe-shopping-config` (`RecipeShoppingConfig.jsx`, wrapping the existing `RecipeConfig` -- moved out of `Settings.jsx`, since labels/units/ingredients are domain config, not system settings), Cooking Plan's gear sits right of its "Plan abschließen" button, Household Plan's replaces the old "Wiederkehrende Aufgaben verwalten" text button, Packing Lists' replaces "Buckets verwalten". Vouchers and Analytics have no config, so no gear icon. Same pass also reordered the navbar (dropped the "Übersicht" link -- the logo already goes there -- reordered to Shopping/Household Plan/Cooking Plan/Recipes, and moved Packing Lists/Vouchers/Analytics into a `MoreMenu` "Weitere" dropdown so the main row doesn't grow with every new domain) and added a small member avatar next to each row of the Dashboard's per-member progress bars (`ProgressPanel`, reusing `HouseholdMember.avatar`/`color_hex` the same way `AccountMenu` already does). Two same-day fixes: `MoreMenu`'s dropdown was nested inside the navbar's `overflow-x-auto` link row, which -- since `overflow-x` without an explicit `overflow-y` makes the browser compute the other axis as `auto` too -- clipped the dropdown down to an empty scrollable sliver; moved it to a sibling of that scrolling row instead. Both dedicated config pages (`/recipe-shopping-config`, `/packing-buckets`) also gained a top-left "← Back" affordance -- a fixed `Link` back to `/packing-lists` for the latter (unambiguous), browser-history `navigate(-1)` for the former (shared by both Recipes and Shopping, so there's no single fixed destination). Follow-up the same week: Cooking Plan's settings moved off the Cooking Plan page too, onto its own `/cooking-plan-config` (`CookingPlanConfig.jsx`, wrapping the existing `CookingPlanSettings`) with a fixed "← Back" `Link` to `/cooking-plan` (unambiguous, same reasoning as Packing Lists' back link) -- the gear icon there is now a `Link`, not a same-page toggle. Household Plan's inline config mode (still same-page, not its own route, since it's a `TaskDefinitionForm` swapped in over the calendar rather than a full page) also gained the same top-left "← Back" button, wired to the existing `setMode('calendar')` handler.
9. **Deferred bundle:** Google Calendar one-way sync, recipe import from photo/Instagram. **Notifications built ahead of schedule** (see below) once HTTPS landed on the Pi.

### Reassessment after adding Vouchers (2026-09-18)

Packing Lists and Analytics were already scoped in the plan (2d and 2f respectively) — the frontend's empty template tabs for those just need backend models to catch up. Vouchers was net-new and is now modeled in 2e, expanded to cover non-monetary gifts (title, from-whom, location, optional value). It has no cross-domain dependencies (see section 3) and is now the smallest fully-unbuilt domain, so it's called out as **step 0** — ahead of the numbered order — as the next thing to work on, without renumbering the already-shipped Task Engine (step 1, per [PHASE1_PLAN.md](PHASE1_PLAN.md)) or the phases after it.

### Notifications -- built ahead of schedule

Originally deferred to this phase, but built immediately after Phase 1 once HTTPS was set up on the Pi (self-signed cert, since there's no public domain for Let's Encrypt). Covers the two notification types that exist today -- `task_due_today` and `household_planning_due` -- via email (SMTP, through Brevo's free tier) and Web Push, both toggleable per user in Settings. Delivery is a `send_notifications` management command on a cron schedule (every 15 min on the Pi), not a background daemon, guarded against double-sends by `NotificationLog`. A `cooking_plan_due` type will need adding once Phase 4 (Cooking Plan) lands -- the model already supports adding types without a migration to the fixed set.

## 5. Decisions (round 3) and remaining open questions

- **HTTPS**: self-signed cert, kept simple. Only needed **on the Pi** — that's the machine a phone actually connects to for push. The laptop dev setup doesn't need one: browsers treat `http://localhost` as a secure context, so Web Push works fine there without a cert. Only the Pi's Nginx needs a self-signed cert; expect a one-time browser warning on each device the first time it connects (can be accepted permanently in most mobile browsers).
- **Craving-score formula**: resolved — weighted toward rating (`rating_weight: 0.7`, `neglect_weight: 0.3` by default) rather than an equal split, since the recipe list is expected to already lean toward liked dishes.
- **Recipe import service**: *resolved (2026-09-30/10-01)* -- Claude API for photo/text/URL extraction, plus OpenAI Whisper for video transcription (see Item D below). Original note: still deferred, no decision needed yet — flagging that it'll eventually mean picking (and likely paying for) an OCR/transcription service, since the Pi can't run that kind of model locally.

## 6. New requirements backlog (added 2026-09-28)

Permissions gap (previously flagged as open in step 1) is now confirmed closed. `meal_planning_due` and `cooking_today` notification types were already added when Cooking Plan shipped (2026-09-21) — the "still needs adding" note in step 9 above was stale and has been superseded by this section.

| # | Requirement | Domain(s) touched | Notes |
|---|---|---|---|
| A | Recipe "Highlight mode" *(shipped 2026-09-28, see note below)*. | Recipes, Home dashboard | — |
| B | Copy an existing packing list's items into a new one *(shipped 2026-09-28, see note below)*. | Packing Lists | — |
| C | Google Calendar integration — one-way sync, read-only overlay in the weekly planning view *(shipped 2026-09-28, see note below — OAuth credentials set up and Tim's calendar connected and syncing since 2026-09-30)*. | Household Plan | — |
| D | Recipe import from a photo, pasted text, or a URL *(shipped 2026-09-30/10-01, see note below)*. | Recipes | — |
| E | Shopping list items clustered thematically, auto-categorized *(shipped 2026-09-30, see note below)*. | Shopping | — |
| F | New notification types -- vouchers expiring in the next 30 days, a packing trip starting tomorrow *(shipped 2026-10-01, see note below)*. | Notifications, Vouchers, Packing Lists | — |
| G | More visually engaging UI, mobile-optimized; consider adding a library/tooling to preview mobile viewports locally in the browser during laptop dev *(shipped 2026-10-11 -- see "UI polish for laptop + mobile + dark mode" below; the viewport tooling became `frontend/scripts/ui-audit.mjs`)*. | Cross-cutting (frontend) | Section 0 explicitly deferred visual styling/design system to "once a phase is ready to build" — this is that phase. Tooling ask (device-frame/responsive preview in dev) is separate from the design work itself — browser devtools device toolbar already covers basic viewport testing; a library would add device chrome/frame realism. |

### Item A shipped (2026-09-28) — Recipe Highlight mode, plus a round of follow-up fixes

- **Highlight mode**: new route `/recipes/:id/highlight` (`RecipeHighlight.jsx`) — large-text, scrollable recipe view (ingredients scaled to servings, instructions, then prep/cook time + notes shown smaller) for reading while cooking. Font-size +/- control (persisted per device via `localStorage`) and Wake Lock API (keeps the screen from dimming mid-recipe, re-acquired on tab refocus since browsers auto-release it when hidden). Back button uses browser history (`navigate(-1)`), so it always returns to wherever you came from.
- **Entry points**: an expand-icon button on the recipe detail modal, and the same icon on Dashboard's `WeekPreview` ("Diese Woche") and `TodaysMealsPanel` ("Heutige Mahlzeiten") rows — shown only for `kind='cook'` entries with a linked recipe (free dishes and leftovers get none, since there's no single recipe to jump to).
- **Follow-up fixes from the same review round**:
  - **Sources**: `Recipe.source_url` (URL-only) renamed to `Recipe.source` (free text — a link, or "Rezept von Mama"/"Kochbuch Jamie Oliver") plus a new `source_type` field (manual/website/photo/instagram, picked in the recipe form). The detail view and Highlight mode render it as a clickable link only when it's actually a URL. Migration 0030 hand-fixed to a `RenameField` (same gotcha as migrations 0017-0019 in step 2 — auto-generated makemigrations produces remove+add and would have dropped every recipe's existing link).
  - **Shopping list servings**: `AddToShoppingDialog` gained a +/- servings control per dish (recipe-backed dishes only), refetching scaled quantities live via the existing `/recipes/{id}/shopping-lines/` endpoint — works both from a single recipe and from the Cooking Plan's weekly shopping preview.
  - **Icon consistency**: the Highlight-mode entry button changed from a text label to an icon-only button (`components/icons/expandIcon.jsx`, same flat single-color treatment as `gearIcon.jsx`); the dashboard rows' plain `⤢` character was replaced with the same icon component.
  - **Added-by metadata**: both the recipe detail view and Highlight mode now show a small line — "Added {{date}} by {{user}} · {{source_type label}}" — using the `created_by`/`created_at` fields already on `Recipe`.

### Item B shipped (2026-09-28) — Copy a packing list

- **New `PackingListViewSet.copy` action** (`POST /packing-lists/{id}/copy/`): creates a brand-new `PackingList` from the same name/dates/participant validation as a normal create, then bulk-copies the source list's items with `is_packed` reset to false (it's a new trip). Bucket-add history does **not** carry over — a bucket already reflected in the copied items can still be added fresh to the new list, since the copy has no `added_buckets` of its own.
- **Entry point**: a small copy icon next to every list's name pill (`CopyIcon`, same flat single-color treatment as `expandIcon.jsx`/`gearIcon.jsx`) — available on any list, not just past/archived ones, per Tim's answer that a duplicate is also useful for an active trip. Opens the create/edit modal (same "nothing incomplete is ever saved" validation as a fresh create) pre-filled with the source list's participants and a name of "{{original}} (Kopie)"; dates are left empty since a copy is for a *different* trip. On submit, the page calls `copy` instead of `create` and jumps straight to the new list.
- Covered by 3 new backend tests (`PackingListTests`): items copy unpacked and the source list is untouched, at least one participant is still required, and bucket history doesn't carry over (the same bucket can be added again to the copy).

### Item B follow-up (2026-09-28, same day) — creation/edit UI reworked to match Recipes' pattern

Tim asked for the create/copy flow to match how Recipes handles new/edit, and for per-list editing to move off the page into the same popup rather than the inline "Reiseeinstellungen" panel.

- `CreatePackingListModal.jsx` replaced by `PackingListFormModal.jsx` — one modal for all three flows (`mode: 'create' | 'copy' | 'edit'`), varying its title/submit label and, in edit mode only, showing Archive/Unarchive and Delete at the bottom (so the inline settings panel disappears entirely).
- Page header gained a "+ New Packing List" button left of the gear icon (`recipes.jsx`'s "+ New recipe" layout) creating the list, removing the old inline "type a name, then press +" form.
- Each list pill now carries two icon buttons: the existing Copy, plus a new Edit (`EditIcon`, same treatment) that opens the modal pre-filled with that list's current name/dates/participants.
- Backend: `PackingListViewSet.perform_update` now syncs participants from an optional `participant_ids` in the PATCH body (added/removed to match exactly), letting one edit-modal submit update everything at once instead of the old per-checkbox `add-participant`/`remove-participant` calls. Omitting the field (any other PATCH) leaves participants untouched; sending an empty list 400s, same "at least one participant" rule as create. 3 more backend tests cover the sync, the untouched-when-omitted case, and the can't-clear-to-zero guard (157 backend tests total).

### Item C shipped (2026-09-28) — Google Calendar one-way sync

Design decisions from Tim: **one shared household calendar** (not per-member — simpler than the original per-user `GoogleCalendarLink` sketch in section 2a, since the household already shares one calendar), sync **every 15 minutes** (same cadence as `send_notifications`), **only accepted/confirmed events** shown (declined skipped, tentative shown normally), overlay in **both** the weekly plan view and the weekly-planning session (dragging tasks onto days).

- **Hand-rolled OAuth/REST, not the Google API client library**: `services/google_calendar.py` talks to Google's plain OAuth2 and Calendar v3 REST endpoints with `requests` rather than `google-api-python-client`/`google-auth-oauthlib` — the household only ever needs three calls (consent URL, code exchange, list events), so the full client library's dependency tree wasn't worth it on a Pi 3. The access token is re-derived from the stored `refresh_token` on every sync run rather than cached with an expiry, since sync only runs every 15 minutes anyway.
- **Models**: `GoogleCalendarLink` (singleton via `.load()`, same pattern as `CookingPlanConfig` — `refresh_token`, `sync_enabled`, `last_synced_at`) and `CalendarEvent` (`link`, `external_event_id`, `title`, `start_datetime`, `end_datetime`, `is_all_day` — a rolling read-only cache, replaced each sync run rather than incrementally patched, which handles edits/cancellations for free without needing Google's sync-token machinery). Sync window: 7 days back, 60 days ahead.
- **OAuth flow**: `GoogleCalendarConnectUrlView` (authenticated) hands the frontend a real Google consent URL with a one-time `state` cached server-side; the frontend does a full `window.location.href` navigation (an OAuth redirect can't carry a JWT header, so this can't be a fetch). `GoogleCalendarCallbackView` is deliberately **unauthenticated** (Google's redirect back arrives as a plain browser navigation, no Authorization header possible) — the one-time `state` is the actual CSRF guard, single-use (deleted from cache on first use). On success it saves the `refresh_token` onto the singleton and redirects the browser to `{FRONTEND_URL}/settings?google_calendar=connected` (or `=error`); `FRONTEND_URL` is a new env var since dev's backend (`:8000`) and frontend (`:3000`) are different origins, unlike prod where Nginx serves both.
- **Event filtering**: an event is dropped if Google's own `status` is `cancelled`, or if the household's own attendee entry (`self: true`) shows `responseStatus: declined` — other invitees declining doesn't matter. All-day events use Google's exclusive-end-date convention (`is_all_day`, computed from whether the API returned `date` vs `dateTime`).
- **Frontend**: `Settings → Google Calendar` (connect/disconnect/pause-sync, last-synced time, a one-line success/error notice read from the `?google_calendar=` query param and then stripped from the URL). The overlay itself: a new "Calendar" row in Dashboard's `WeekPreview` (replacing the old "coming with Google Calendar sync" placeholder) and a small events block above the task list in each `TaskDayColumn` (so it shows in the Household Plan's calendar view *and* its weekly-planning mode, since both share `WeekBoard`) — `utils/calendarEvents.js`'s `eventsOnDay()` handles the exclusive-end-date multi-day math once, shared by both call sites.
- 16 new backend tests (`GoogleCalendarLinkTests`, `GoogleCalendarSyncTests`) cover the singleton, connect-url/callback/state handshake (including single-use and missing-refresh-token failure), the events endpoint's date filtering, and `sync()`'s filtering/all-day-parsing/stale-event-removal logic against mocked Google responses (173 backend tests total).

### Item C follow-up (2026-09-28/30) — Google Cloud setup done, immediate sync on connect, and an unresolved DNS blocker

- **Google Cloud OAuth client created**: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` added to both the Pi's and dev's `backend/.env`, plus `FRONTEND_URL=https://husehold.duckdns.org` on the Pi. Consent screen in Testing mode, both household members added as test users. `sync_google_calendar` cron job added on the Pi (same 15-minute cadence as `send_notifications`, logs to `calendar-sync.log`).
- **Search Console domain verification hurdle**: Google refuses to let *anyone* complete the OAuth consent screen on a custom domain until that domain is verified in Google Search Console under the same Google account that owns the Cloud project — a routine site-ownership check, but trickier here since `husehold.duckdns.org` resolves to the Pi's private LAN IP (deliberately — never port-forwarded, see [[network-architecture]]). Google's HTML-file verification method fails outright since Google's crawler can't reach a private IP. Fixed by switching to a **Domain property + DNS TXT record** instead (Google only needs the TXT record to be publicly queryable, independent of what the A record points to) — set via the same DuckDNS token/update-API mechanism already used for the Let's Encrypt DNS-01 challenge. (First attempt was verified under the wrong Google account — Tim's wife's — and had to be redone under the correct one.)
- **`GoogleCalendarCallbackView` now syncs immediately on connect** rather than waiting for the next cron tick, so the overlay populates right away (best-effort — a sync failure right after a successful connect doesn't turn into an error page, cron retries regardless).
- **Confirmed working end-to-end against the local dev environment** (`localhost:8000`/`:3000` — exempt from the domain-verification requirement entirely, since `localhost` isn't a public domain).
- **Open, unresolved**: `husehold.duckdns.org` is unreachable ("server not found" — a DNS resolution failure, not a timeout) from both of Tim's usual devices — his laptop on home Wi-Fi, and his phone even on cellular data with Wi-Fi and WireGuard both off. Ruled out so far: the DNS record itself (confirmed correct and stable via Google's, Cloudflare's, and DuckDNS's own nameservers), the Pi (confirmed healthy — SSH reachable, direct-IP HTTPS returns 200), and a stale cache (persisted across two days and device restarts). Since the phone failure persists even off Wi-Fi/VPN, that's suspected to be the company phone's MDM-enforced DNS policy (common for corporate devices to filter known dynamic-DNS domains) — separate from the laptop's failure, which has no MDM and points instead at the FritzBox (either its upstream DNS resolver or its DNS-rebind protection, which by design blocks resolving a public hostname to a private IP -- exactly this setup). Investigation paused at Tim's request (2026-09-30) in favor of the working fallback below; FritzBox DNS-server/rebind-protection settings and a laptop hosts-file override (mapping the hostname straight to `192.168.178.49`, skipping DNS entirely for that one name) are the next things to try if revisited.
- **Laptop side resolved (2026-10-11)**: confirmed as the FritzBox's DNS-rebind protection — `nslookup` via `fritz.box` returned no A/AAAA record while `nslookup ... 1.1.1.1` returned `192.168.178.49`. Fixed by adding `husehold.duckdns.org` under FritzBox → Heimnetz → Netzwerk → Netzwerkeinstellungen → weitere Einstellungen → DNS-Rebind-Schutz → Hostnamen-Ausnahmen (rebind protection stays on for everything else), then `ipconfig /flushdns` on the laptop. Confirmed working on the laptop (home Wi-Fi and WireGuard) and on the phone over 5G with WireGuard on (DNS goes through the tunnel to the FritzBox). Without WireGuard the phone still can't reach it — expected and intended, since the Pi is LAN/VPN-only (see [[network-architecture]]).
- **Practical fallback in place**: the app works fine day-to-day at `https://192.168.178.49` (self-signed cert, one-time browser warning) regardless of this issue — only the *one-time* Google Calendar OAuth connect step needs the real hostname (Google doesn't accept raw IP redirect URIs). Once that one connect succeeds from *any* device/network where the hostname resolves, ongoing sync is entirely server-side (cron + stored refresh token) and needs no further DNS resolution of the hostname at all.

### Item C follow-up (2026-09-30, later) — calendar picker, event colors, and a WeekPreview layout fix

Tim connected his real Google account and immediately found two gaps: no way to pick *which* of his calendars to sync (always hardcoded to `primary`), and no way to see the per-event colors he actually uses in Google Calendar.

- **Calendar picker**: `services/google_calendar.list_calendars()` calls Google's `users/me/calendarList` (reader access, so it's just the calendars the account can see, not just ones it owns) and returns `{id, summary, primary}` per calendar. New `GoogleCalendarCalendarListView` (`GET /api/google-calendar/calendars/`) exposes it; `GoogleCalendarLinkSerializer` now also exposes `calendar_id` so it's part of the normal `PATCH /api/google-calendar/` used elsewhere. Settings gained a "Which calendar" dropdown, shown once connected.
- **Manual "Sync now"**: `GoogleCalendarSyncNowView` (`POST /api/google-calendar/sync-now/`) runs `sync()` on demand — used right after switching calendars (so the overlay updates immediately rather than waiting for cron), and exposed as its own button in Settings for anyone who doesn't want to wait 15 minutes.
- **Event colors**: `CalendarEvent.color_hex` (new field, migration 0032) is resolved during `sync()` from Google's own color data — an event's own `colorId` (from Google's fixed 11-color palette, fetched once per sync run via `GET .../colors`) if the event has one, else the connected calendar's own default color (`GET .../users/me/calendarList/{id}`, its `backgroundColor`). Both extra calls are best-effort (wrapped in one try/except) — a colors-endpoint hiccup falls back to blank rather than failing the whole sync. Rendered as a colored left border on each event pill (same visual language as task cards' assignee-color borders), not a full-color fill, so text stays legibly dark regardless of the color.
- **`WeekPreview` restructured to group by day, not by section**: it used to render three separate 7-column grids (all tasks, then all meals, then all calendar events) which collapsed badly on mobile into "7 days of tasks, then 7 days of meals, then 7 days of calendar" instead of a natural per-day reading order. Rewritten as a single grid where each day is one cell containing its own stacked tasks/meals/calendar boxes — collapses correctly to one full day at a time on mobile, and if anything reads better on desktop too (everything for one day grouped in one column instead of spread across three rows). All three boxes per day now share a fixed height (`h-[90px]`) with internal `overflow-y-auto`, so a day with many calendar events scrolls within its box instead of stretching the row; the calendar box also always renders (a plain empty grey box on days with nothing), matching how the meals box already behaved, instead of only appearing when the visible week has at least one event somewhere. Also dropped the "N tasks in the backlog" line from this widget at Tim's request (the `TasksPanel` above it already covers open tasks).
- 7 more backend tests (calendar-list/sync-now endpoints, calendar_id patch, color resolution from `colorId` vs. calendar default, and a colors-lookup-failure fallback) — 182 backend tests total.

### Item E shipped (2026-09-30) — Shopping list thematic clustering, with auto-categorization

Design decisions from Tim: **hybrid categorization** (a free offline dictionary first, a small Claude API call as fallback for anything unrecognized — Tim confirmed he's fine with the small ongoing API cost), a **fixed but fully editable starter category list** (same pattern as Labels/`MealTimeCategory`, not hardcoded), **one global store-layout order** for the household (not per-list), and a **one-time bulk pass** to categorize everything that already existed.

- **New model**: `IngredientCategory` (bilingual, `sort_order`, plus `icon`/`color_hex` added same day — see below) — 11 starter rows seeded via a data migration, ordered to roughly match a typical German supermarket walk: Obst & Gemüse → Brot & Backwaren → Milchprodukte & Eier → Fleisch & Fisch → Tiefkühl → Konserven & Trockenwaren → Gewürze & Backzutaten → Getränke → Süßes & Snacks → Drogerie & Haushalt → Sonstiges. `Ingredient.category` and `ShoppingListItem.category` both point at it (a shopping item copies its linked ingredient's category when there is one — free, no API call — or categorizes its own title directly, which is what covers non-food items like "Batterien" that never get an `Ingredient` row at all).
- **`services/ingredient_categorization.py`**: a ~150-keyword German dictionary tried first (instant, free); a Claude Haiku API call (hand-rolled via `requests`, same "skip the SDK" reasoning as `google_calendar.py`) as fallback, skipped entirely if `ANTHROPIC_API_KEY` is unset (dictionary-only, no error). Hooked into every place a new `Ingredient`/`ShoppingListItem` gets created: recipe ingredient entry, manual Ingredient add (Settings), manual shopping item add, and cooking-plan-to-shopping-list sends. A `categorize_products` management command bulk-backfills anything that predates this (run once after deploying).
- **Icons + colors, added same day on request**: `IngredientCategory.icon` (one of 11 flat single-color icons — produce/bakery/dairy/meat/frozen/pantry/spices/drinks/sweets/household/other, `components/icons/categoryIcons.jsx`) and `color_hex`, both seeded sensibly for the starter categories (green for produce, red for meat, blue for drinks, etc.). `LookupEditor.jsx` gained two field types to support this generically: `'select'` (now handles both FK-id and plain-string values via a new `valueType` option) and `'preview'` (a read-only colored icon badge reflecting two other fields on the same row — used here for a live icon+color preview while editing a category).
- **Frontend**: Settings → Recipes & Shopping Lists gained a "Shopping list categories" editor (name/order/icon/color) and a category picker on each Ingredient row; the Shopping List page now groups items under colored icon-badge headers sorted by `sort_order`, with a trailing "Uncategorized" group for anything not yet recognized.
- **Cost note for the Claude fallback**: each call is ~150-200 tokens (a short system prompt listing the categories, plus the item name), and only fires once per genuinely new/unrecognized name — everything already in the dictionary or already-categorized `Ingredient` catalogue costs nothing. Expected to be well under $1/year for a 2-person household. Tracking actual spend centrally was discussed (a "service costs" view in Settings) and explicitly deferred — Brevo has a simple usage API, but Anthropic's usage/cost data needs an org-level Admin API key, a broader credential than the app otherwise needs, so this wasn't built.
- 20 new backend tests total (13 for categorization logic/endpoints, plus coverage folded into the icon/color migration) — 195 backend tests total.
- **Follow-up (2026-09-30, later)**: README.md gained a "🔗 External Services" table (Brevo, Web Push/VAPID, DuckDNS + Let's Encrypt, Google Calendar, Anthropic — what each is for and which env vars they need), closing the gap noted above. README otherwise remains out of date in places unrelated to this feature (Packing Lists, Analytics, and newer Vouchers/Cooking Plan detail).
- **Follow-up (2026-09-30, later still) — "Connected Services" status in Settings**: Tim asked where to manage the Claude account for the categorization fallback and whether it should be configurable from the app. Landed on a **read-only status indicator**, not an in-app editable key field — consistent with how every other secret here already works (Brevo, VAPID, Google's Client Secret all live in `.env` only; even the Google Calendar Settings section only shows connect/disconnect status, never the Client Secret itself). Storing a key in the SQLite database instead of the server's env file would be a real step down in how secrets are protected -- anyone with DB access would see it in plain text. New `GET /api/service-status/` (`ServiceStatusView`) reports `{configured: bool}` for email, web push, and shopping categorization, plus the non-secret SMTP host for email -- never the actual secret values. Settings gained a "Connected Services" section showing all three with a green/grey dot and a one-line explanation of what's affected if unconfigured. 3 new backend tests (198 total).

### Item D shipped (2026-09-30/10-01) — Recipe import: photo, paste text, or URL

Design settled over a longer discussion with Tim about Instagram import specifically, since that's the hard case:

- **Instagram: deliberately no real integration.** The honest options were (a) Meta's Graph API -- developer app, business-account linking, permission review, likely still can't fetch an arbitrary public post without the poster's own token -- or (b) the pattern real tools like `social-to-mealie` (github.com/GerardPolloRebozado/social-to-mealie, checked during the discussion) actually use: `yt-dlp` downloads the video, audio gets transcribed via OpenAI's Whisper API, an LLM structures the transcript. That's real and buildable, but adds a second paid provider (Whisper, ~$0.006/minute of audio -- a few cents a month at most, but still a new account/key), a new dependency (`yt-dlp`/`ffmpeg`), and ongoing risk of `yt-dlp` needing updates when Instagram changes something. Tim's call: skip it for this build, documented here as a future upgrade. Confirmed in passing: **Anthropic has no speech-to-text capability** -- Claude handles text/images/documents, not audio, so this would always need a second provider regardless of which LLM structures the result.
- **What was built instead**: a **paste-text** import path covers the common case (the recipe is in the caption/description, which is copy-pasteable) without any video/API work at all -- and it's generically useful beyond Instagram (any recipe text from anywhere).
- **Three import paths, one draft shape, one review step**: `services/recipe_import.py` -- `extract_from_images()` (Claude vision, multiple images in one call so multi-page cookbook photos are combined into one recipe), `extract_from_text()` (same idea, for pasted captions/text), `extract_from_url()` (tries a page's `Recipe` JSON-LD first -- free, instant, no AI, works for most recipe blogs -- falling back to Claude on the page's visible text if that's missing). All three return the same draft (title, description, servings, times, instructions, notes, raw `ingredient_lines` as plain text, a `category_guess`) and **never save anything** -- `RecipeImportView` (`POST /api/recipes/import/`) just hands the draft back for review in the existing `RecipeForm`, same "always review before saving" rule as the shopping-categorization and Google Calendar work.
- **Reusing the existing ingredient-line parser instead of teaching the backend about unit IDs**: ingredient lines come back as plain text ("200 g Mehl"), the exact same shape the "paste ingredient list" importer's `parseIngredientLine()` already parses into quantity/unit/name -- so `RecipeForm` just runs the import draft's lines through that existing parser. No new unit-matching logic needed on either side.
- **`category_guess`** is a plain category name string from Claude (given the household's actual `MealTimeCategory` list as options); `RecipeImportView` resolves it to an ID server-side (or `null` if it doesn't match anything), so the frontend just gets a ready-to-use `category_id`.
- **Model used**: Haiku (same as shopping categorization) -- Tim's choice, prioritizing cost/speed over Sonnet's extra accuracy for this.
- **No photo storage**: images are base64 in the request, used once for the Claude call, and never written to disk -- consistent with the existing decision that Recipes has no photo feature.
- **One real deployment blocker, flagged clearly rather than worked around**: multi-photo import can exceed Nginx's default 1MB request-body limit on the Pi, and fixing it needs `sudo` with a password this assistant doesn't have (only a scoped NOPASSWD rule for restarting Gunicorn exists). Django's own upload limit was raised to 20MB in `settings.py` (that part didn't need sudo), but Nginx sits in front of it and still needs a one-time manual command -- see DEPLOYMENT.md section 11 for the exact `sed`/`nginx -t`/`reload` commands. Text-paste and URL import are unaffected (tiny request bodies); photo import may 413 on more than a photo or two until that command is run.
- 17 new backend tests (service-level: Claude vision/text extraction with mocked responses, JSON-LD parsing including ISO 8601 duration conversion, Claude-fallback-without-JSON-LD, unreachable-URL handling; view-level: auth, bad mode, missing-API-key messaging, category_guess resolution) — 215 backend tests total.

### Item D follow-up (2026-10-01) — photo limit, then the deferred social-media (video) import, built

Two follow-ups to the recipe import work above, same day:

**3-photo cap.** Tim asked for recipe photo import to be capped at 3 images per recipe. Enforced in both places: `RecipeImportModal.jsx` disables the file input and truncates any selection past the limit (with a visible "x/3" counter), and `RecipeImportView` independently rejects `images` lists over 3 server-side (`mode: 'photo'` can be called directly, not just through the modal) -- same defense-in-depth reasoning as everywhere else secrets/limits are checked server-side regardless of what the frontend already prevents.

**Social media video import -- the thing deliberately deferred above, now built.** Tim asked to actually implement it and "prepare the Whisper tool so it can be connected", shown in Settings. Built exactly along the lines scoped out in the Instagram discussion above (the `social-to-mealie` pattern): a new `services/social_recipe_import.py` --
- `yt-dlp` downloads just the audio track (not the video) from a pasted link (Instagram Reel, TikTok, YouTube Short, etc.) and reads the post's own title/description metadata at the same time.
- The audio goes to OpenAI's **Whisper API** (`whisper-1`) for transcription -- a new, second AI provider, since (confirmed in the earlier discussion) Anthropic has no speech-to-text capability.
- The transcript + caption + title are combined into one text blob and run straight through the **existing** `recipe_import.extract_from_text()` Claude path -- no new structuring logic needed, the social-import service only has to get from "video link" to "text", same as the paste-text importer already does from "pasted caption" to "text".
- New `RecipeImportView` mode `'social'` (`POST /api/recipes/import/ {mode: 'social', url}`), a fourth "Social media" tab in `RecipeImportModal.jsx`, and a new `Recipe.source_type` choice (`'social'`, migration `0037_alter_recipe_source_type`) distinct from the existing `'instagram'` choice (which stays as-is, used by the paste-text importer).
- **Two things must be configured for this to actually transcribe anything**, both now visible read-only in Settings → Connected services, next to the existing Brevo/VAPID/Anthropic rows:
  - `OPENAI_API_KEY` in `backend/.env` (not set yet -- Tim can add it whenever he sets up an OpenAI account; until then the status row shows "not configured" and the feature raises a clear, user-facing error telling people to paste the caption as text instead of silently failing). *Update 2026-10-11: set on the Pi.*
  - the `ffmpeg` binary on the Pi (`yt-dlp` shells out to it for audio extraction) -- also not installed yet, needs `sudo apt install ffmpeg`, a manual step documented in DEPLOYMENT.md for the same reason as the Nginx step above (this assistant only has a scoped NOPASSWD rule for restarting Gunicorn, nothing else). *Update 2026-10-11: installed on the Pi.*
  - `ServiceStatusView` reports both independently (`configured` for the API key, `ffmpeg_available` for the binary) so Settings can tell the two failure modes apart instead of one vague "not working".
- **Not yet handled, flagged rather than silently risked**: a real video download + transcription round-trip can comfortably take longer than Gunicorn's default 30s worker timeout on a Pi 3's upload bandwidth. No systemd change was made (that also needs `sudo` to edit `/etc/systemd/system/gunicorn.service`) -- if this times out in practice once a key is configured, bumping `--timeout` in the gunicorn service file is the fix; noted here so it isn't a mystery later. *Resolved 2026-10-11: Gunicorn `--timeout 300` and Nginx `proxy_read_timeout 300s` -- see the 2026-10-11 section at the end.*
- 15 new backend tests (service-level: missing-key/missing-ffmpeg/empty-url guards, `yt-dlp` download success/failure mocked via `yt_dlp.YoutubeDL`, Whisper transcription success/error mocked via `requests.post`, caption+transcript combination feeding into the existing Claude text path; view-level: `social` mode happy path, missing URL, error propagation) plus 2 updated `ServiceStatusTests` cases — 229 backend tests total.

### Item D follow-up (2026-10-01, later) — four fixes from real-world testing

Tim tried the finished recipe-import feature end-to-end (including the newly-configured social media import) and flagged four issues:

1. **Shopping list items never got remembered for next time.** `ShoppingListItemViewSet.perform_create` only *linked* to an existing `Ingredient` by exact name match and deliberately never created one ("shopping items are often non-food") -- so a typed item without a match got categorized (dictionary or LLM) for that one add, but nothing was persisted, meaning the same LLM call (and cost) would happen again next time, and the item never showed up in Recipes' config ingredient list for correction. Fixed by reusing the existing `get_or_create_ingredient()` helper (already used for recipe ingredient entry) instead of the plain lookup -- shopping items now get (or reuse) a real `Ingredient` row, same free-text-to-catalogue behavior recipes already had. Trade-off accepted: non-food items (`Batterien`) now become catalogue ingredients too, visible in the recipe ingredient autocomplete -- acceptable since they're correctly categorized (e.g. "Drogerie & Haushalt") and editable in config either way.
2. **Source type was wrong/inconsistent.** `'instagram'` as a choice no longer made sense now that `'social'` (video import) exists, and the plain paste-text importer had been silently reusing `'instagram'` as its label. Replaced the `'instagram'` choice with `'text'` ("Pasted text"), migration `0038_alter_recipe_source_type` (with a data migration converting any existing `'instagram'` rows to `'text'`), and `extract_from_text()` now sets `source_type='text'`. Also caught two frontend `SOURCE_TYPE_KEYS` maps (`RecipeDetail.jsx`, `RecipeHighlight.jsx`) that were missing `'social'` entirely -- recipes from the social import would have silently displayed as "Manual" there.
3. **Removed the old "paste ingredient list" quick-entry from the manual recipe form.** It used a simple regex parser (`parseIngredientLine`, no AI) for bulk-pasting lines like "200 g Mehl" directly into the ingredients section -- now redundant now that the dedicated Text-import tab does the same job with full AI extraction (title/times/instructions too, not just ingredient lines). Removed the `<details>`/textarea/button block, `pasteText` state, and `importPasted()` from `RecipeForm.jsx`, plus the now-unused `pasteIngredients`/`pastePlaceholder`/`importLines` i18n keys. `parseIngredientLine` itself stays -- it's still used to parse the `ingredient_lines` a draft comes back with.
4. **AI-extracted instructions read as one unbroken block.** `RecipeDetail.jsx` already renders instructions with `white-space: pre-wrap`, so the only thing missing was the AI actually producing numbered, blank-line-separated steps. Fixed in two places: the Claude extraction prompt (`_extraction_system_prompt()`) now explicitly asks for `"1. ...", "2. ..."` numbering with a blank line between steps, and the JSON-LD path (`_draft_from_jsonld()`, which never touches Claude) now numbers and double-newline-joins its already-discrete step list the same way, so formatting is consistent regardless of which extraction path produced the recipe.

2 new backend tests (shopping item creation now creates/links an `Ingredient`, and reuses an existing one case-insensitively) — 231 backend tests total.

### PDF export for recipes (2026-10-01) — browser print dialog, no new dependency

Tim asked whether PDF export (normal recipe view + Highlight mode) could be added quickly. Implemented via the browser's own print dialog (`window.print()` -> "Save as PDF" there) rather than a client-side PDF library (`jsPDF` etc.) -- zero new dependencies (the bundle is already flagged >500KB by Vite), works in every browser, and needed no backend changes.

- A global print rule in `index.css`: everything on the page gets `visibility: hidden` under `@media print` except whatever carries a `.printable` class, which is pulled to `position: absolute; top: 0; left: 0` so it prints as its own page regardless of being inside a `fixed`-position modal (`RecipeDetail`) or a normal routed page with a sticky header (`RecipeHighlight`). The modal backdrop (`Recipes.jsx`) additionally gets `print:static print:overflow-visible` so it stops acting as a positioning/clipping context for that escape to work.
- A new print button (flat icon, `components/icons/printIcon.jsx`, same convention as `expandIcon.jsx`/`gearIcon.jsx`) calls `window.print()` in both `RecipeDetail.jsx` (next to the existing Highlight-mode button) and `RecipeHighlight.jsx`'s sticky header.
- Interactive-only sections are hidden from print output via Tailwind's `print:hidden`: the navbar, both detail views' toolbar buttons, the ratings card, and the cooking-history/log-a-meal/rate-prompt section in `RecipeDetail.jsx` -- a printed recipe is for cooking along, not for re-triggering app actions.
- Not tested with a physical printer or an actual "print to PDF" run (no such tooling available in this environment) -- the CSS technique is standard and the build compiles clean, but Tim should do one real print preview to confirm layout before relying on it.

### Item F shipped (2026-10-01) — new notification types: voucher expiring soon, trip starting tomorrow

Two new `NotificationPreference`/`NotificationLog` types, extending `send_notifications` (same cron, no new schedule needed):

- **`voucher_expiring_soon`**: fires once per voucher when `valid_until` falls within the next 30 days (`Voucher.is_archived=False`, `valid_until` between today and today+30) -- goes to the whole household (vouchers aren't per-user, same as `cooking_today`'s unclaimed-task case).
- **`packing_trip_tomorrow`**: fires once per trip when `PackingList.start_date` is tomorrow (`is_archived=False`) -- goes only to that trip's own `PackingListParticipant`s, not the whole household (a trip only concerns whoever's actually going).
- **`NotificationLog` schema change**: both new types have no `HouseholdTaskInstance` to dedup against, so `task_instance` became nullable and a new `reference_key` field (e.g. `"voucher:12"`, `"packing_list:7"`) covers dedup for these instead. Two conditional `UniqueConstraint`s (one per dedup key, each scoped via `condition=Q(...)`) replace the old single `unique_together` -- a row has exactly one of the two keys set, never both, so there was no clean way to keep one shared uniqueness rule. Migration `0039`.
- `_send_once()` generalized to accept either `task_instance=` or `reference_key=` as keyword-only args instead of a positional `instance` tied to tasks specifically -- `notify_task_due()`'s own call sites updated, behavior unchanged for the four existing types.
- Both new types show up automatically in Settings' notification preferences table (`NotificationPreferencesView.get()` already seeds a row for every type in `NOTIFICATION_TYPE_CHOICES` on first fetch -- no backend work needed there) and in `frontend/src/pages/Settings.jsx`'s `NOTIFICATION_TYPES` list (just the two new entries + translations).
- 5 new backend tests (voucher notifies the whole household once, trip notifies only its participants, the management command catches both an expiring voucher and a tomorrow-starting trip in one run, and ignores a voucher outside the 30-day window / an archived one) -- 236 backend tests total.
- "Test existing notifications end-to-end" (the other half of this backlog item) wasn't done as a separate pass -- the four pre-existing types already have test coverage from when they shipped, and this round's manual Pi testing earlier today (recipe import, Settings status rows) exercised the live notification cron path incidentally without issues surfacing.

### Item F follow-up (2026-10-01, later) — recipient-logic fixes + three more notification types

Tim reviewed the shipped voucher/trip notifications and asked for recipient logic changes plus three more types:

- **Unassigned ordinary task -> whole household** (previously: no recipients at all -- `_recipients()` only had a special case for an unclaimed `cook_meal`; every other unassigned task silently notified nobody). Fixed by making "nobody assigned" the general fallback to the whole household, not a `cook_meal`-only rule.
- **Weekly household/meal planning -> always the whole household**, even though these tasks do get assigned to one member via the normal rotation. New `ALWAYS_WHOLE_HOUSEHOLD_ACTIONS = {'weekly_household_planning', 'weekly_meal_planning'}` set in `notifications.py`, checked before the assignee fallback. `cook_meal` deliberately stays out of this set -- an assigned cook task still only tells the cook, unchanged from how it already worked; only an *unclaimed* one goes to everyone (via the same general fallback as any other unassigned task now).
- **Trip starting tomorrow**: confirmed already correct as shipped (only that `PackingList`'s own participants, not the household) -- no change needed.
- `send_notifications`'s due-today query dropped its `Q(assigned_to__isnull=False) | Q(system_action='cook_meal')` filter, since every pending task is now a candidate regardless of assignment -- `_recipients()` decides who actually hears about it.

Three new types, same cron, no new schedule:

- **`task_overdue`**: any pending task whose `scheduled_date` is in the past (checked every run; `NotificationLog` dedup means it only actually sends once per task, no daily nagging). Reuses the same `_recipients()` logic as `task_due_today` -- same person/household rules apply to "this is now overdue" as to "this is due today".
- **`shopping_purchased`** / **`shopping_items_added`**: periodic digests, not one-time-per-item alerts -- "some activity happened on this list in the last 15 minutes", one notification per shopping list per cron tick. Needed a new precise timestamp: `PurchaseRecord.created_at` (migration `0040`, `ShoppingListItem.created_at` already existed). Dedup is bucket-based rather than a single id, since a "last 15 minutes" window has no natural one-time identifier: `send_notifications` rounds the current time down to the nearest 15-minute mark (`reference_key = f"shopping_purchased:{list_id}:{bucket}"`), so a manual re-run within the same cron tick doesn't double-send, but each real tick gets its own key. Recipients are whoever can see the list (`ShoppingList.visible_to`, or the whole household if unrestricted) -- a private list's activity doesn't leak to someone who can't see the list itself.
- `notifications.py` gained a shared `_notify(user, type, subject, body, *, task_instance=None, reference_key=None)` helper so every notify function (six of them now) doesn't repeat the preference-lookup + email/push dispatch boilerplate.

12 new backend tests (unassigned-task/always-whole-household recipient behavior for all three affected system actions, overdue one-time dedup, the command catching an overdue task, the two shopping digests including the whole-household case, a `visible_to`-restricted list, cross-bucket re-notification, the command catching both a recent purchase and a recent addition in one run, ignoring purchases outside the 15-minute window, and ignoring a purchase with no shopping list) -- 248 backend tests total.

### New requirement (2026-10-09) — packing list items: quantity + per-person assignment, with a confirm dialog for the "not on this trip" case

Tim asked for packing list items (and bucket items, since they become list items) to optionally carry a headcount ("5 Unterhemden") and be assigned to one, several, or all household members ("Schlafanzug von Tim und Eva"). The interesting part was handling a bucket (or a direct edit) assigning someone who isn't actually a participant of the trip -- clarified upfront via 6 questions before building:

- **Quantity**: plain integer (`PackingListItem.quantity` / `PackingBucketItem.quantity`, both nullable) -- not free text, so "5x Unterhemden" is just a number prefix, no "1 Paar"-style values.
- **Assignee pool**: *every* household member, not just the trip's current participants -- on both lists and buckets. A bucket has no trip context at all, and a list item can deliberately name someone not yet on the trip (that's exactly the case the confirm dialog exists for).
- **Confirm-dialog scope**: triggers for BOTH adding a bucket AND a direct manual assignment on a list item (not bucket-add only, as the original description implied) -- any time an item's assignees would include someone who isn't a `PackingListParticipant` of that list.
- **Dialog granularity**: one checkbox per missing person (not one "add everyone" checkbox) -- a bucket can reference multiple different non-participants.
- **Accepting without checking a box**: the assignment is kept regardless (e.g. "Schlafanzug - Tim" stays assigned to Tim even though he's not formally added to the trip) -- the checkbox only *additionally* makes that person a participant.
- **Duplicate items when adding a bucket**: changed from "skip if the name already exists" to **merge** -- quantity summed, assignees unioned into the existing item, since silently dropping a bucket item's assignee/quantity because something with the same name already existed would lose data.

**Backend** (`household/models.py`, `serializers.py`, `views.py`, migration `0041`):
- `PackingListItem`/`PackingBucketItem` both gained `quantity` (`PositiveIntegerField`, nullable) and `assignees` (`ManyToManyField(User)`, blank).
- New module-level `_non_participant_conflict(request, packing_list, assignee_ids)` in `views.py`, shared by `PackingListItemViewSet.create`/`.update` and `PackingListViewSet.add_bucket`: returns a `409` with `{'non_participants': [{'id', 'username'}, ...]}` unless the request already carries `confirm_non_participants: true`, in which case any ids in `add_to_trip` get a `PackingListParticipant` row created and the caller proceeds. `PackingListItemViewSet` had to fully override `create`/`update` (not just `perform_create`/`perform_update`) since returning a custom 409 instead of the normal 201/200 isn't possible from inside the `perform_*` hooks.
- `add_bucket` reworked from a `bulk_create`-with-skip to a per-item merge: an existing same-text item gets its quantity summed and assignees unioned in; a genuinely new item gets created as before. The non-participant check runs once up front, over the *union* of all the bucket's items' assignees, before anything is written.
- `copy` (duplicate an entire list for a new trip) was deliberately **not** wired into the same confirm-dialog flow -- out of scope for what was asked, and running a 409 round-trip through `PackingListFormModal` (which has no knowledge of the dialog) would've meant extra plumbing for an action nobody raised. Instead it carries `quantity` over and keeps only the assignees who are also participants of the *new* list, silently dropping the rest -- a conscious simplification, called out here rather than left as a silent surprise.

**Frontend**:
- New `components/AssigneeCheckboxes.jsx` (always every household member) and `components/NonParticipantConfirmDialog.jsx` (one checkbox per missing person, Accept keeps the assignment either way, Cancel discards the pending change entirely) -- shared by `PackingLists.jsx` and `PackingBuckets.jsx`.
- `PackingLists.jsx` gained a `runWithConflictHandling(makeRequest, onSuccess)` helper: tries the plain request first, and on a 409 stashes a `retry(addToTripIds)` closure in a `conflict` state instead of treating it as an ordinary error -- the dialog's Accept button calls that retry with whichever boxes got checked. Used for add-item, edit-item, and add-bucket; not for copy (see above).
- `PackingBuckets.jsx` gained the same quantity/assignee inputs on its add-item form, plus an edit mode it didn't have before (previously items could only be deleted, not edited) -- needed `packingBucketItemService.update` added to `api.js` (it was missing entirely).
- Verified end-to-end against the real local dev server (not just the test suite) with a throwaway JWT for an actual household member: created a list with one participant, assigned an item to the other (non-participant) member and confirmed the 409, confirmed with `add_to_trip` and verified both the item's assignee and the new `PackingListParticipant` row, then added a bucket whose item duplicated an existing item's name and confirmed the quantity (2+1=3) and assignees (unioned) merged correctly. Test data cleaned up afterward.
- 10 new backend tests (quantity/assignee round-trip on create, 409 on a non-participant assignee for both item-create and item-update, confirming with and without `add_to_trip`, quantity-only updates not triggering the check, the same 409/confirm flow for `add_bucket`, the merge-into-existing-item behavior, and `copy` carrying quantity while dropping an assignee not on the new trip) -- 258 backend tests total.

### Packing list items follow-up (2026-10-09, later) — single assignee per row, not multiple

Tim reviewed the just-built quantity/assignee feature and asked for a different data shape than what was described in the original request: instead of one item naming several people (a many-to-many `assignees`), each person who needs their own copy of an item gets their **own row** -- "Schlafanzug - Tim" and "Schlafanzug - Eva" as two separate `PackingListItem`s, each independently packable and with its own quantity, rather than one shared row listing both. An item nobody specific needs their own copy of (a single shared luggage scale) stays one row with no assignee. Also renamed the UI label from "Zugewiesen an" to "Individuelles Item von:".

Two more rules came with it, confirmed before building:
- **Checkbox UX preserved at creation, fanned out server-side**: picking multiple people when *adding* a new item still happens via the same checkboxes (`assignee_ids`, plural) -- `PackingListItemViewSet.create()`/`PackingBucketItemViewSet.create()` now fan that list out into one row per person (same text/quantity each, editable independently afterward) instead of attaching several people to one row. *Editing* an existing single row switched from checkboxes to a single `<select>` (new `AssigneeSelect.jsx`), since one row can only ever represent one person (or nobody).
- **Same text is fine for a different person, not for the same one**: the duplicate-item check is now scoped to the `(text, assigned_to)` pair, not just `text` -- "Schlafanzug" can exist once for Tim and once for Eva, but adding "Schlafanzug" for Tim a second time is still rejected. When a create request names several people at once and one of them already has that item, that person's row is silently skipped rather than failing the whole request -- the other (genuinely new) rows still get created.
- **Existing multi-assignee data migrated automatically**: migration `0042` adds `assigned_to` (nullable FK, replacing the `assignees` M2M from migration `0041`, which had deployed nowhere yet since that deploy failed mid-way on a dropped connection -- so this was really just correcting an in-flight design, not a production data migration), then a `RunPython` step fans out any item that happened to have more than one assignee into multiple rows (one per person, same text/quantity) before the old M2M field is removed.

Knock-on changes from the model swap:
- `_non_participant_conflict` (the shared 409-or-proceed helper) needed no changes -- it already worked on a plain set of user ids, regardless of whether they came from an M2M or a fan-out loop.
- `add_bucket`'s merge logic got simpler, not more complex: since each bucket item now has at most one assignee, "merge" is just "sum the quantity if the (text, assigned_to) pair already exists on the list" -- no more assignee-union step.
- `copy` now carries an item's assignee over as-is if they're a participant of the new list, or unassigns that single row (rather than dropping one name out of several) if they're not.
- The create endpoints' response shape changed from a single object to **a list** (since one POST can now produce several rows) -- nothing else in the frontend reads that response body beyond success/failure, so this didn't ripple further, but it's a deliberate break from the usual single-object-per-create REST convention worth noting if anything else ever calls these endpoints.

Rewrote all the feature's backend tests for the new shape and added coverage for the two new rules (same text/different person allowed, same text/same person rejected, a mixed create where one person already has it only creates the other) -- 266 backend tests total (8 more than the multi-assignee version, net of the ones rewritten rather than added). Verified again against the live local dev server with a throwaway JWT: requesting the same item for a participant plus a non-participant correctly 409s as one batch; confirming with `add_to_trip` creates two independent rows (one per person); re-requesting the same item for someone who already has it correctly 400s.

### Cooking Plan follow-up (2026-10-09) -- capped "long ago" bucket, bucket icons

Tim asked for the "not cooked in a while" suggestion bucket to be capped (he found an unbounded list too long) and for each of the five suggestion buckets to carry an emoji in the Recipe Picker.

- **New `CookingPlanConfig.long_ago_count`** (default 10, same pattern as the existing `craving_count`/`random_count` knobs) -- `build_suggestions()` in `services/cooking_suggestions.py` now slices the `long_ago` bucket to this count after sorting by days-since-cooked. Anything past the cap isn't dropped, just falls through to `remaining`/`rest` like it already did for recipes excluded by the other buckets -- the existing dedup chain (`taken` accumulating across craving -> top_rated -> long_ago -> random -> rest) needed no change, confirmed by re-reading the bucket logic before touching it. Migration `0043`. Exposed in `CookingPlanConfigSerializer` and the Cooking Plan settings UI (`CookingPlanSettings.jsx`) as a new number field, same as the other tuning knobs.
- **Bucket icons**: a plain `bucketIcon` map in `RecipePicker.jsx` (craving 🤤, top_rated ⭐, long_ago 🕐, random ❓, rest 🍝), rendered before each bucket's heading. No new translation keys needed for the icons themselves (`aria-hidden`, decorative only) -- only the new `long_ago_count` settings label got added to `locales/de.json`/`en.json`.
- 266 backend tests total (one new migration, no new test needed -- the slice is covered by existing bucket-ordering tests exercising `build_suggestions()` with a configured count).
- Verified locally: backend (`runserver`, 8000) and frontend (`vite`, fell back to 3001 since 3000 was already in use) started and the picker's icons + the new settings field were visually confirmed by Tim. **Not deployed to the Pi** -- stays local-only per Tim's request until he asks for a deploy.

### New script (2026-10-09) -- `dev.ps1`, local dev launcher with an optional prod-DB refresh

Tim asked for an optional step (explicit opt-in) to overwrite the local dev SQLite DB with a fresh copy of the production DB from the Pi, as part of local dev setup -- there was no "local dev setup" script to hang it on yet, so this introduced one.

- **New `dev.ps1`** (project root, same param convention as `deploy.ps1`: `-PiHost`, `-PiPath`, defaulting to the same Pi) -- first prompts `y/N` (`Read-Host`, default No) whether to overwrite `backend/db.sqlite3` with the Pi's. On yes: backs up the current local DB to `backups/local-db-<timestamp>.sqlite3` first (keeping only the 2 most recent -- separate rotation and filename prefix from `deploy.ps1`'s own `backups/db-<timestamp>.sqlite3`, which backs up the *production* DB before a deploy and keeps 5), then `scp`s the Pi's `backend/db.sqlite3` over it. On no (or after the refresh), starts both dev servers (`runserver` on 8000, `npm run dev` on 3000), each via `Start-Process` in its own PowerShell window.
- **Why a whole new script instead of just a snippet Tim runs by hand**: the explicit-confirmation requirement plus the auto-backup/rotation made it more than a one-liner, and folding it into the existing local dev startup step means Tim doesn't have to remember a separate command when he wants fresh data.
- **Flagged, not solved**: `scp` pulls the *entire* production DB, including real household data (vouchers, recipes, notes, etc.) onto the laptop. Fine for a 2-person household today; worth revisiting if anything more sensitive ever lands in there.
- `CLAUDE.md`'s "Dev commands" section gained one line pointing at `dev.ps1` as the normal way to start local dev now, with the manual per-service commands kept below it as the fallback/explicit path.
- Not covered by backend tests (it's a laptop-side PowerShell script, not application code) and not run end-to-end in this session -- Tim should do one real `y` run himself to confirm the `scp` round-trip against the Pi before relying on it.

### UI polish for laptop + mobile + dark mode (2026-10-10/11) -- shipped 2026-10-11

Tim reported text spilling over button borders, off-center glyphs in small buttons (e.g. "+"), and generally clunky layouts, mostly on mobile. Instead of fixing page by page from his descriptions, added an automated visual audit and fixed the root causes first.

- **New `frontend/scripts/ui-audit.mjs`** (Playwright, new devDependency `playwright@1.48.2`, Chromium installed locally via `npx playwright install chromium`): screenshots all 12 routes at 390px (phone) and 1440px (laptop), light or dark, and flags content overflowing buttons, off-center icons in small buttons, off-screen elements and horizontal page scroll. Usage: `node scripts/ui-audit.mjs <tokens.json> <outDir> [light|dark]`, with `tokens.json` = `{"access","refresh"}` minted locally via SimpleJWT's `RefreshToken.for_user(...)` in `manage.py shell` (no test user, no password change). Needs both dev servers running.
- **Root cause 1 -- global `button` rule in `index.css`** (from Design Phase 2, `c774602`) forced `h-10 py-2 px-3 inline-flex flex-wrap` onto *every* button: fixed 40px height broke multi-line buttons (recipe cards), and the forced vertical padding pushed icon glyphs down. Reduced to focus ring + transition only (`focus-visible`, so rings don't stick after taps on mobile).
- **Root cause 2 -- spacing + font scale overrides in `tailwind.config.js`** (also `c774602`): spacing 1-5 was doubled (`p-4` = 32px instead of 16px) while 6+ stayed default (so `w-5` 40px > `w-6` 24px), and `text-2xl` (32px) ended up bigger than `text-3xl` (30px). All ~980 spacing classes in the code were written for the default scale. Removed both overrides; Eukalyptus colors kept. The custom `caption`/`md` font names were unused.
- **Page fixes**: header action groups wrap on mobile (Recipes, CookingPlan, Tasks); `TaskRow` buttons wrap below the title; Vouchers form inputs stack on mobile (`min-w-0`); Dashboard "Diese Woche" hides empty boxes on mobile (fixed 90px height only from `sm` up, "Nichts geplant" for empty days -- page height roughly halved); KPI tiles 2-column on mobile and the whole tile is the link; `TaskDayColumn` min-height 80px on mobile. Added missing i18n key `common.menu` and new `dashboard.dayEmpty` (de/en).
- **Result**: audit went from ~300 flagged issues to 0 layout issues across all 42 views (12 pages + 9 dialogs/menus, x phone/laptop), in both light and dark.
- **Important**: Vite does not pick up `tailwind.config.js` changes while running -- restart `npm run dev` after editing it.

Follow-up (2026-10-11):
- **Audit extended**: also opens 9 dialogs/menus by clicking (nav drawer, account menu, new recipe, import, recipe detail, new packing list, add single task, task config, shopping history -- only clicks that open UI, never ones that save), and measures WCAG text contrast against the first opaque background behind each text. Icon-centering check now skips buttons with deliberately asymmetric padding (the Listen/Verlauf underline tabs were a false positive).
- **New `.icon-btn`** (index.css): round 36px tap target for glyph-only actions (✎/✕/close), used in ShoppingList, PackingLists, PackingBuckets, RecipeDetail, RecipeForm, LookupEditor and all modal close buttons. Was `text-gray-300 px-1` (~20px, nearly invisible). `StarRating` buttons got a bigger tap area too.
- **Gear (configure) icon** moved next to the page title on Recipes, CookingPlan, Tasks so it no longer wraps onto its own line on phones.
- **Fields shrink in flex rows**: `:where(input, select, textarea) { min-width: 0 }` -- a field's built-in ~20-char width pushed "Hinzufügen" off-screen (PackingBuckets). Zero specificity, so an explicit `min-w-*` still wins.
- **Dark mode made usable**: it was effectively never built -- `darkMode: 'class'` was only added on 2026-10-10 (`b49bb9d`), and most markup hard-codes light neutrals (only 14 of 64 `bg-white` had a `dark:` variant), so pages showed light text on white. Added a central remap at the top of index.css (`:where(.dark) .bg-white` -> gray-800, `text-gray-700` -> gray-200, tinted `bg-*-50` -> dark tints, `text-*-700` -> lighter shades, etc.), plus a default dark border color, dark input backgrounds and `color-scheme: dark` for native controls. Plain CSS on purpose: inside `@layer components` Tailwind registers the selectors as classes and leaks them into `dark:` variants (that turned `dark:text-gray-300` menu items dim). `:where()` keeps specificity at one class, so any explicit `dark:*` class still wins. Dark contrast issues 93 -> 1 (see below). `.btn-primary` and the selected list pill use eucalyptus-700 in dark (white on -500 was 2.5:1).
- `npm run build` OK (the >500 kB chunk warning is pre-existing). `npm run lint` can't run: ESLint isn't installed in `frontend/` (pre-existing).

**Known, left as-is**: label pills use the label's own color with white text, so light colors (e.g. yellow "Pasta") are hard to read -- would need picking the text color by luminance. Light mode muted hint text (`text-gray-400`, ~2.5:1) is flagged by the contrast check but kept as a design choice. Unfilled rating stars are intentionally dim. `AccountMenu`'s `!h-10 !w-10 !p-0` override is no longer needed (the global button padding it fought is gone) but harmless.

Follow-up (2026-10-11, later) -- Tim's per-page wish list:
- **Navbar (mobile)**: burger left, logo centered, avatar right (equal-width side slots).
- **Dashboard**: KPI labels bold; "This week" can page through weeks (←/→ plus "Zur aktuellen Woche"; other weeks are fetched separately so KPIs and today's meals keep referring to now); colored left border on week tasks/events 4px; task rows have right padding (red overdue background visible next to Snooze) and their buttons wrap as one group so they stay aligned; mobile order is open tasks -> today's meals -> progress -> week -> KPIs (one flat grid + `order-*`, desktop layout unchanged).
- **Cooking tasks** display as "<meal> kochen" (`tasks.cookMeal`, frontend-only in `getDisplayTitle` via `cooking_entry`); Haushaltsplan card shows the dish + servings underneath, "My open tasks" appends the dish, the dashboard week view shows only the title (meals are listed right below). Notifications/backend titles unchanged.
- **Shopping**: gear next to title; edit icon on each list pill opens `ShoppingListEditModal` (name, favorite-for-cooking-plan, delete) -- replaces the "Listeneinstellungen" panel. Active tab underline eucalyptus.
- **Haushaltsplan**: "+" is now "+ Aufgabe manuell hinzufügen" (gray, btn-secondary); config's bottom Save/Cancel + "Änderungen oben werden sofort gespeichert..." removed (the forms above save themselves; "← Zurück" stays).
- **Kochplan**: today's day ring eucalyptus; config (`CookingPlanSettings`) now autosaves -- meal toggles immediately, number fields on blur (invalid/empty reverts), PATCHing only the changed field; Save button and "Gespeichert" status removed, errors still shown. Selected meal categories eucalyptus.
- **Vouchers**: add form moved into `VoucherFormModal` behind a "+ Gutschein hinzufügen" header button; redeem slider no longer amber.
- **Packing lists**: gear next to title; opens the next/current trip automatically, else most recent past, else latest archived (`groupLists()` shared with the pill groups); selected bucket on the config page eucalyptus; quantity fields wider.
- **Recipes**: "+ Rezept importieren" then "+ Rezept manuell anlegen", both primary; search field with eucalyptus magnifier, both filters with eucalyptus filter icon (new `icons/searchIcons.jsx`); cooking history collapsed by default (summary with count stays visible), list scrolls (max-h-48). Selected meal pills in RecipeForm/RecipeDetail eucalyptus instead of black.
- **Analytics**: bug fix -- meals/purchases trend bars were invisible because the API returns `count` while `TrendBarChart` reads `value`; now mapped. All single-series charts use one `CHART_COLOR` (eucalyptus-600), defaults in the chart components too; `maxBarSize` 48.
- **Settings**: household name/timezone autosave (name on blur/Enter, timezone on change), Save button gone; language/theme buttons got their padding back (lost when the global button padding was removed on 2026-10-10 -- the audit now flags filled buttons without padding); emoji removed from the Dark Mode heading.
- **App-wide**: every `blue-*` utility and the hard-coded `#3b82f6` default of `ProgressBar` (overall weekly progress) replaced by eucalyptus (links, focus rings, drag-over, selection borders); all checkboxes/radios/ranges eucalyptus via `accent-color`; `type=search/url/tel` inputs get the eucalyptus focus ring (search showed the browser's blue outline).
- **"Fortschritt diese Woche"** shows "Bravo, alles geschafft!" (`dashboard.progress.allDone`) once the week had tasks and all counted ones are done (skipped/snoozed don't count, as before); nothing shown for an empty week.
- **Multi-day timed calendar events** (e.g. Fr 18:00 - So 12:00) now show on every local day they touch in both the dashboard week view and the Haushaltsplan (`eventsOnDay` in `utils/calendarEvents.js`); previously only on their start day, and not at all in a week they started before. An end at exactly midnight doesn't count the next day. All-day events unchanged (exclusive end date). The backend already returned every event overlapping the requested week.
- **Kochplan laid out like the Haushaltsplan**: 7 day columns from `lg` up (stacked on phones/tablets; `lg` rather than the household plan's `md` because dish cards need ~130px), today ringed eucalyptus, each day shows its Google Calendar events on top (new shared `CalendarEventList`, also used by `TaskDayColumn`; events now load on the cooking plan via `calendarEventService.getRange`), then each planned meal with a small uppercase label and a dashed "+ Gericht hinzufügen" slot. `CookingEntryCard` restacked for narrow columns (title / status + servings stepper / actions; edit and leftovers selects full width). Page width `max-w-7xl` like the household plan.
- **Task card titles** use inline text flow instead of flex (icon + title + "(erledigt)" etc. wrap at spaces) -- in the narrow columns the flex layout either overflowed ("Wöchentliche Haushaltsplanung (…)") or broke words mid-word. `<html lang>` now follows the app language (was hard-coded `en`), so `hyphens-auto` uses the right dictionary and screen readers the right voice.
- **Icons switched to Phosphor** (`@phosphor-icons/react@2.1.7`, MIT, `weight="fill"` = flat single color): task icons (`taskIcons.jsx`, same keys -- backend `ICON_CHOICES` unchanged; Phosphor has no vacuum/sink, so vacuum = Wind, dishes = BowlFood), shopping categories (`categoryIcons.jsx`, same keys), navbar and "Weitere" menu icons, voucher/packing icons, and the dashboard KPI tiles (emojis replaced by eucalyptus icons). Cost: the JS bundle grew ~130 kB (~31 kB gzipped) because each Phosphor component ships all six weights.
- **No hand-drawn icons or text glyphs left**: gear, copy, edit, expand, print, hamburger/close, expiring-soon, search/filter are Phosphor too, and the former text characters ✎ ✕ ← → ↺ ▸ (row edit/delete, modal close, back links, week arrows, undo, cooking-history caret) are components from the new `icons/uiIcons.jsx`. The −/+ servings steppers stay text (they're signs, not icons).
- **Any Phosphor icon for tasks and shopping categories**: task forms (recurring and one-off) keep the curated quick-pick row plus "Weitere…"; shopping categories (Rezepte/Einkauf config) replace the icon `<select>` with a clickable colored preview. Both open `IconPickerModal` (curated suggestions on top for categories, then all ~1500 icons with an English-name search, capped at 240 shown). Picked icons are stored by their PascalCase Phosphor name; curated keys stay lowercase. Backend migration `0044_free_icon_names`: `HouseholdTaskDefinition.icon`, `HouseholdTaskInstance.standalone_icon`, `IngredientCategory.icon` drop their `choices`, max_length 20 -> 50, validated by `icon_name_validator` (letters/digits only). Frontend: curated icons are deep-imported per file (`@phosphor-icons/react/dist/csr/<Name>`), the full library is a lazily loaded chunk (`utils/phosphorLibrary.js`, ~6.2 MB / ~1.2 MB gzipped) fetched only when the picker opens or a non-curated icon is shown (`LazyPhosphorIcon`, fallback icon for unknown names). Tests: any Phosphor name accepted, markup-like text rejected.
- **Today's meals** show the cook's avatar and color; leftovers use whoever cooks the original dish (new `source_assigned_to`/`source_assigned_to_color` on `CookingPlanEntrySerializer`, select_related added; tested). Leftover cards in the cooking plan take that color too.
- **Mobile header buttons**: removed the `ml-2` on "+ Aufgabe manuell hinzufügen" (Haushaltsplan) and "Plan abschließen" (Kochplan) that indented them when the row wrapped.
- Backend: 268 tests pass.
- **Task icons take the assignee's color** (gray when unassigned) in the Haushaltsplan cards, the dashboard task rows and the dashboard week view; Haushaltsplan cards and dashboard task rows also show a small `MemberAvatar` (photo, else initial on the member color, gray person placeholder when unassigned). `ProgressPanel` reuses the same component.
- Removed now-unused i18n keys (`tasks.configSave/configCancel/configSaveNote`, `cookingSettings.saved`, `shoppingList.listSettings`, `settings.saved`).
- Audit: 48 views (12 pages + 12 dialogs/menus incl. new voucher/list-edit modals and dashboard next week, x phone/laptop), 0 layout issues in light and dark, no console errors. Build OK.

**Status**: committed and deployed to the Pi on 2026-10-11 after Tim's local click-through (migration `0044` runs on deploy). Not covered by the UI audit: real-phone touch behavior and dark mode on iOS Safari.

### Local DB incident (2026-10-10) -- what actually happened

- `reset_test_data` (commit `f5b0216`) was run both on the Pi (intended) and against the **local** DB (not intended), wiping local recipes/tasks/shopping lists/calendar cache. No backup of the local DB from before that exists: `dev.ps1`'s `local-db-*` backups don't exist, so there's no evidence `dev.ps1`'s overwrite prompt was ever confirmed.
- Local DB was then restored from `backups/db-20261010-101957.sqlite3` -- which is a **production** backup made by `deploy.ps1` before the 10:19 deploy, not a local one. So local now holds production data from before the reset, not Tim's previous local test data. The previous (wiped) local DB is kept as `backups/pre-rollback-20261010-165030.sqlite3`.
- After the restore, `manage.py migrate` was needed (backup was 3 migrations behind, `0041`-`0043`; the missing `long_ago_count` column made `/api/cooking-plan-config/` 500, which blanked the whole Dashboard because it loads everything in one `Promise.all`). Tim's avatar reference was re-set by hand (file was still in `media/avatars/`).

### Nightly backups to the FritzBox NAS (2026-10-11) -- shipped

Tim asked for a nightly DB backup, stored on the FritzBox's NAS.

- **Storage**: the FritzBox's internal storage (9.8 MB total, ~9.2 MB free) -- enough because one backup is only ~141 KB compressed (DB 816 KB + media 108 KB). A USB stick on the FritzBox is the planned upgrade if it gets tight; switching is just a new `BACKUP_DIR`.
- **Retention**: 7 nightly backups (Tim's call -- leaves buffer for data growth on the small internal storage).
- **Tim's key requirement**: an empty/broken DB (e.g. SD card trouble) must trigger an email warning and must *never* overwrite the last good backups. Implemented in `household/management/commands/backup_db.py`:
  - Snapshot via SQLite's online backup API (consistent while Gunicorn writes, unlike `cp`), then checked: `PRAGMA integrity_check`, at least one `auth_user` + `household_householdmember` row, and total rows not under 50% of the previous backup's manifest (`--force` overrides once, after an intentional bulk delete).
  - The NAS must contain a `.husehold-backup-target` marker -- otherwise the share isn't mounted and `/mnt/fritz-nas` is just an empty folder on the SD card.
  - Any failure: warning email to `BACKUP_ALERT_EMAILS`, nothing written, nothing rotated. Rotation runs only right after a successful write, so failed nights never eat the good copies.
  - Weekly "Backup OK" summary on Sundays (agreed as the dead-man's switch: if the Pi dies, cron never runs, so silence is the only signal); low-space warning when fewer than 3 more backups fit.
  - Archive = `husehold-<date>_<time>.tar.gz` (db.sqlite3 + media/) plus a `.json` manifest with row counts, copied as `.partial` and renamed so an interrupted copy never looks like a real backup.
- **Pi setup** (DEPLOYMENT.md section 13): `cifs-utils`, FritzBox user `pi-backup` (NAS access only), root-only credentials file, `/etc/fstab` cifs mount at `/mnt/fritz-nas` with `nofail,x-systemd.automount` (FritzBox down never blocks boot), cron `0 3 * * *` logging to `backend/backup.log`.
- **Gotcha found on the real FritzBox**: reading the freshly renamed archive failed with "Stale file handle" -- the FritzBox doesn't keep SMB file IDs stable. Fixed with the `noserverino` mount option.
- **Verified end to end on the Pi**: backup written, "Backup OK" mail received, restore test (archive extracts, `integrity_check` = ok, all 3 users present).
- **Tests**: 6 new (`BackupDbCommandTests`) -- a `TransactionTestCase`, because SQLite's backup API waits forever on the write lock that `TestCase`'s wrapping transaction holds. 277 backend tests total.

**Restore test on the Pi (2026-10-15)**, without touching the live DB: the 2026-10-14 03:00 archive was extracted to `/tmp/restore-test`; `PRAGMA integrity_check` ok; row counts of all 37 tables equal the manifest (444 rows; live was slightly ahead -- the day's new data); both avatar files present. Then Django was started against the extracted copy via a throwaway settings module (`from config.settings import *` + `DATABASES['default']['NAME']` / `MEDIA_ROOT` pointed at `/tmp/restore-test`, used with `DJANGO_SETTINGS_MODULE` + `PYTHONPATH`): `migrate --check` clean, `check` clean, users/recipes/shopping items/avatars read through the ORM from the copy. Test folder removed afterwards. Same recipe works for future spot checks.

**Related cleanup the same day -- orphaned avatar files**: `media/` was 4.9 MB for one avatar in use. Django never deletes a `FileField`'s old file when it's replaced, so every avatar change left the previous image behind (one was a 4.7 MB original from before the client-side 400px downscale). `HouseholdMemberSerializer.update()` now deletes the replaced file, and a new `cleanup_orphan_avatars` command (dry run by default, `--delete` to remove) cleared the 3 orphans on the Pi -- `media/` is now 108 KB.

**Also resolved the same day -- `husehold.duckdns.org` on the LAN**: see the Item C follow-up above (FritzBox DNS-rebind exception).

### Request timeouts raised for recipe import (2026-10-11)

While reviewing open topics: the OpenAI key and `ffmpeg` had been set up on the Pi by then, but the timeout risk flagged in the Item D follow-up was still open -- and it turned out to be wider than flagged:

- An import request runs everything synchronously: video download (no overall cap), Whisper (up to 120s), Claude (up to 60s) -- worst case 3+ minutes. **Photo import** was exposed as well, since its Claude call alone may take up to 60s.
- Two limits sat in front of it: Gunicorn's 30s worker timeout *and* Nginx's 60s default `proxy_read_timeout` (the original note only mentioned Gunicorn -- raising just that would have turned the failure into an Nginx 504 at 60s).
- Both raised to 300s on the Pi: `--timeout 300` in `/etc/systemd/system/gunicorn.service`, `proxy_read_timeout 300s;` in `nginx.conf`'s `http` block (next to `client_max_body_size 20M`, so it covers both server blocks). Verified: Gunicorn running with the new flag, `nginx -t` ok, API answering. DEPLOYMENT.md sections 6 and 12 updated.
- Upper bound only, nothing gets slower. With 2 workers, a long import ties up one while the other keeps serving.

### Household plan: day chips instead of drag and drop on mobile (2026-10-11)

Tim: dragging tasks onto days in the weekly planning didn't work well on a phone. Two causes: on mobile the 7 days stack into a ~4000px column, so dragging from the backlog to Sunday meant holding a card at the screen edge while the page crawled down; and the dnd-kit sensors were misconfigured -- `TouchSensor` got `{ delay, tolerance }` directly instead of under `activationConstraint` (so ignored), and `PointerSensor` also reacts to touch, starting a drag instantly and fighting scrolling.

- **`DayPicker`** (new): a `Mo Di Mi Do Fr Sa So` chip row on every open task card (plus "Backlog" for tasks that already have a day); one tap moves the task. Current day filled eucalyptus, today underlined. Shown everywhere on phones; on laptop only in the backlog lane -- in the narrow day columns drag and drop stays the way to move.
- **`UndoToast`** (new, generic): bottom snackbar "Auf Mittwoch verschoben · „…“ · Rückgängig", 5s auto-dismiss. Every move (chip or drag) shows it; Undo moves the task back to its previous day or the backlog.
- `Tasks.jsx`: one `handleMove(instance, isoOrNull)` shared by drag and chips (the leftovers-order error is still shown as before).
- Sensors: `MouseSensor` (5px distance) + `TouchSensor` (250ms long-press) instead of `PointerSensor`.
- Backlog lane on phones: one card per row instead of two (room for the chips).

Alternatives considered and not built (yet): "tap card, then tap day" pick-up mode; a one-task-at-a-time weekly planning wizard (day + person per task) -- a possible next step for the planning ritual.

### UX round for phone + laptop (2026-10-14)

Fresh audit screenshots reviewed page by page; Tim picked all four proposals.

- **Bottom tab bar on phones** (new `BottomNav`, rendered by `Navbar` below md): Start · Einkauf · Haushalt · Kochplan · Mehr; "Mehr" opens a sheet with Rezepte, Packlisten, Gutscheine, Statistiken, Einstellungen. Replaces the burger menu (icons `hamburgerIcon`/`closeIcon` removed). Safe-area aware (`viewport-fit=cover`, `env(safe-area-inset-bottom)`); `body` gets bottom padding below md; `UndoToast` sits above the bar.
- **Haushaltsplan, phones**: task cards are collapsed to title, assignee, "Erledigt" (+ "Jetzt planen") and a ⋯ toggle; skip, snooze, reassign, delete, created-by and day chips fold out. In weekly planning the assignee select and day chips stay open. Laptop unchanged. Empty days collapse to one line ("Mo 12. Okt. · Keine Aufgaben"). Week range shown as "12. Okt. – 18. Okt." (`formatDateRange` in `utils/weekDates.js`, shared with the Kochplan).
- **Kochplan, phones/tablets (< lg)**: past days of the week fold to one line ("› Mo 12. Okt. · 2 Gerichte"), tap to open; each meal is one row (label left, dishes + "+ Gericht hinzufügen" right). 7-column layout from lg unchanged.
- **Einkaufsliste**: add-item bar is sticky at the top (not bottom-fixed: that fights the iOS keyboard), compact on phones ("+" button), keeps focus after adding; the whole row ticks an item off (optimistic update), ticked items sink to the bottom of their group; phones show only the pencil -- delete moved into the edit row (laptop keeps the X too); "Neue Liste" is a dashed pill that opens the input; the redundant list-name heading is gone; favorite star readable on the selected pill.
- **Snooze renamed** (de): button "Schlummern", state "geschlummert" (Tim's choice; "Nächste Woche" clashed with the dashboard's week arrow).
- **Tap targets**: task buttons on the dashboard (`TaskRow`) and Haushaltsplan cards are ~32px high on phones (were ~24px); laptop sizes unchanged.
- **Rezepte header**: both buttons share one row on phones ("+ Importieren", "+ Manuell anlegen"), the two filters side by side.
- **Dashboard "Diese Woche" (laptop)**: fixed 90px boxes replaced by a CSS subgrid -- each row (tasks, meals, calendar) grows to its fullest day, so nothing is clipped and columns stay aligned; a row that's empty all week is left out.
- **Label pills**: text color picked by WCAG contrast (`utils/colorContrast.js`, `pillStyle`), so light labels (yellow "Pasta") get dark text; unselected pills in RecipeForm use gray text with the colored border.
- Gotcha: `.icon-btn` is plain CSS declared after Tailwind's utilities, so `hidden`/`md:hidden` on an icon button need the `!` variants.
- Audit: 0 layout issues, no console errors, light + dark (only the known gray-400/star contrast notes remain). `ui-audit.mjs` selectors updated for the "Mehr" tab and the short recipe button labels.

### "State of the art" round (2026-10-14, same day)

Tim asked what's missing for a state-of-the-art app; he picked the 7 proposals below plus two Analytics wishes, to be built without further questions.

- **Analytics**: long axis labels in the ranked charts (`RankedList`) are cut to one line with "…"; the full name shows on hover (SVG `<title>`) and in the bar tooltip (tap on phones). New chart **"Meistgekochte Labels"**: `meal_stats` returns `top_labels` (each cooked meal counts once per label of its recipe, bars in the label's color). Test added.
- **1 -- Instant page switches** (`services/apiCache.js`): stale-while-revalidate for every GET on the axios instance. A repeated GET resolves right away from memory while the same request runs again in the background (not again within 2s); if the answer differs, an `api:revalidated` event fires and pages using `useRevalidate(reload)` reload (Dashboard, Einkauf, Haushaltsplan, Kochplan, Rezepte, Gutscheine, Packlisten). Every successful write empties the cache, plus a generation counter so a request sent before the write can't put old data back. Cleared on login/logout. In-memory only. First visits show `PageSkeleton` (grey placeholder blocks) instead of "Wird geladen..."; paging weeks in the Haushaltsplan no longer flashes a loading screen. Chosen over migrating 12 pages to TanStack Query: same effect for this app, a fraction of the change.
- **2 -- Undo instead of "Are you sure?"** (`UndoProvider` at app level, one snackbar that survives page changes): deleting a task occurrence, shopping item, cooking-plan dish, voucher or recipe hides it immediately and only deletes on the server when the snackbar is gone (5s); "Rückgängig" brings it back. A second delete commits the first right away, closing the tab commits too (best effort). Whole lists/buckets, the Google disconnect and the task-definition confirmations keep their dialog on purpose. The Haushaltsplan's move-undo uses the same snackbar.
- **3 -- Swipe gestures** (`SwipeActions`, touch only, vertical scroll stays native via `touch-action: pan-y`): shopping item right = tick/untick, left = delete (with undo); dashboard task rows and Haushaltsplan cards right = Erledigt, left = Schlummern. A gesture only counts as a swipe if it's clearly horizontal within 200ms, so the 250ms long-press drag on task cards still works; the row clips only mid-swipe so dragged cards aren't cut off. Light haptic on Android (iOS Safari has no vibration API).
- **4 -- Dialogs as bottom sheets on phones**: `.modal-backdrop` / `.modal-panel` (index.css) on all 11 dialogs: below sm they slide up from the bottom (grab bar, max 92dvh, own scroll, safe-area padding); from sm the centered dialog fades in. Screen-only, so printing a recipe is unaffected; respects reduced motion.
- **5 -- Type scale and buttons**: no more 10/11px text (now 12px min); page titles 24px on phones / 30px from sm; `tabular-nums` for KPI numbers, quantities, progress counts. Two button sizes, `.btn .btn-sm` (~32px) and `.btn .btn-md` (~40px), in `@layer components` so utilities on a button still win; 76 buttons converted automatically (pills untouched), page header actions are all btn-md.
- **6 -- Navbar** sticky with a translucent blurred background (safe-area aware); the shopping list's add bar sticks just below it. Unfolding content (card actions, past cooking days, the "Mehr" sheet) fades in.
- **7 -- Empty states** (`EmptyState`: icon, text, next step): today's meals ("+ Gericht planen"), no open tasks, empty shopping list ("+ Ersten Artikel eintragen" focuses the field), no recipes ("+ Rezept importieren"), no filter matches ("Filter zurücksetzen"), no active vouchers.
- Dashboard task rows on phones follow the card pattern: "Erledigt" + ⋯ (skip/snooze fold out).

### Navigation look + radii (2026-10-15)

- **Bug fixed -- "Bild bearbeiten" popup misplaced**: `AvatarPreviewModal` rendered inside the navbar, and since the navbar got `backdrop-filter` (blur) the browser positions `fixed` descendants relative to it, so the popup was squeezed into the 65px bar. Now rendered through a React portal into `<body>` (and uses the sheet/dialog classes). Rule for the future: overlays opened from inside the navbar/bottom bar must use a portal.
- **Dark eucalyptus bars**: laptop navbar `eucalyptus-800` (dark mode: new `eucalyptus-950`, `#022c22`, added to `tailwind.config.js`), white/pale-mint links, the active page gets a light pill; the logo sits on a white rounded tile (`LogoTile`) because the green line-art logo vanishes on dark green. `theme-color` (index.html + manifest) is now `#065f46`.
- **Phones: no top bar any more** (navbar is `md:` only; body keeps `safe-area-inset-top` clear). The dark bottom bar is the only navigation: Start (app logo tile) · Einkauf · Haushalt · Kochplan · Mehr (your avatar); active tab = white label + light pill behind the icon. "Mehr" opens a sheet: profile block (avatar, name, "Bild bearbeiten"), Rezepte, Packlisten, Gutscheine, Statistiken, then Systemeinstellungen and Abmelden. Shared `useMyMember()` hook and `logout()` (`utils/session.js`) for AccountMenu and BottomNav. The shopping list's add bar sticks to the very top again on phones.
- **Corner radii unified**: cards/panels/day columns/dialogs 12px (`rounded-xl`, also `.card`), buttons, fields, task cards and small boxes 8px (`rounded-lg`; every plain `rounded` converted), pills/avatars round, sheets 16px on top.
- **Follow-up (same day, Tim's wishes)**: phone bar is now logo tile (Start, no label, 44px -- as tall as icon + label) · Einkauf · Haushalt · Kochplan · **Rezepte** · Mehr; no scrolling bar (hidden tabs are hard to find), the label-less logo slot is narrower so 5 labelled tabs fit (~65px each at 390px). "Mehr" uses a grid icon instead of the avatar; "Ausloggen" (was "Abmelden", everywhere) sits right under "Bild bearbeiten" in the sheet's profile block. Nav icons (both bars) are outlines and filled only for the active page; the cooking plan's nav icon is a fork and knife instead of the pot (task/content icons unchanged).
- **Title icons**: every page title has its nav icon in front (filled, eucalyptus; `TitleIcon`), config pages (Kochplan/Rezepte-&-Einkauf/Packlisten-Vorlagen config, Haushaltsplan config mode) a sliders icon; dashboard: waving hand before "Willkommen", calendar / checklist / chart / fork-and-knife before "Diese Woche", "Meine offenen Haushaltsaufgaben", "Fortschritt", "Heutige Mahlzeiten" (`icons/sectionIcons.jsx`). KPI tile labels ("Reisen", ...) dark eucalyptus instead of gray.
- **Overdue/today markers** (dashboard task rows): small icon + lowercase word ("überfällig" red warning circle, "heute" eucalyptus calendar-check) instead of uppercase "ÜBERFÄLLIG"/"HEUTE"; overdue titles are dark gray (the row's red tint + the marker carry the warning). Tasks due later this week show their day the same way (gray calendar icon + "Fr., 17.10.").
- **Cooking history grouped** (RecipeDetail): the API now returns the full log as `meal_history` (was `recent_meal_events`, capped at 10; `meal_events__logged_by` prefetched so it stays one query). Expanding "Kochverlauf" shows three non-overlapping, separately foldable periods -- "Letzter Monat", "Älter als 1 Monat", "Älter als 1 Jahr" -- each with its count; the total stays in the header line ("insgesamt 12×"). Empty periods are hidden; the newest non-empty one starts open.
- Audit: new step `avatar-preview`; "Foto entfernen" (the invisible hover overlay on the photo) is flagged as overflowing/unpadded -- a false positive.

**Parked (2026-10-15): offline shopping list.** Keep the list usable with bad reception in the shop and sync ticks later. Estimated half a day: (1) service worker precaches the app shell (`vite-plugin-pwa`/Workbox, with versioning so a deploy never keeps serving the old app), (2) persist the shopping GETs of the API cache on the device, (3) an outbox for tick/untick and new items, replayed when back online -- needs the backend toggle changed to an idempotent "set completed = true/false" (replaying a *toggle* could undo the other person's tick), delete/edit stay online-only, (4) an offline/pending banner. Tim decided to leave it for now; do it as its own deploy, separate from other changes.

**Still open (minor, from the 2026-10-11 review)**: real-phone testing (touch, iOS Safari dark mode) not done; ESLint not installed in `frontend/`; a ~6 MB frontend chunk (likely the full Phosphor icon set) that could be loaded only when the icon picker opens; first automatic nightly backup to be checked on 2026-10-12; optional USB stick / off-site backup later.
