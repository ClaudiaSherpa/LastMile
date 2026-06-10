import { createContext, useContext } from 'react';

export type Lang = 'es' | 'en';

export interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (es: string, en: string) => string;
}

export const I18nCtx = createContext<I18n>({
  lang: 'es',
  setLang: () => {},
  t: (es) => es,
});

export const useI18n = () => useContext(I18nCtx);
