import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type AppLocale = 'zh' | 'en'

type LocaleContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  text: (zh: string, en: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

const STORAGE_KEY = 'clawalytics-locale'

export function getStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'zh' ? 'zh' : 'en'
}

export function translateStatic(zh: string, en: string): string {
  return getStoredLocale() === 'zh' ? zh : en
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = (nextLocale: AppLocale) => {
    setLocaleState(nextLocale)
    window.localStorage.setItem(STORAGE_KEY, nextLocale)
    document.documentElement.lang = nextLocale === 'zh' ? 'zh-CN' : 'en'
  }

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      text: (zh: string, en: string) => (locale === 'zh' ? zh : en),
    }),
    [locale]
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return context
}
