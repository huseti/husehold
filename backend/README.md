# HUSEHOLD Backend

Django REST API for the HUSEHOLD household management application.

## Setup

### Prerequisites
- Python 3.9+
- pip

### Installation

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create .env file from .env.example:
   ```bash
   cp .env.example .env
   ```

4. Run migrations:
   ```bash
   python manage.py migrate
   ```

5. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```

6. Run development server:
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://localhost:8000/api/`

## API Endpoints

- `/api/auth/token/` - Obtain JWT token
- `/api/auth/token/refresh/` - Refresh JWT token
- `/api/users/` - User management
- `/api/shopping/` - Shopping list items
- `/api/recipes/` - Recipes
- `/api/cooking-plans/` - Cooking plans
- `/api/tasks/` - Household tasks
- `/api/members/` - Household members

## Admin Panel

Access the Django admin at `http://localhost:8000/admin/`
