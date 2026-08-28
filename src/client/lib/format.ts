export type Currency = 'CNY' | 'USD'

export const USD_TO_CNY_RATE = 7

let currentCurrency: Currency = 'CNY'

function normalizeCurrencyValue(value: number, currency: Currency): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return currency === 'USD' ? value / USD_TO_CNY_RATE : value
}

function getCompactFractionDigits(value: number): {
  minimumFractionDigits: number
  maximumFractionDigits: number
} {
  const absoluteValue = Math.abs(value)
  if (absoluteValue >= 100) {
    return { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  }
  if (absoluteValue >= 10) {
    return { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  }
  if (absoluteValue >= 0.01) {
    return { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  }
  return { minimumFractionDigits: 4, maximumFractionDigits: 4 }
}

function getSafeFractionDigits(fractionDigits: number): number {
  return Number.isInteger(fractionDigits) &&
    fractionDigits >= 0 &&
    fractionDigits <= 20
    ? fractionDigits
    : 4
}

export function setGlobalCurrency(currency: Currency): void {
  currentCurrency = currency
}

export function getGlobalCurrency(): Currency {
  return currentCurrency
}

export function formatCurrency(value: number, currency?: Currency): string {
  const targetCurrency = currency ?? currentCurrency
  const normalizedValue = normalizeCurrencyValue(value, targetCurrency)
  const digits = getCompactFractionDigits(normalizedValue)

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: targetCurrency,
    currencyDisplay: 'narrowSymbol',
    ...digits,
  }).format(normalizedValue)
}

export function formatCurrencyPrecise(
  value: number,
  fractionDigits = 4,
  currency?: Currency
): string {
  const targetCurrency = currency ?? currentCurrency
  const digits = getSafeFractionDigits(fractionDigits)
  const normalizedValue = normalizeCurrencyValue(value, targetCurrency)

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: targetCurrency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(normalizedValue)
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}
