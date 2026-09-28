import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  householdSettingsService, notificationPreferenceService, pushSubscriptionService, notificationTestService,
  memberService, googleCalendarService,
} from '../services/api';
import { urlBase64ToUint8Array, isPushSupported } from '../utils/push';

const NOTIFICATION_TYPES = ['task_due_today', 'household_planning_due', 'meal_planning_due', 'cooking_today'];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [householdName, setHouseholdName] = useState('');
  const [timezoneValue, setTimezoneValue] = useState('Europe/Berlin');
  const [saved, setSaved] = useState(false);
  const timezoneOptions = getTimezoneOptions();

  const [preferences, setPreferences] = useState([]);
  // null for an account without a household member profile (e.g. admin-only).
  const [member, setMember] = useState(null);
  const [pushDeviceSubscribed, setPushDeviceSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState(null);
  const [testPushStatus, setTestPushStatus] = useState(null);
  const [testEmailBusy, setTestEmailBusy] = useState(false);
  const [testPushBusy, setTestPushBusy] = useState(false);

  const [googleCalendar, setGoogleCalendar] = useState(null);
  const [googleCalendarBusy, setGoogleCalendarBusy] = useState(false);
  const [googleCalendarNotice, setGoogleCalendarNotice] = useState(null);

  const loadGoogleCalendar = () => googleCalendarService.getStatus().then((res) => setGoogleCalendar(res.data));

  useEffect(() => {
    householdSettingsService.get().then((res) => {
      setHouseholdName(res.data.household_name);
      setTimezoneValue(res.data.timezone);
    });
    notificationPreferenceService.getAll().then((res) => setPreferences(res.data));
    memberService.getMe().then((res) => setMember(res.data)).catch(() => {});
    loadGoogleCalendar();

    if (isPushSupported()) {
      navigator.serviceWorker.ready.then((registration) =>
        registration.pushManager.getSubscription().then((sub) => setPushDeviceSubscribed(!!sub))
      );
    }
  }, []);

  useEffect(() => {
    const result = searchParams.get('google_calendar');
    if (!result) return;
    setGoogleCalendarNotice(result === 'connected' ? { ok: true } : { ok: false });
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectGoogleCalendar = async () => {
    setGoogleCalendarBusy(true);
    try {
      const { data } = await googleCalendarService.getConnectUrl();
      window.location.href = data.url;
    } catch {
      setGoogleCalendarBusy(false);
      setGoogleCalendarNotice({ ok: false });
    }
  };

  const handleToggleGoogleCalendarSync = async () => {
    setGoogleCalendarBusy(true);
    try {
      await googleCalendarService.setSyncEnabled(!googleCalendar.sync_enabled);
      await loadGoogleCalendar();
    } finally {
      setGoogleCalendarBusy(false);
    }
  };

  const handleDisconnectGoogleCalendar = async () => {
    if (!window.confirm(t('settings.googleCalendarConfirmDisconnect'))) return;
    setGoogleCalendarBusy(true);
    try {
      await googleCalendarService.disconnect();
      await loadGoogleCalendar();
    } finally {
      setGoogleCalendarBusy(false);
    }
  };

  const handlePreferenceChange = async (notificationType, channel, value) => {
    const updated = preferences.map((pref) =>
      pref.notification_type === notificationType ? { ...pref, [channel]: value } : pref
    );
    setPreferences(updated);
    await notificationPreferenceService.update(updated);
  };

  const handleNotificationLanguageChange = async (code) => {
    const response = await memberService.update(member.id, { notification_language: code });
    setMember(response.data);
  };

  const handleEnablePush = async () => {
    setPushError('');
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushError(t('settings.pushPermissionDenied'));
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const { data } = await pushSubscriptionService.getVapidPublicKey();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.public_key),
      });
      await pushSubscriptionService.subscribe(subscription, navigator.userAgent.slice(0, 100));
      setPushDeviceSubscribed(true);
    } catch {
      setPushError(t('settings.pushEnableFailed'));
    } finally {
      setPushBusy(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailBusy(true);
    setTestEmailStatus(null);
    try {
      const { data } = await notificationTestService.sendTestEmail();
      setTestEmailStatus({ ok: true, message: data.detail });
    } catch (err) {
      setTestEmailStatus({ ok: false, message: err.response?.data?.detail || t('settings.testFailed') });
    } finally {
      setTestEmailBusy(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestPushBusy(true);
    setTestPushStatus(null);
    try {
      const { data } = await notificationTestService.sendTestPush();
      setTestPushStatus({ ok: true, message: data.detail });
    } catch (err) {
      setTestPushStatus({ ok: false, message: err.response?.data?.detail || t('settings.testFailed') });
    } finally {
      setTestPushBusy(false);
    }
  };

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

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">{t('settings.notifications')}</h3>

          {member && (
            <div className="mb-5">
              <label className="block text-xs text-gray-500 mb-1">{t('settings.notificationLanguage')}</label>
              <select
                value={member.notification_language}
                onChange={(e) => handleNotificationLanguageChange(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                {LANGUAGES.map(({ code, labelKey }) => (
                  <option key={code} value={code}>{t(labelKey)}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">{t('settings.notificationLanguageHint')}</p>
            </div>
          )}

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="font-normal pb-2">{t('settings.notificationType')}</th>
                <th className="font-normal pb-2 text-center">{t('settings.emailChannel')}</th>
                <th className="font-normal pb-2 text-center">{t('settings.pushChannel')}</th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_TYPES.map((type) => {
                const pref = preferences.find((p) => p.notification_type === type);
                if (!pref) return null;
                return (
                  <tr key={type} className="border-t">
                    <td className="py-2">{t(`settings.notificationTypes.${type}`)}</td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        checked={pref.email_enabled}
                        onChange={(e) => handlePreferenceChange(type, 'email_enabled', e.target.checked)}
                      />
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        checked={pref.push_enabled}
                        onChange={(e) => handlePreferenceChange(type, 'push_enabled', e.target.checked)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="text-xs text-gray-400 mb-3">{t('settings.pushIosHint')}</p>

          {isPushSupported() ? (
            pushDeviceSubscribed ? (
              <p className="text-sm text-green-600">{t('settings.pushEnabledOnDevice')}</p>
            ) : (
              <div>
                <button
                  onClick={handleEnablePush}
                  disabled={pushBusy}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {pushBusy ? t('settings.pushEnabling') : t('settings.enablePushOnDevice')}
                </button>
                {pushError && <p className="text-sm text-red-600 mt-2">{pushError}</p>}
              </div>
            )
          ) : (
            <p className="text-sm text-gray-400">{t('settings.pushNotSupported')}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t">
            <button
              onClick={handleSendTestEmail}
              disabled={testEmailBusy}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 disabled:opacity-50 text-sm"
            >
              {testEmailBusy ? t('settings.testSending') : t('settings.sendTestEmail')}
            </button>
            <button
              onClick={handleSendTestPush}
              disabled={testPushBusy}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 disabled:opacity-50 text-sm"
            >
              {testPushBusy ? t('settings.testSending') : t('settings.sendTestPush')}
            </button>
          </div>
          {testEmailStatus && (
            <p className={`text-sm mt-2 ${testEmailStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
              {testEmailStatus.message}
            </p>
          )}
          {testPushStatus && (
            <p className={`text-sm mt-2 ${testPushStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
              {testPushStatus.message}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">{t('settings.googleCalendar')}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('settings.googleCalendarHint')}</p>

          {googleCalendarNotice && (
            <p className={`text-sm mb-4 ${googleCalendarNotice.ok ? 'text-green-600' : 'text-red-600'}`}>
              {t(googleCalendarNotice.ok ? 'settings.googleCalendarConnected' : 'settings.googleCalendarFailed')}
            </p>
          )}

          {googleCalendar && (
            googleCalendar.is_connected ? (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={googleCalendar.sync_enabled}
                    disabled={googleCalendarBusy}
                    onChange={handleToggleGoogleCalendarSync}
                  />
                  {t('settings.googleCalendarSyncEnabled')}
                </label>
                <p className="text-xs text-gray-400">
                  {googleCalendar.last_synced_at
                    ? t('settings.googleCalendarLastSynced', { time: new Date(googleCalendar.last_synced_at).toLocaleString(i18n.resolvedLanguage) })
                    : t('settings.googleCalendarNotSyncedYet')}
                </p>
                <button
                  onClick={handleDisconnectGoogleCalendar}
                  disabled={googleCalendarBusy}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  {t('settings.googleCalendarDisconnect')}
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectGoogleCalendar}
                disabled={googleCalendarBusy}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {googleCalendarBusy ? t('settings.googleCalendarConnecting') : t('settings.googleCalendarConnectButton')}
              </button>
            )
          )}
        </div>

        <p className="text-gray-600">{t('settings.comingSoon')}</p>
      </main>
    </div>
  );
}
