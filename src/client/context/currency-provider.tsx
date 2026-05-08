import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getDesktopPreferences, updateDesktopPreferences } from '@/lib/api'

export type Currency = 'CNY' | 'USD'

type CurrencyContextValue = {
  currency: Currency
  setCurrency: (currency: Currency) => void
  formatCurrency: (value: number) => string
  formatCurrencyPrecise: (value: number, fractionDigits?: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const STORAGE_KEY = 'clawalytics-currency'
const USD_TO_CNY_RATE = 7

function readStoredCurrency(): Currency | null {
  if (typeof window === 'undefined') return null

  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'CNY' || saved === 'USD' ? saved : null
}

function persistCurrency(currency: Currency) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(STORAGE_KEY, currency)
}

export function getStoredCurrency(): Currency {
  return readStoredCurrency() ?? 'CNY'
}

function formatCNY(value: number): string {
  if (value >= 100) return `¥${value.toFixed(0)}`
  if (value >= 10) return `¥${value.toFixed(1)}`
  if (value >= 1) return `¥${value.toFixed(2)}`
  if (value >= 0.01) return `¥${value.toFixed(2)}`
  return `¥${value.toFixed(4)}`
}

function formatUSD(value: number): string {
  const usdValue = value / USD_TO_CNY_RATE
  if (usdValue >= 100) return `$${usdValue.toFixed(0)}`
  if (usdValue >= 10) return `$${usdValue.toFixed(1)}`
  if (usdValue >= 1) return `$${usdValue.toFixed(2)}`
  if (usdValue >= 0.01) return `$${usdValue.toFixed(2)}`
  return `$${usdValue.toFixed(4)}`
}

function formatCNYPrecise(value: number, fractionDigits = 4): string {
  return `¥${value.toFixed(fractionDigits)}`
}

function formatUSDPrecise(value: number, fractionDigits = 4): string {
  const usdValue = value / USD_TO_CNY_RATE
  return `$${usdValue.toFixed(fractionDigits)}`
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

  const setCurrency = (nextCurrency: Currency) => {
    setCurrencyState(nextCurrency)
    persistCurrency(nextCurrency)
    void updateDesktopPreferences({ currency: nextCurrency }).catch(
      () => undefined
    )
  }

  const formatCurrencyFn = useMemo(() => {
    return (value: number) => {
      return currency === 'USD' ? formatUSD(value) : formatCNY(value)
    }
  }, [currency])

  const formatCurrencyPreciseFn = useMemo(() => {
    return (value: number, fractionDigits = 4) => {
      return currency === 'USD'
        ? formatUSDPrecise(value, fractionDigits)
        : formatCNYPrecise(value, fractionDigits)
    }
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
