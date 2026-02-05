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

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: 'hsl(142, 71%, 45%)',
  telegram: 'hsl(200, 90%, 50%)',
  slack: 'hsl(270, 60%, 55%)',
  discord: 'hsl(235, 85%, 65%)',
}

function getChannelColor(name: string): string {
  const lowerName = name.toLowerCase()
  for (const [key, color] of Object.entries(CHANNEL_COLORS)) {
    if (lowerName.includes(key)) return color
  }
  return 'hsl(var(--primary))'
}

export function ChannelComparisonChart({
  channels,
}: ChannelComparisonChartProps) {
  const chartData = channels
    .filter((channel) => channel.total_cost > 0 || channel.message_count > 0)
    .sort((a, b) => b.total_cost - a.total_cost)
    .map((channel) => ({
      name: channel.name,
      cost: channel.total_cost,
      messages: channel.message_count,
      inputTokens: channel.total_input_tokens,
      outputTokens: channel.total_output_tokens,
      color: getChannelColor(channel.name),
    }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-muted-foreground text-center px-4'>
        No data available yet. Channel costs will be displayed here once
        messages have been processed.
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={300}>
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
          stroke='hsl(var(--muted-foreground))'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const tooltipData = payload[0].payload as (typeof chartData)[0]
              return (
                <div className='rounded-lg border bg-background p-3 shadow-md min-w-[180px]'>
                  <div className='mb-2 font-medium text-sm'>
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
        <Bar dataKey='cost' radius={[0, 4, 4, 0]} maxBarSize={40}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

ChannelComparisonChart.displayName = 'ChannelComparisonChart'
