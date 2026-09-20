# HUSEHOLD - Household Management App

A lightweight web application for managing household tasks, shopping lists, cooking plans, and recipes. Designed to run on a Raspberry Pi with 2 household members.

## 🏗️ Architecture

- **Backend**: Django 5.2 + Django REST Framework + SimpleJWT
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: SQLite3
- **Server**: Nginx + Gunicorn
- **Deployment**: Raspberry Pi 3 (1GB RAM) — see [PLANNING.md](PLANNING.md) for the full domain model and phased build plan

## 📁 Project Structure

```
husehold/
├── backend/                 # Django REST API
│   ├── config/             # Django settings
│   ├── household/          # Main app
│   │   ├── models.py       # Database models
│   │   ├── views.py        # API views
│   │   ├── serializers.py  # REST serializers
│   │   └── urls.py         # API routes
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
├── frontend/               # React application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── services/      # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── README.md
├── PLANNING.md            # Domain model, class diagrams, phased build plan
├── PHASE1_PLAN.md         # Phase 1 (task engine) implementation plan
├── DEPLOYMENT.md          # Raspberry Pi setup guide
├── deploy.ps1             # Run this from the laptop to deploy
└── deploy.sh              # Runs on the Pi (invoked by deploy.ps1, not directly)
```

## 🚀 Quick Start (Local Development)

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Backend runs at: `http://localhost:8000/api`
Admin panel: `http://localhost:8000/admin`

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs at: `http://localhost:3000`

## 📱 Features

