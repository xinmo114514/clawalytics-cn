import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { ModelUsage } from '@/lib/api'

interface ModelUsageChartProps {
  data: ModelUsage[]
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
]

function getModelShortName(model: string): string {
  if (model.includes('claude-opus-4')) return 'Opus 4'
  if (model.includes('claude-opus')) return 'Opus'
  if (model.includes('claude-sonnet-4')) return 'Sonnet 4'
  if (model.includes('claude-sonnet')) return 'Sonnet'
  if (model.includes('claude-haiku')) return 'Haiku'
  if (model.includes('gpt-4o-mini')) return '4o-mini'
  if (model.includes('gpt-4o')) return 'GPT-4o'
  if (model.includes('gpt-4')) return 'GPT-4'
  if (model.includes('gemini')) return 'Gemini'
  if (model.includes('deepseek')) return 'DeepSeek'
  // Return last segment or first 12 chars
  const lastSegment = model.split('/').pop() || model
  return lastSegment.length > 12 ? lastSegment.substring(0, 12) : lastSegment
}

export function ModelUsageChart({ data }: ModelUsageChartProps) {
  const totalCost = data.reduce((acc, item) => acc + item.cost, 0)

  const chartData = data
    .filter((item) => item.cost > 0)
    .slice(0, 6) // Limit to top 6 models
    .map((item, idx) => ({
      name: getModelShortName(item.model),
      fullName: `${item.provider}/${item.model}`,
      value: item.cost,
      percentage: totalCost > 0 ? (item.cost / totalCost) * 100 : 0,
      fill: COLORS[idx % COLORS.length],
      requests: item.request_count,
      inputTokens: item.input_tokens,
      outputTokens: item.output_tokens,
    }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-muted-foreground text-center px-4'>
        Noch keine Daten vorhanden. Starte OpenClaw, um hier deine Modell-Nutzung zu sehen.
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx='50%'
          cy='45%'
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          dataKey='value'
          nameKey='name'
          strokeWidth={2}
          stroke='hsl(var(--background))'
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload as (typeof chartData)[0]
              return (
                <div className='rounded-lg border bg-background p-3 shadow-md min-w-[180px]'>
                  <div className='mb-2 font-medium text-sm truncate max-w-[200px]'>
                    {data.fullName}
                  </div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Kosten
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        ${data.value.toFixed(4)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Anteil
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {data.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Requests
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {data.requests}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4 text-xs text-muted-foreground border-t pt-1.5'>
                      <span>
                        {(data.inputTokens / 1000).toFixed(1)}K in
                      </span>
                      <span>
                        {(data.outputTokens / 1000).toFixed(1)}K out
                      </span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          }}
        />
        <Legend
          verticalAlign='bottom'
          height={36}
          iconType='circle'
          iconSize={8}
          formatter={(value: string) => (
            <span className='text-xs text-muted-foreground'>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
