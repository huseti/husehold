# Phase 1 Implementation Plan — Task Engine Core

Concrete build steps for Phase 1 of [PLANNING.md](PLANNING.md#4-suggested-build-order): the recurring task engine, snooze/postpone/reassign, and the color-coded drag-and-drop weekly view. Everything else in the plan depends on this phase existing first.

## Scope for this phase

In:
- `AuditableMixin` (shared base for every future config-editable model)
- `HouseholdTaskDefinition` (recurring template, RRULE-based recurrence)
- `HouseholdTaskInstance` (one dated occurrence)
- `HouseholdTaskEvent` (audit log: created/reassigned/snoozed/postponed/completed)
- `HouseholdMember.color_hex`
- Reassign / snooze / postpone actions
- Weekly view: color-coded cards, drag-and-drop onto a day
- Removing the old `HouseholdTask` model (no data migration needed — table is empty)

Out (later phases, not touched here):
- Cooking Plan's `system_action` trigger (the *mechanism* for a `HouseholdTaskDefinition` to open a special wizard is built now; the actual Cooking Plan wizard itself is Phase 4)
- Google Calendar overlay (Phase 9)
- Notifications (Phase 9)
- Any visual/styling pass beyond "cards are colored and draggable" — layout and design discussed separately per your note

## Step 1 — Backend models

1. Add `backend/household/mixins.py` with `AuditableMixin` (abstract model: `created_by`, `created_at`, `updated_by`, `updated_at`, all FK/DateTime with sensible `related_name`s per concrete subclass).
2. Add `color_hex` to `HouseholdMember`.
3. Add `HouseholdTaskDefinition(AuditableMixin)`: `title`, `description`, `recurrence_rule` (text field storing an RFC 5545 RRULE string), `default_assignee` (FK User, nullable), `system_action` (choices: `none`, `weekly_household_planning`, `weekly_meal_planning`; default `none`).
4. Add `HouseholdTaskInstance`: `definition` (FK HouseholdTaskDefinition), `scheduled_date`, `assigned_to` (FK User), `status` (choices: `pending`, `done`, `snoozed`), `completed_at` (nullable).
5. Add `HouseholdTaskEvent`: `task_instance` (FK), `event_type` (choices: `created`, `reassigned`, `snoozed`, `postponed`, `completed`), `actor` (FK User), `timestamp` (auto_now_add), `note` (optional text).
6. Add `python-dateutil` to `backend/requirements.txt` if not already present (check first — Django itself doesn't bundle RRULE parsing).
7. Confirmed: no real data in the old `HouseholdTask` table yet, so no data migration needed. Remove `HouseholdTask` (model, serializer, viewset, admin registration, frontend references) in the same change that adds the new models, rather than running both side by side.
8. `makemigrations` + `migrate` locally, verify in `python manage.py shell`.

## Step 2 — Task generation logic

1. A small service function (e.g. `household/services/task_generation.py`): given a date range, expand every `HouseholdTaskDefinition.recurrence_rule` via `dateutil.rrule.rrulestr()` and create any missing `HouseholdTaskInstance` rows for that range (idempotent — safe to call repeatedly).
2. Call this on-demand for now (e.g. triggered when the weekly view is opened for a given week) rather than a background job — no scheduler exists yet, and this phase doesn't need one.

## Step 3 — API

1. `HouseholdTaskDefinitionSerializer` / `HouseholdTaskDefinitionViewSet` (`ModelViewSet`, `IsAuthenticated` only, per the existing project-wide decision) — CRUD for config.
2. `HouseholdTaskInstanceSerializer` / `HouseholdTaskInstanceViewSet` — list (filterable by date range), plus custom actions:
   - `POST /task-instances/{id}/reassign/` — body `{ assigned_to }`, writes the change + a `HouseholdTaskEvent(reassigned)`.
   - `POST /task-instances/{id}/snooze/` — sets `status=snoozed` + `HouseholdTaskEvent(snoozed)`.
   - `POST /task-instances/{id}/postpone/` — body `{ scheduled_date }`, moves the date + `HouseholdTaskEvent(postponed)`.
   - `POST /task-instances/{id}/complete/` — sets `status=done`, `completed_at=now()` + `HouseholdTaskEvent(completed)`.
3. `perform_create`/each custom action sets `HouseholdTaskEvent.actor = request.user` and (for config models) `updated_by = request.user` via `AuditableMixin` save hook.
4. Register routes in `backend/household/urls.py`.

## Step 4 — Admin

Register `HouseholdTaskDefinition`, `HouseholdTaskInstance`, `HouseholdTaskEvent` in `admin.py` (read-only inlines for `HouseholdTaskEvent` under `HouseholdTaskInstance` are useful for debugging early on).

## Step 5 — Frontend

1. New page (or reworked `Tasks.jsx`): weekly grid, one column per day.
2. Task cards colored via `assigned_to`'s `HouseholdMember.color_hex`.
3. Drag-and-drop library: given the Pi's limited resources this only affects the client (React runs in the browser, not on the Pi), so no server-side constraint here — `@dnd-kit/core` is a reasonable lightweight choice (no jQuery/heavy runtime dependency) if you don't already have a preference.
4. Drop handler calls the `postpone` endpoint (moving a card to a different day) or `reassign` (if dropped into another member's column, if the layout ends up member-columns-by-day — exact grid shape is a UI decision, not covered here per your note to discuss styling separately).
5. Snooze / complete as simple buttons on the card for now (no drag gesture needed for those).
6. Config screen: simple form to create/edit `HouseholdTaskDefinition` (title, recurrence — a plain text RRULE input is enough for v1; a friendlier recurrence picker UI can come later) and set `HouseholdMember.color_hex` (a color input).
7. Translations: add new i18n keys to `en.json`/`de.json` for all new labels (per the existing i18n setup — German stays the default).

## Step 6 — Testing

1. Backend: `household/tests.py` currently empty — this is a reasonable place to start actually adding tests, given how much logic (recurrence expansion, snooze/postpone/reassign event logging) is genuinely testable and easy to get subtly wrong.
2. Manual test pass in dev: create a weekly-recurring `HouseholdTaskDefinition`, confirm instances generate for the right dates, drag a card to another day, snooze one, reassign one, check `HouseholdTaskEvent` rows exist for each action.

## Step 7 — Deploy

1. `.\deploy.ps1` as usual (builds frontend, backs up DB, pulls + migrates on the Pi).
2. Since this changes the schema meaningfully, double check the pre-deploy DB backup step actually ran before migrating on the Pi — worth confirming the backup file appeared in `backups/` before proceeding, given this migration touches real data.

## Resolved before starting

- **Existing `HouseholdTask` data**: confirmed empty — old model is removed outright rather than migrated (see Step 1.7).
- **Naming**: new models keep the `HouseholdTask` prefix (`HouseholdTaskDefinition`/`HouseholdTaskInstance`/`HouseholdTaskEvent`) rather than a bare `Task`, for continuity with the model they replace and to avoid a generic name in a Django app that will eventually have other task-like things.
- **No separate "HouseholdPlan" class/instance pair**: the weekly household-planning ritual doesn't get its own definition/instance structure — it's already exactly what `HouseholdTaskDefinition(system_action=weekly_household_planning)` + its recurring `HouseholdTaskInstance` gives you. A second parallel structure would just duplicate that mechanism. `HouseholdPlanConfig.last_planned_date` (see [PLANNING.md](PLANNING.md#2a-household-plan--tasks)) is the one piece of state worth keeping outside the task system, since it answers "has this week been planned yet" independent of any one instance.

## Still open

- **Drag-and-drop grid shape**: day columns with all members' tasks mixed in (colored to tell them apart), or day-and-member as a 2D grid? Purely a layout question — flagged here so it's not forgotten, but per your request we'll discuss actual styling/layout separately rather than deciding it now.
