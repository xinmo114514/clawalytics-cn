export type Currency = 'CNY' | 'USD'

export const USD_TO_CNY_RATE = 7

let currentCurrency: Currency = 'CNY'

export function setGlobalCurrency(currency: Currency): void {
  currentCurrency = currency
}

export function getGlobalCurrency(): Currency {
  return currentCurrency
}

export function formatCurrency(value: number, currency?: Currency): string {
  const targetCurrency = currency ?? currentCurrency

  if (targetCurrency === 'USD') {
    const usdValue = value / USD_TO_CNY_RATE
    if (usdValue >= 100) return `$${usdValue.toFixed(0)}`
    if (usdValue >= 10) return `$${usdValue.toFixed(1)}`
    if (usdValue >= 1) return `$${usdValue.toFixed(2)}`
    if (usdValue >= 0.01) return `$${usdValue.toFixed(2)}`
    return `$${usdValue.toFixed(4)}`
  }

  if (value >= 100) return `¥${value.toFixed(0)}`
  if (value >= 10) return `¥${value.toFixed(1)}`
  if (value >= 1) return `¥${value.toFixed(2)}`
  if (value >= 0.01) return `¥${value.toFixed(2)}`
  return `¥${value.toFixed(4)}`
}

export function formatCurrencyPrecise(
  value: number,
  fractionDigits = 4,
  currency?: Currency
): string {
  const targetCurrency = currency ?? currentCurrency

  if (targetCurrency === 'USD') {
    const usdValue = value / USD_TO_CNY_RATE
    return `$${usdValue.toFixed(fractionDigits)}`
  }

  return `¥${value.toFixed(fractionDigits)}`
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}
