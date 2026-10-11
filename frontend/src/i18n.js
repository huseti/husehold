import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import de from './locales/de.json';

const storedLanguage = localStorage.getItem('language');

// <html lang> drives the browser's hyphenation dictionary and screen readers.
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    lng: storedLanguage || 'de',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
