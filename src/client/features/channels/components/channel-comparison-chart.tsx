import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts'
import type { Channel } from '@/lib/api'

interface ChannelComparisonChartProps {
  channels: Channel[]
}

// Red gradient colors for bars (darker to lighter)
const BAR_COLORS = [
  '#7f1d1d', // Red 900
  '#991b1b', // Red 800
  '#b91c1c', // Red 700
  '#dc2626', // Red 600
  '#ef4444', // Red 500
  '#f87171', // Red 400
  '#fca5a5', // Red 300
  '#fecaca', // Red 200
  '#fee2e2', // Red 100
  '#fef2f2', // Red 50
]

function getBarColor(index: number, total: number): string {
  // Map index to color array, spreading evenly across available colors
  const colorIndex = Math.min(
    Math.floor((index / total) * BAR_COLORS.length),
    BAR_COLORS.length - 1
  )
  return BAR_COLORS[colorIndex]
}

// Custom tick component for Jersey font
interface CustomTickProps {
  x?: number | string
  y?: number | string
  payload?: { value: string }
}

function CustomYAxisTick({ x, y, payload }: CustomTickProps) {
  if (!payload) return null
  return (
    <text
      x={Number(x)}
      y={Number(y)}
      dy={4}
      textAnchor='end'
      fill='hsl(var(--foreground))'
      style={{ fontFamily: '"Jersey 10", sans-serif', fontSize: '14px' }}
    >
      {payload.value}
    </text>
  )
}

export function ChannelComparisonChart({
  channels,
}: ChannelComparisonChartProps) {
  const chartData = channels
    .filter((channel) => channel.total_cost > 0 || channel.message_count > 0)
    .sort((a, b) => b.total_cost - a.total_cost)
    .map((channel) => ({
      name: channel.name.toUpperCase(),
      cost: channel.total_cost,
      messages: channel.message_count,
      inputTokens: channel.total_input_tokens,
      outputTokens: channel.total_output_tokens,
    }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-muted-foreground text-center px-4'>
        No data available yet. Channel costs will be displayed here once
        messages have been processed.
      </div>
    )
  }

  // Dynamic height: 28px per channel, min 200px
  const chartHeight = Math.max(200, chartData.length * 28 + 40)

  return (
    <ResponsiveContainer width='100%' height={chartHeight}>
      <BarChart
        data={chartData}
        layout='vertical'
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray='3 3'
          horizontal={true}
          vertical={false}
          stroke='hsl(var(--border))'
        />
        <XAxis
          type='number'
          stroke='hsl(var(--muted-foreground))'
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `$${value.toFixed(2)}`}
        />
        <YAxis
          type='category'
          dataKey='name'
          tickLine={false}
          axisLine={false}
          width={130}
          interval={0}
          tick={CustomYAxisTick}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const tooltipData = payload[0].payload as (typeof chartData)[0]
              return (
                <div className='rounded-lg border bg-background p-3 shadow-md min-w-[180px]'>
                  <div className='mb-2 font-jersey text-base'>
                    {tooltipData.name}
                  </div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Cost
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        ${tooltipData.cost.toFixed(4)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Messages
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {tooltipData.messages.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4 text-xs text-muted-foreground border-t pt-1.5'>
                      <span>
                        {(tooltipData.inputTokens / 1000).toFixed(1)}K in
                      </span>
                      <span>
                        {(tooltipData.outputTokens / 1000).toFixed(1)}K out
                      </span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Bar dataKey='cost' radius={[0, 4, 4, 0]} maxBarSize={22}>
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getBarColor(index, chartData.length)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

ChannelComparisonChart.displayName = 'ChannelComparisonChart'
