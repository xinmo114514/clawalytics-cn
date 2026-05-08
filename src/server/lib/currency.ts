export const USD_TO_CNY_RATE = 7

export function convertUsdToCny(value: number): number {
  return value * USD_TO_CNY_RATE
}

export function formatCny(value: number, fractionDigits = 2): string {
  return `¥${value.toFixed(fractionDigits)}`
}
