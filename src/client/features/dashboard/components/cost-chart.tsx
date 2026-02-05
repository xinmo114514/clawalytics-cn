import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { type DailyCost } from '@/lib/api'

interface CostChartProps {
  data: DailyCost[]
}

export function CostChart({ data }: CostChartProps) {
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    cost: item.total_cost,
    requests: item.request_count,
  }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[350px] items-center justify-center text-muted-foreground'>
        No data yet. Start using OpenClaw to see your costs here.
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={350}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id='colorCost' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='5%' stopColor='hsl(var(--primary))' stopOpacity={0.3} />
            <stop offset='95%' stopColor='hsl(var(--primary))' stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey='date'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          direction='ltr'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value.toFixed(2)}`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className='rounded-lg border bg-background p-2 shadow-sm'>
                  <div className='grid gap-2'>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-[0.70rem] uppercase text-muted-foreground'>
                        Cost
                      </span>
                      <span className='font-bold'>
                        ${Number(payload[0].value).toFixed(4)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-[0.70rem] uppercase text-muted-foreground'>
                        Requests
                      </span>
                      <span className='font-bold'>
                        {payload[0].payload.requests}
                      </span>
                    </div>
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
          fillOpacity={1}
          fill='url(#colorCost)'
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
