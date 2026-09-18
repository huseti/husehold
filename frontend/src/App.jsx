import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './index.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ShoppingList from './pages/ShoppingList';
import Recipes from './pages/Recipes';
import CookingPlan from './pages/CookingPlan';
import Tasks from './pages/Tasks';
import Vouchers from './pages/Vouchers';
import Settings from './pages/Settings';

function App() {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
        {isAuthenticated ? (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/shopping" element={<ShoppingList />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/cooking-plan" element={<CookingPlan />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/vouchers" element={<Vouchers />} />
            <Route path="/settings" element={<Settings />} />
          </>
        ) : (
          <Route path="*" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
