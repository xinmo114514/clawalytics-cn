import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DailyCost } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useCurrency } from '@/context/currency-provider'
import { useLocale } from '@/context/locale-provider'
import { useChartColors } from '@/hooks/use-chart-colors'

interface TokenUsageChartProps {
  data: DailyCost[]
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  const { locale, text } = useLocale()
  const { formatCurrencyPrecise } = useCurrency()
  const colors = useChartColors()
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US'
  const numberLocale = locale === 'zh' ? 'zh-CN' : 'en-US'

  const chartData = useMemo(
    () =>
      data.map((item) => ({
        date: new Date(`${item.date}T00:00:00`).toLocaleDateString(dateLocale, {
          month: 'short',
          day: 'numeric',
        }),
        fullDate: new Date(`${item.date}T00:00:00`).toLocaleDateString(
          dateLocale,
          {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }
        ),
        totalTokens:
          item.total_input_tokens +
          item.total_output_tokens +
          item.cache_read_tokens +
          item.cache_creation_tokens,
        inputTokens: item.total_input_tokens,
        outputTokens: item.total_output_tokens,
        cacheReadTokens: item.cache_read_tokens,
        cacheCreationTokens: item.cache_creation_tokens,
        cost: item.total_cost,
        requests: item.request_count,
      })),
    [data, dateLocale]
  )

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-center text-muted-foreground'>
        {text(
          '暂无数据。开始使用 Claude Code 后，这里会显示 Token 消耗走势。',
          'No data yet. Start using Claude Code to see your token usage trend.'
        )}
      </div>
    )
  }

  const chartColor = colors.chart2 || 'var(--chart-2)'
  const gridColor = colors.border || 'var(--border)'
  const axisColor = colors.mutedForeground || 'var(--muted-foreground)'

  return (
    <div
      role='img'
      aria-label={text(
        '最近 30 天的 Token 消耗趋势图',
        'Token usage trend over the last 30 days'
      )}
    >
      <ResponsiveContainer width='100%' height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 12, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id='tokenUsageGradient' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor={chartColor} stopOpacity={0.42} />
              <stop offset='100%' stopColor={chartColor} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray='3 3'
            vertical={false}
            stroke={gridColor}
          />
          <XAxis
            dataKey='date'
            stroke={axisColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval='preserveStartEnd'
          />
          <YAxis
            stroke={axisColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatNumber}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: chartColor, strokeDasharray: '4 4' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null

              const item = payload[0]?.payload as
                | (typeof chartData)[0]
                | undefined
              if (!item) return null
              const tokenRows = [
                [text('输入', 'Input'), item.inputTokens],
                [text('输出', 'Output'), item.outputTokens],
                [text('缓存读取', 'Cache read'), item.cacheReadTokens],
                [text('缓存写入', 'Cache write'), item.cacheCreationTokens],
              ] as const

              return (
                <div className='min-w-[208px] rounded-lg border bg-background p-3 shadow-md'>
                  <div className='mb-2 text-sm font-medium'>
                    {item.fullDate}
                  </div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between gap-6'>
                      <span className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <span
                          className='h-2 w-2 rounded-full'
                          style={{ backgroundColor: chartColor }}
                        />
                        {text('总 Token', 'Total tokens')}
                      </span>
                      <span className='font-mono text-sm font-semibold'>
                        {item.totalTokens.toLocaleString(numberLocale)}
                      </span>
                    </div>
                    {tokenRows.map(([label, value]) => (
                      <div
                        key={label}
                        className='flex items-center justify-between gap-6 text-xs text-muted-foreground'
                      >
                        <span>{label}</span>
                        <span className='font-mono'>
                          {value.toLocaleString(numberLocale)}
                        </span>
                      </div>
                    ))}
                    <div className='flex items-center justify-between gap-6 border-t pt-1.5 text-xs text-muted-foreground'>
                      <span>{text('成本 / 请求', 'Cost / requests')}</span>
                      <span className='font-mono'>
                        {formatCurrencyPrecise(item.cost)} · {item.requests}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }}
          />
          <Area
            isAnimationActive={false}
            type='monotone'
            dataKey='totalTokens'
            stroke={chartColor}
            strokeWidth={2.5}
            fill='url(#tokenUsageGradient)'
            dot={{ r: 3, fill: chartColor, strokeWidth: 0 }}
            activeDot={{
              r: 6,
              fill: chartColor,
              stroke: 'var(--background)',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
