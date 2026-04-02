import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ar from './locales/ar.json';

export const LANGUAGE_STORAGE_KEY = 'oryx_language';
export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? 'en';
const initialLang: SupportedLanguage = SUPPORTED_LANGUAGES.includes(savedLang as SupportedLanguage)
  ? (savedLang as SupportedLanguage)
  : 'en';

// Apply dir attribute immediately on load (before React mounts)
document.documentElement.dir = initialLang === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = initialLang;

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
