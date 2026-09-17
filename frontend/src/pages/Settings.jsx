import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import { householdSettingsService } from '../services/api';

const LANGUAGES = [
  { code: 'de', labelKey: 'settings.german' },
  { code: 'en', labelKey: 'settings.english' },
];

const FALLBACK_TIMEZONES = [
  'Europe/Berlin', 'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC',
];

function getTimezoneOptions() {
  if (typeof Intl.supportedValuesOf === 'function') {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return FALLBACK_TIMEZONES;
    }
  }
  return FALLBACK_TIMEZONES;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [householdName, setHouseholdName] = useState('');
  const [timezoneValue, setTimezoneValue] = useState('Europe/Berlin');
  const [saved, setSaved] = useState(false);
  const timezoneOptions = getTimezoneOptions();

  useEffect(() => {
    householdSettingsService.get().then((res) => {
      setHouseholdName(res.data.household_name);
      setTimezoneValue(res.data.timezone);
    });
  }, []);

  const handleLanguageChange = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
  };

  const handleSaveHouseholdSettings = async (e) => {
    e.preventDefault();
    await householdSettingsService.update({ household_name: householdName, timezone: timezoneValue });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('settings.title')}</h2>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">{t('settings.household')}</h3>
          <form onSubmit={handleSaveHouseholdSettings} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('settings.householdName')}</label>
              <input
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-64"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('settings.timezone')}</label>
              <select
                value={timezoneValue}
                onChange={(e) => setTimezoneValue(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-64"
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">{t('settings.timezoneHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                {t('weeklyPlanning.save')}
              </button>
              {saved && <span className="text-sm text-green-600">{t('settings.saved')}</span>}
            </div>
          </form>
        </div>

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
