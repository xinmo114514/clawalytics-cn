import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useLocale } from '@/context/locale-provider'
import { useChartColors } from '@/hooks/use-chart-colors'
import type { DailyCost } from '@/lib/api'

interface DailyCostChartProps {
  data: DailyCost[]
}

export function DailyCostChart({ data }: DailyCostChartProps) {
  const { locale, text } = useLocale()
  const colors = useChartColors()
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US'

  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString(dateLocale, {
      month: 'short',
      day: 'numeric',
    }),
    fullDate: new Date(item.date).toLocaleDateString(dateLocale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }),
    cost: item.total_cost,
    requests: item.request_count,
    sessions: item.session_count,
    cacheSavings: item.cache_savings,
  }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-muted-foreground'>
        {text(
          '暂无数据。开始使用 Claude Code 后，这里会显示你的成本走势。',
          'No data yet. Start using Claude Code to see your costs here.'
        )}
      </div>
    )
  }

  const chartColor = colors.chart1 || 'oklch(0.646 0.222 41.116)'
  const comparisonColor =
    colors.chart2 || colors.success || 'oklch(0.6 0.118 184.704)'
  const gridColor = colors.border || 'oklch(0.929 0.013 255.508)'
  const axisColor = colors.mutedForeground || 'oklch(0.554 0.046 257.417)'

  return (
    <ResponsiveContainer width='100%' height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id='colorCostGradient' x1='0' y1='0' x2='1' y2='0'>
            <stop offset='0%' stopColor={chartColor} stopOpacity={0.3} />
            <stop offset='40%' stopColor={chartColor} stopOpacity={0.6} />
            <stop offset='100%' stopColor={chartColor} stopOpacity={1} />
          </linearGradient>
          <linearGradient id='colorSavingsGradient' x1='0' y1='0' x2='1' y2='0'>
            <stop offset='0%' stopColor={comparisonColor} stopOpacity={0.22} />
            <stop offset='40%' stopColor={comparisonColor} stopOpacity={0.45} />
            <stop offset='100%' stopColor={comparisonColor} stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray='3 3' vertical={false} stroke={gridColor} />
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
          tickFormatter={(value: number) => `$${value.toFixed(2)}`}
          width={55}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const tooltipData = payload[0].payload as (typeof chartData)[0]

              return (
                <div className='rounded-lg border bg-background p-3 shadow-md'>
                  <div className='mb-2 text-sm font-medium'>
                    {tooltipData.fullDate}
                  </div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between gap-6'>
                      <span className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <span
                          className='h-2 w-2 rounded-full'
                          style={{ backgroundColor: chartColor }}
                        />
                        {text('成本', 'Cost')}
                      </span>
                      <span className='font-mono text-sm font-medium'>
                        ${tooltipData.cost.toFixed(4)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-6'>
                      <span className='text-xs text-muted-foreground'>
                        {text('请求数', 'Requests')}
                      </span>
                      <span className='font-mono text-sm font-medium'>
                        {tooltipData.requests}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-6'>
                      <span className='text-xs text-muted-foreground'>
                        {text('会话数', 'Sessions')}
                      </span>
                      <span className='font-mono text-sm font-medium'>
                        {tooltipData.sessions}
                      </span>
                    </div>
                    {tooltipData.cacheSavings > 0 && (
                      <div className='flex items-center justify-between gap-6 border-t pt-1.5'>
                        <span
                          className='flex items-center gap-2 text-xs'
                          style={{ color: comparisonColor }}
                        >
                          <span
                            className='h-2 w-2 rounded-full'
                            style={{ backgroundColor: comparisonColor }}
                          />
                          {text('缓存节省', 'Cache Savings')}
                        </span>
                        <span
                          className='font-mono text-sm font-medium'
                          style={{ color: comparisonColor }}
                        >
                          ${tooltipData.cacheSavings.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            return null
          }}
        />
        <Area
          type='step'
          dataKey='cost'
          stroke={chartColor}
          strokeWidth={3}
          fillOpacity={1}
          fill='url(#colorCostGradient)'
        />
        <Area
          type='step'
          dataKey='cacheSavings'
          stroke={comparisonColor}
          strokeWidth={2}
          fillOpacity={1}
          fill='url(#colorSavingsGradient)'
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
