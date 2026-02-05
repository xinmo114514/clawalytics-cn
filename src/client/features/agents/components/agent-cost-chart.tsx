import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type { AgentDailyCost } from '@/lib/api'

interface AgentCostChartProps {
  data: AgentDailyCost[]
}

export function AgentCostChart({ data }: AgentCostChartProps) {
  // Aggregate costs by date (in case multiple agents)
  const aggregatedByDate = data.reduce(
    (acc, item) => {
      const existing = acc.get(item.date)
      if (existing) {
        existing.total_cost += item.total_cost
        existing.input_tokens += item.input_tokens
        existing.output_tokens += item.output_tokens
        existing.cache_read_tokens += item.cache_read_tokens
        existing.cache_creation_tokens += item.cache_creation_tokens
        existing.request_count += item.request_count
      } else {
        acc.set(item.date, { ...item })
      }
      return acc
    },
    new Map<string, AgentDailyCost>()
  )

  const chartData = Array.from(aggregatedByDate.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((item) => ({
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      fullDate: new Date(item.date).toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      cost: item.total_cost,
      requests: item.request_count,
      inputTokens: item.input_tokens,
      outputTokens: item.output_tokens,
      cacheReadTokens: item.cache_read_tokens,
      cacheCreationTokens: item.cache_creation_tokens,
    }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-muted-foreground'>
        No data available yet. Costs will be displayed here once agents are
        active.
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={300}>
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id='agentCostGradient' x1='0' y1='0' x2='0' y2='1'>
            <stop
              offset='5%'
              stopColor='hsl(var(--primary))'
              stopOpacity={0.4}
            />
            <stop
              offset='95%'
              stopColor='hsl(var(--primary))'
              stopOpacity={0.05}
            />
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
              const tooltipData = payload[0].payload as (typeof chartData)[0]
              return (
                <div className='rounded-lg border bg-background p-3 shadow-md'>
                  <div className='mb-2 font-medium text-sm'>
                    {tooltipData.fullDate}
                  </div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between gap-6'>
                      <span className='text-xs text-muted-foreground'>
                        Cost
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        ${tooltipData.cost.toFixed(4)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-6'>
                      <span className='text-xs text-muted-foreground'>
                        Requests
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {tooltipData.requests}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-6 border-t pt-1.5 text-xs text-muted-foreground'>
                      <span>
                        {(tooltipData.inputTokens / 1000).toFixed(1)}K in
                      </span>
                      <span>
                        {(tooltipData.outputTokens / 1000).toFixed(1)}K out
                      </span>
                    </div>
                    {(tooltipData.cacheReadTokens > 0 ||
                      tooltipData.cacheCreationTokens > 0) && (
                      <div className='flex items-center justify-between gap-6 text-xs text-green-600 dark:text-green-400'>
                        <span>Cache read:</span>
                        <span>
                          {(tooltipData.cacheReadTokens / 1000).toFixed(1)}K
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
          fill='url(#agentCostGradient)'
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

AgentCostChart.displayName = 'AgentCostChart'
