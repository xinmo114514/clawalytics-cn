import { format, formatDistanceToNow, type Locale } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export const appLocale: Locale = zhCN

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: appLocale,
  })
}

export function formatDate(date: Date | string, pattern = 'yyyy/MM/dd'): string {
  return format(new Date(date), pattern, { locale: appLocale })
}

export function formatDurationZh(hours: number, minutes: number): string {
  if (hours > 0) return `${hours}小时 ${minutes}分钟`
  if (minutes > 0) return `${minutes}分钟`
  return '少于 1 分钟'
}
