import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cookingPlanService } from '../services/api';
import Navbar from '../components/Navbar';

export default function CookingPlan() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await cookingPlanService.getAll();
      setPlans(response.data.results || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('cookingPlan.title')}</h2>
        <p className="text-gray-600">{t('cookingPlan.comingSoon')}</p>
      </main>
    </div>
  );
}
