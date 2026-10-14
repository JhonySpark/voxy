import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { StorageKeys, LanguageEnum } from './core/enums';

import ptTranslation from './locales/pt.json';
import enTranslation from './locales/en.json';
import esTranslation from './locales/es.json';

const resources = {
  pt: {
    translation: ptTranslation,
  },
  en: {
    translation: enTranslation,
  },
  es: {
    translation: esTranslation,
  },
};

const savedLanguage = (typeof localStorage !== 'undefined' && localStorage.getItem(StorageKeys.LANGUAGE)) || LanguageEnum.PT;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: LanguageEnum.PT,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
