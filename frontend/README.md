# HUSEHOLD Frontend

React + Vite + Tailwind CSS frontend for the HUSEHOLD household management application.

## Setup

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create .env file from .env.example:
   ```bash
   cp .env.example .env
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:3000`

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

## Project Structure

- `src/pages/` - Page components (Dashboard, Shopping, Recipes, etc.)
- `src/components/` - Reusable components
- `src/services/` - API service layer
- `src/hooks/` - Custom React hooks
- `src/utils/` - Utility functions
- `index.html` - HTML entry point
- `vite.config.js` - Vite configuration
- `tailwind.config.js` - Tailwind CSS configuration

## Features

- User authentication with JWT tokens
- Shopping list management
- Recipe management
- Cooking plan scheduling
- Household task tracking
- Responsive design with Tailwind CSS
