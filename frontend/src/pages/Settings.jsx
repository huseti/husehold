import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';

const LANGUAGES = [
  { code: 'de', labelKey: 'settings.german' },
  { code: 'en', labelKey: 'settings.english' },
];

export default function Settings() {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('settings.title')}</h2>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">{t('settings.language')}</h3>
          <div className="space-x-2">
            {LANGUAGES.map(({ code, labelKey }) => (
              <button
                key={code}
                onClick={() => handleLanguageChange(code)}
                className={
                  i18n.resolvedLanguage === code
                    ? 'bg-blue-500 text-white px-4 py-2 rounded'
                    : 'bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300'
                }
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        <p className="text-gray-600">{t('settings.comingSoon')}</p>
      </main>
    </div>
  );
}