- **Household Plan**: recurring tasks (RFC 5545 recurrence via a friendly picker, no raw RRULE editing), a color-coded drag-and-drop weekly calendar, a backlog for tasks with no fixed day, one-off tasks, and three distinct modes on one page — calendar (browse/act on any week), config (manage recurring tasks, member colors), and weekly planning (assign/organize next week's tasks, with carried-over-from-last-week items called out)
- **Task actions**: complete, skip (this occurrence only), snooze (defers to next week's backlog while leaving a greyed-out marker behind), reassign, delete, and undo for any resolved state
- **Assignment modes**: fixed member, alternating (rotates between household members; skipping doesn't advance the rotation), or decided during weekly planning
- **Weekly planning reminder**: a configurable recurring system task (day/time, same assignment modes) that shows the target week's date range in its own name and can jump you straight into planning mode
- **Shopping Lists**: multiple lists, each with a favorite flag (the Cooking Plan will write into it) and optional per-member visibility; items carry a quantity and unit, autocomplete from the ingredient catalogue, and completed items can be cleared in one click
- **Recipes**: structured ingredients (free-text entry, auto-created case-insensitively) with quantity/unit/note, servings scaling with kitchen-fraction rounding, meal types, labels, 1-5 star ratings per member (both scores + average shown), prep/cook time, source link, notes, and a "paste ingredient list" importer for recipes copied from websites
- **Cooking log**: "I cooked this" on a recipe records the date and servings (last-cooked / times-cooked are derived from the log), followed by a rate-after-cooking prompt; queryable by day or range for the upcoming Cooking Plan
- **Bilingual config**: labels, meal types and units have a German name (required) and an English name (optional, falls back to German); ingredients are single-language free text. All editable under Settings
- **Cooking Plan**: Schedule meals by date
- **Dashboard**: welcome message, a KPI overview (shopping/recipes/meals/overdue tasks) with shortcuts, "my open household tasks" grouped by overdue/today/this-week, and a read-only weekly preview
- **Account**: profile avatar (upload/preview/remove) via the navbar account menu, alongside Settings and Logout
- **Settings**: household name and timezone (used for "today"/"overdue" comparisons, not the server's own timezone), language (German/English), notification preferences
- **Notifications**: email (SMTP) and Web Push, per-type/per-channel toggles, for tasks due today and weekly household planning due; delivered by a cron-driven management command, not a background daemon; test-email/test-push buttons in Settings for on-demand verification
- **Vouchers**: track gift/store vouchers (monetary, redeemed down over time with a logged history) and non-monetary gifts (e.g. a dinner invitation, marked used in one go); soonest-expiring first, auto-archived once fully used or manually archived, with an "expiring soon" (next 6 months) indicator on each card and a household-overview count; inline editing (value/currency locked once a redemption has been logged)
- **User Authentication**: JWT-based auth
- **Responsive Design**: Works on mobile and desktop

## 🔌 API Endpoints

- `POST /api/auth/token/` - Login
- `POST /api/auth/token/refresh/` - Refresh token
- `GET /api/users/me/` - Current user
- `GET/POST/PATCH/DELETE /api/shopping-lists/` - Shopping lists (empty `visible_to` = everyone); action `clear-completed/`
- `GET/POST/PATCH/DELETE /api/shopping/?list=<id>` - Shopping list items; `POST toggle_completed/`
- `GET/POST/PATCH/DELETE /api/recipes/` - Recipes with nested ingredients (`?q=`, `?label=`, `?category=`); `POST/DELETE {id}/rate/` sets or clears the caller's 1-5 rating
- `GET/POST/DELETE /api/meal-events/` - Cooking log (`?recipe=`, `?date=`, `?start=&end=`); create/delete only
- `GET/POST/PATCH/DELETE /api/units/`, `/api/ingredients/` (`?q=`), `/api/labels/`, `/api/meal-categories/` - Config lookup tables; deleting one still used by a recipe returns 409
- `GET/POST /api/cooking-plans/` - Cooking plans
- `GET/POST /api/task-definitions/` - Recurring task templates (DELETE requires `?confirm=true` if it has occurrences)
- `GET/POST /api/task-instances/` - Task occurrences (`?start=&end=` generates+lists a date range); actions: `reassign/`, `snooze/`, `skip/`, `reopen/`, `postpone/`, `complete/`
- `GET/PATCH /api/members/` - Household members (color, avatar); `GET /api/members/me/`; `DELETE /api/members/{id}/avatar/`
- `GET/PATCH /api/household-settings/` - Household name, timezone (singleton)
- `GET/PATCH /api/notification-preferences/` - Current user's per-type email/push toggles (rows auto-created on first access)
- `GET/POST/DELETE /api/push-subscriptions/` - Current user's registered Web Push devices
- `GET /api/vapid-public-key/` - Public VAPID key for the frontend's `pushManager.subscribe()`
- `POST /api/notifications/test-email/`, `POST /api/notifications/test-push/` - Send a one-off test notification to the current user (used by the Settings page buttons)
- `GET/POST/PATCH/DELETE /api/vouchers/` - Vouchers; actions: `redeem/` (logs a `VoucherRedemption`, auto-archives once the balance hits 0 or for a non-monetary voucher), `toggle-archived/` (manual archive/unarchive)

## 🐧 Raspberry Pi Deployment

Complete setup guide: See [DEPLOYMENT.md](DEPLOYMENT.md)

Quick summary:
1. Install dependencies on Pi
2. Clone repository
3. Setup backend (virtualenv, migrations, superuser)
4. Build frontend
5. Configure Gunicorn + Nginx with HTTPS (self-signed cert — required for Web Push)
6. Schedule `send_notifications` via cron

Access at: `https://<pi-ip>` (self-signed cert — browser warns once per device, accept permanently)

## 📝 Database Models

- **HouseholdMember**: role, color, avatar
- **HouseholdSettings**: singleton — household name, timezone
- **ShoppingList** / **ShoppingListItem**: named lists (favorite flag, optional member visibility) and their items (quantity, unit, optional ingredient link, source)
- **Recipe**: title, servings, times, source link, notes, meal-type and label M2Ms
- **RecipeIngredient** / **Ingredient** / **UnitOfMeasure**: structured ingredient lines against a shared, case-insensitively unique ingredient catalogue and plain (non-converting) unit labels
- **Label** / **MealTimeCategory**: bilingual (`name_de` required, `name_en` optional), seeded with editable starter sets
- **RecipeRating**: one 1-5 score per (recipe, member)
- **MealEvent**: one logged cooking of a recipe — date, servings made, who logged it
- **CookingPlan**: Meal schedule
- **HouseholdTaskDefinition**: recurring task template (RRULE recurrence, icon, assignment mode, optional system_action like the weekly planning reminder)
- **HouseholdTaskInstance**: one occurrence — either generated from a definition, or standalone (one-off, `definition=None`); tracks `occurrence_date` (immutable, what generation keys on) separately from `scheduled_date` (mutable, what dragging/postponing changes) to avoid regenerating duplicates
- **HouseholdTaskEvent**: audit trail per instance (created/reassigned/snoozed/skipped/postponed/completed/reopened)
- **NotificationPreference**: per-user, per-type email/push toggles
- **PushSubscription**: one row per browser/device registered for Web Push
- **NotificationLog**: records a sent (task instance, user, type, channel) combination so the cron command never double-sends
- **Voucher**: gift/store voucher — title, from, location, optional currency/value, expiry, archived flag
- **VoucherRedemption**: one logged use of a voucher — amount used and remaining balance snapshot (both blank for a non-monetary voucher's single "mark used" entry), who logged it

## 🔧 Development

### Add a new API endpoint

1. Create model in `backend/household/models.py`
2. Create serializer in `backend/household/serializers.py`
3. Create viewset in `backend/household/views.py`
4. Register in `backend/household/urls.py`

### Add a new page

1. Create component in `frontend/src/pages/`
2. Import in `frontend/src/App.jsx`
3. Add route

## 🐛 Debugging

**Backend logs**: `python manage.py runserver`
**Frontend logs**: Browser console (F12)
**Raspberry Pi logs**: `sudo journalctl -u gunicorn -f`

## 📦 Deployment Workflow

Run from the laptop (Windows PowerShell), **never** on the Pi itself — its 1GB RAM can't handle a Vite build alongside Django/Gunicorn/Nginx:

```powershell
.\deploy.ps1
```

This builds the frontend locally, backs up the Pi's database, pulls the backend code via git, scp's the built `dist/` over, then runs `pip install`, `migrate`, `collectstatic`, and restarts Gunicorn on the Pi. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full setup.

## ⚙️ Configuration

Environment variables (create `.env` in backend/, see `.env.example` for the full list):
```
DEBUG=True
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///db.sqlite3
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Notifications -- optional, see DEPLOYMENT.md
EMAIL_HOST=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

## 📚 Learn More

- [Django Documentation](https://docs.djangoproject.com/)
- [React Documentation](https://react.dev/)
- [REST Framework](https://www.django-rest-framework.org/)
- [Raspberry Pi Docs](https://www.raspberrypi.com/documentation/)

## 📄 License

MIT License - feel free to use for personal projects

## 🤝 Contributing

This is a personal household project. Feel free to fork and customize!
