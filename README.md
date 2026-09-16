# HUSEHOLD - Household Management App

A lightweight web application for managing household tasks, shopping lists, cooking plans, and recipes. Designed to run on a Raspberry Pi with 2 household members.

## 🏗️ Architecture

- **Backend**: Django 4.2 + Django REST Framework + SimpleJWT
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: SQLite3
- **Server**: Nginx + Gunicorn
- **Deployment**: Raspberry Pi (3B+ or newer)

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
├── DEPLOYMENT.md          # Raspberry Pi setup guide
└── deploy.sh              # Automated deployment script
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

- **Shopping List**: Add items, mark complete
- **Household Tasks**: Create, assign, prioritize tasks
- **Recipes**: Store and browse recipes
- **Cooking Plan**: Schedule meals by date
- **User Authentication**: Simple JWT-based auth
- **Responsive Design**: Works on mobile and desktop

## 🔌 API Endpoints

- `POST /api/auth/token/` - Login
- `POST /api/auth/token/refresh/` - Refresh token
- `GET /api/users/me/` - Current user
- `GET/POST /api/shopping/` - Shopping list
- `GET/POST /api/tasks/` - Tasks
- `GET/POST /api/recipes/` - Recipes
- `GET/POST /api/cooking-plans/` - Cooking plans

## 🐧 Raspberry Pi Deployment

Complete setup guide: See [DEPLOYMENT.md](DEPLOYMENT.md)

Quick summary:
1. Install dependencies on Pi
2. Clone repository
3. Setup backend (virtualenv, migrations, superuser)
4. Build frontend
5. Configure Gunicorn + Nginx
6. Enable auto-deployment via git hook

Access at: `http://<pi-ip>` (or `http://<pi-hostname>.local`)

## 📝 Database Models

- **HouseholdMember**: User roles (admin/member)
- **ShoppingListItem**: Items to buy
- **Recipe**: Recipe storage
- **CookingPlan**: Meal schedule
- **HouseholdTask**: Task tracking

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

### Manual
```bash
git pull
./deploy.sh
sudo systemctl restart gunicorn
```

### Automatic (via git hook)
```bash
git push pi main  # Triggers auto-deployment on Pi
```

## ⚙️ Configuration

Environment variables (create `.env` in backend/):
```
DEBUG=True
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///db.sqlite3
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
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
