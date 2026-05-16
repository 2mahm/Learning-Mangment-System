import { createContext, useContext, useEffect, useState } from 'react'
import i18n from '../i18n'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'lms_lang'

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE_KEY) || 'en')

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    document.documentElement.dir  = dir
    localStorage.setItem(STORAGE_KEY, lang)
    i18n.changeLanguage(lang)
  }, [lang])

  const toggleLanguage = () => setLang(l => (l === 'en' ? 'ar' : 'en'))
  const isRTL = lang === 'ar'

  return (
    <LanguageContext.Provider value={{ lang, isRTL, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
