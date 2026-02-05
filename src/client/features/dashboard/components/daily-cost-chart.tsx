import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type { DailyCost } from '@/lib/api'

interface DailyCostChartProps {
  data: DailyCost[]
}

export function DailyCostChart({ data }: DailyCostChartProps) {
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('de-CH', {
      month: 'short',
      day: 'numeric',
    }),
    fullDate: new Date(item.date).toLocaleDateString('de-CH', {
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
        Noch keine Daten vorhanden. Starte OpenClaw, um hier deine Kosten zu sehen.
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id='colorCostGradient' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='5%' stopColor='hsl(var(--primary))' stopOpacity={0.4} />
            <stop offset='95%' stopColor='hsl(var(--primary))' stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray='3 3'
          vertical={false}
          stroke='hsl(var(--border))'
        />
        <XAxis
          dataKey='date'
          stroke='hsl(var(--muted-foreground))'
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval='preserveStartEnd'
        />
        <YAxis
          stroke='hsl(var(--muted-foreground))'
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
              const data = payload[0].payload as (typeof chartData)[0]
              return (
                <div className='rounded-lg border bg-background p-3 shadow-md'>
                  <div className='mb-2 font-medium text-sm'>{data.fullDate}</div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between gap-6'>
                      <span className='text-xs text-muted-foreground'>
                        Kosten
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        ${data.cost.toFixed(4)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-6'>
                      <span className='text-xs text-muted-foreground'>
                        Requests
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {data.requests}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-6'>
                      <span className='text-xs text-muted-foreground'>
                        Sessions
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {data.sessions}
                      </span>
                    </div>
                    {data.cacheSavings > 0 && (
                      <div className='flex items-center justify-between gap-6 border-t pt-1.5'>
                        <span className='text-xs text-green-600 dark:text-green-400'>
                          Cache-Ersparnis
                        </span>
                        <span className='font-mono font-medium text-sm text-green-600 dark:text-green-400'>
                          ${data.cacheSavings.toFixed(4)}
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
          type='monotone'
          dataKey='cost'
          stroke='hsl(var(--primary))'
          strokeWidth={2}
          fillOpacity={1}
          fill='url(#colorCostGradient)'
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
