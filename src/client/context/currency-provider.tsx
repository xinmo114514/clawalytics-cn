import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getDesktopPreferences, updateDesktopPreferences } from '@/lib/api'
import {
  formatCurrency as formatCurrencyValue,
  formatCurrencyPrecise as formatCurrencyPreciseValue,
  setGlobalCurrency,
} from '@/lib/format'

export type Currency = 'CNY' | 'USD'

type CurrencyContextValue = {
  currency: Currency
  setCurrency: (currency: Currency) => void
  formatCurrency: (value: number) => string
  formatCurrencyPrecise: (value: number, fractionDigits?: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const STORAGE_KEY = 'clawalytics-currency'

function readStoredCurrency(): Currency | null {
  if (typeof window === 'undefined') return null

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === 'CNY' || saved === 'USD' ? saved : null
  } catch {
    return null
  }
}

function persistCurrency(currency: Currency) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(STORAGE_KEY, currency)
  } catch {
    // Private browsing and locked-down webviews may deny storage access.
  }
}

export function getStoredCurrency(): Currency {
  return readStoredCurrency() ?? 'CNY'
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() =>
    getStoredCurrency()
  )

  useEffect(() => {
    const stored = readStoredCurrency()

    if (stored) {
      persistCurrency(stored)
      void updateDesktopPreferences({ currency: stored }).catch(() => undefined)
      return
    }

    void getDesktopPreferences()
      .then((preferences) => {
        const prefCurrency = (preferences as { currency?: Currency }).currency
        if (
          prefCurrency &&
          (prefCurrency === 'CNY' || prefCurrency === 'USD')
        ) {
          persistCurrency(prefCurrency)
          setCurrencyState(prefCurrency)
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setGlobalCurrency(currency)
  }, [currency])

  const setCurrency = (nextCurrency: Currency) => {
    setCurrencyState(nextCurrency)
    persistCurrency(nextCurrency)
    void updateDesktopPreferences({ currency: nextCurrency }).catch(
      () => undefined
    )
  }

  const formatCurrencyFn = useMemo(() => {
    return (value: number) => formatCurrencyValue(value, currency)
  }, [currency])

  const formatCurrencyPreciseFn = useMemo(() => {
    return (value: number, fractionDigits = 4) =>
      formatCurrencyPreciseValue(value, fractionDigits, currency)
  }, [currency])

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      formatCurrency: formatCurrencyFn,
      formatCurrencyPrecise: formatCurrencyPreciseFn,
    }),
    [currency, formatCurrencyFn, formatCurrencyPreciseFn]
  )

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider')
  }
  return context
}
