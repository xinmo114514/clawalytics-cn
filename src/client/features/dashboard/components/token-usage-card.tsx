import { Coins } from 'lucide-react'
import type { DailyCost, TokenSummary } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useCurrency } from '@/context/currency-provider'
import { useLocale } from '@/context/locale-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenUsageChart } from './token-usage-chart'

interface TokenUsageCardProps {
  data: DailyCost[]
  summary: TokenSummary | undefined
  chartLoading: boolean
  summaryLoading: boolean
  summaryError: boolean
  onRetry: () => void
}

export function TokenUsageCard({
  data,
  summary,
  chartLoading,
  summaryLoading,
  summaryError,
  onRetry,
}: TokenUsageCardProps) {
  const { text } = useLocale()
  const { formatCurrency } = useCurrency()

  const periods = summary
    ? [
        {
          label: text('5 小时', '5 hours'),
          value: summary.last5Hours,
        },
        { label: text('7 天', '7 days'), value: summary.last7Days },
        {
          label: text('30 天', '30 days'),
          value: summary.last30Days,
        },
        { label: text('全部', 'All time'), value: summary.lifetime },
      ]
    : []

  return (
    <Card className='min-w-0'>
      <CardHeader className='gap-3 border-b bg-muted/10'>
        <CardTitle className='flex items-center gap-2'>
          <Coins className='h-5 w-5' />
          {text('Token 消耗', 'Token Usage')}
        </CardTitle>
        <CardDescription>
          {text(
            '节点悬浮查看每日明细，下面查看不同时间范围',
            'Hover over a point for daily details and compare time ranges below'
          )}
        </CardDescription>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <span className='h-2 w-2 rounded-full bg-chart-2' />
          {text('每日 Token 总量', 'Daily total tokens')}
        </div>
      </CardHeader>
      <CardContent className='space-y-6 ps-2 pe-4'>
        {chartLoading ? (
          <Skeleton className='h-[300px] w-full' />
        ) : (
          <TokenUsageChart data={data} />
        )}

        <div className='grid grid-cols-2 gap-3 border-t ps-4 pt-4 sm:grid-cols-4'>
          {summaryLoading ? (
            [...Array(4)].map((_, index) => (
              <div key={index} className='space-y-2'>
                <Skeleton className='h-3 w-16' />
                <Skeleton className='h-5 w-20' />
                <Skeleton className='h-3 w-24' />
              </div>
            ))
          ) : summaryError ? (
            <div
              className='col-span-2 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground sm:col-span-4'
              role='status'
              aria-live='polite'
            >
              <span>
                {text(
                  'Token 汇总暂时无法加载。',
                  'Token summary is temporarily unavailable.'
                )}
              </span>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={onRetry}
              >
                {text('重试', 'Retry')}
              </Button>
            </div>
          ) : summary ? (
            periods.map((period) => (
              <div
                key={period.label}
                className='min-w-0 rounded-lg border border-border/60 bg-muted/25 p-3'
              >
                <p className='truncate text-xs text-muted-foreground'>
                  {period.label}
                </p>
                <p className='mt-1 truncate font-mono text-lg font-semibold tabular-nums'>
                  {formatNumber(period.value.total)}
                </p>
                <p className='truncate text-[11px] text-muted-foreground'>
                  {formatCurrency(period.value.cost)} · {text('成本', 'cost')}
                </p>
              </div>
            ))
          ) : (
            <p className='col-span-2 text-sm text-muted-foreground sm:col-span-4'>
              {text('暂无 Token 汇总数据。', 'No token summary data yet.')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
