# Phase 1 Implementation Plan — Task Engine Core

Concrete build steps for Phase 1 of [PLANNING.md](PLANNING.md#4-suggested-build-order): the recurring task engine, snooze/postpone/reassign, and the color-coded drag-and-drop weekly view. Everything else in the plan depends on this phase existing first.

## Scope for this phase

In:
- `AuditableMixin` (shared base for every future config-editable model)
- `TaskDefinition` (recurring template, RRULE-based recurrence)
- `TaskInstance` (one dated occurrence)
- `TaskEvent` (audit log: created/reassigned/snoozed/postponed/completed)
- `HouseholdMember.color_hex`
- Reassign / snooze / postpone actions
- Weekly view: color-coded cards, drag-and-drop onto a day
- A one-off data migration for the existing `HouseholdTask` rows

Out (later phases, not touched here):
- Cooking Plan's `system_action` trigger (the *mechanism* for a `TaskDefinition` to open a special wizard is built now; the actual Cooking Plan wizard itself is Phase 4)
- Google Calendar overlay (Phase 9)
- Notifications (Phase 9)
- Any visual/styling pass beyond "cards are colored and draggable" — layout and design discussed separately per your note

## Step 1 — Backend models

1. Add `backend/household/mixins.py` with `AuditableMixin` (abstract model: `created_by`, `created_at`, `updated_by`, `updated_at`, all FK/DateTime with sensible `related_name`s per concrete subclass).
2. Add `color_hex` to `HouseholdMember`.
3. Add `TaskDefinition(AuditableMixin)`: `title`, `description`, `recurrence_rule` (text field storing an RFC 5545 RRULE string), `default_assignee` (FK User, nullable), `system_action` (choices: `none`, `weekly_household_planning`, `weekly_meal_planning`; default `none`).
4. Add `TaskInstance`: `definition` (FK TaskDefinition), `scheduled_date`, `assigned_to` (FK User), `status` (choices: `pending`, `done`, `snoozed`), `completed_at` (nullable).
5. Add `TaskEvent`: `task_instance` (FK), `event_type` (choices: `created`, `reassigned`, `snoozed`, `postponed`, `completed`), `actor` (FK User), `timestamp` (auto_now_add), `note` (optional text).
6. Add `python-dateutil` to `backend/requirements.txt` if not already present (check first — Django itself doesn't bundle RRULE parsing).
7. Decide what happens to existing `HouseholdTask` rows: check with you whether there's real data in there yet. If yes, write a data migration that creates one `TaskDefinition` (non-recurring, `recurrence_rule` empty) + one `TaskInstance` per existing row, preserving `assigned_to`/`due_date`/`is_completed`. If it's still just test data, we can skip that and start clean.
8. `makemigrations` + `migrate` locally, verify in `python manage.py shell`.
9. Keep the old `HouseholdTask` model until the new one is confirmed working end-to-end, then remove it and its migration-safe cleanup in a follow-up migration — avoids a risky big-bang cutover.

## Step 2 — Task generation logic

1. A small service function (e.g. `household/services/task_generation.py`): given a date range, expand every `TaskDefinition.recurrence_rule` via `dateutil.rrule.rrulestr()` and create any missing `TaskInstance` rows for that range (idempotent — safe to call repeatedly).
2. Call this on-demand for now (e.g. triggered when the weekly view is opened for a given week) rather than a background job — no scheduler exists yet, and this phase doesn't need one.

## Step 3 — API

1. `TaskDefinitionSerializer` / `TaskDefinitionViewSet` (`ModelViewSet`, `IsAuthenticated` only, per the existing project-wide decision) — CRUD for config.
2. `TaskInstanceSerializer` / `TaskInstanceViewSet` — list (filterable by date range), plus custom actions:
   - `POST /task-instances/{id}/reassign/` — body `{ assigned_to }`, writes the change + a `TaskEvent(reassigned)`.
   - `POST /task-instances/{id}/snooze/` — sets `status=snoozed` + `TaskEvent(snoozed)`.
   - `POST /task-instances/{id}/postpone/` — body `{ scheduled_date }`, moves the date + `TaskEvent(postponed)`.
   - `POST /task-instances/{id}/complete/` — sets `status=done`, `completed_at=now()` + `TaskEvent(completed)`.
3. `perform_create`/each custom action sets `TaskEvent.actor = request.user` and (for config models) `updated_by = request.user` via `AuditableMixin` save hook.
4. Register routes in `backend/household/urls.py`.

## Step 4 — Admin

Register `TaskDefinition`, `TaskInstance`, `TaskEvent` in `admin.py` (read-only inlines for `TaskEvent` under `TaskInstance` are useful for debugging early on).

## Step 5 — Frontend

1. New page (or reworked `Tasks.jsx`): weekly grid, one column per day.
2. Task cards colored via `assigned_to`'s `HouseholdMember.color_hex`.
3. Drag-and-drop library: given the Pi's limited resources this only affects the client (React runs in the browser, not on the Pi), so no server-side constraint here — `@dnd-kit/core` is a reasonable lightweight choice (no jQuery/heavy runtime dependency) if you don't already have a preference.
4. Drop handler calls the `postpone` endpoint (moving a card to a different day) or `reassign` (if dropped into another member's column, if the layout ends up member-columns-by-day — exact grid shape is a UI decision, not covered here per your note to discuss styling separately).
5. Snooze / complete as simple buttons on the card for now (no drag gesture needed for those).
6. Config screen: simple form to create/edit `TaskDefinition` (title, recurrence — a plain text RRULE input is enough for v1; a friendlier recurrence picker UI can come later) and set `HouseholdMember.color_hex` (a color input).
7. Translations: add new i18n keys to `en.json`/`de.json` for all new labels (per the existing i18n setup — German stays the default).

## Step 6 — Testing

1. Backend: `household/tests.py` currently empty — this is a reasonable place to start actually adding tests, given how much logic (recurrence expansion, snooze/postpone/reassign event logging) is genuinely testable and easy to get subtly wrong.
2. Manual test pass in dev: create a weekly-recurring `TaskDefinition`, confirm instances generate for the right dates, drag a card to another day, snooze one, reassign one, check `TaskEvent` rows exist for each action.

## Step 7 — Deploy

1. `.\deploy.ps1` as usual (builds frontend, backs up DB, pulls + migrates on the Pi).
2. Since this changes the schema meaningfully, double check the pre-deploy DB backup step actually ran before migrating on the Pi — worth confirming the backup file appeared in `backups/` before proceeding, given this migration touches real data.

## Open items before starting

- **Existing `HouseholdTask` data**: is there anything real in it yet, or is it still test/scaffolding data? Decides whether Step 1.7's data migration is needed.
- **Drag-and-drop grid shape**: day columns with all members' tasks mixed in (colored to tell them apart), or day-and-member as a 2D grid? Purely a layout question — flagged here so it's not forgotten, but per your request we'll discuss actual styling/layout separately rather than deciding it now.
