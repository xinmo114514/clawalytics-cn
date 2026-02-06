import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { ModelUsage } from '@/lib/api'

interface ModelUsageChartProps {
  data: ModelUsage[]
}

// Red/rose-focused color palette matching Clawalytics branding
const COLORS = [
  '#dc2626', // Red 600
  '#2563eb', // Blue 600
  '#d946ef', // Fuchsia 500
  '#f59e0b', // Amber 500
  '#10b981', // Emerald 500
  '#8b5cf6', // Violet 500
  '#f43f5e', // Rose 500
  '#06b6d4', // Cyan 500
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
  const lastSegment = model.split('/').pop() || model
  return lastSegment.length > 12 ? lastSegment.substring(0, 12) : lastSegment
}

interface TreemapContentProps {
  x: number
  y: number
  width: number
  height: number
  name: string
  percentage: number
  fill: string
}

function CustomTreemapContent({ x, y, width, height, name, percentage, fill }: TreemapContentProps) {
  const showLabel = width > 40 && height > 30

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke='hsl(var(--background))'
        strokeWidth={3}
        rx={4}
        className='hover:opacity-80 transition-opacity cursor-pointer'
      />
      {showLabel && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - (height > 50 ? 6 : 0)}
            textAnchor='middle'
            dominantBaseline='central'
            fill='white'
            fontSize={width > 80 ? 13 : 11}
            fontWeight={600}
          >
            {name}
          </text>
          {height > 50 && width > 55 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 14}
              textAnchor='middle'
              dominantBaseline='central'
              fill='rgba(255,255,255,0.8)'
              fontSize={11}
            >
              {percentage.toFixed(1)}%
            </text>
          )}
        </>
      )}
    </g>
  )
}

export function ModelUsageChart({ data }: ModelUsageChartProps) {
  const totalCost = data.reduce((acc, item) => acc + item.cost, 0)

  const chartData = data
    .filter((item) => item.cost > 0)
    .slice(0, 8)
    .map((item, idx) => ({
      name: getModelShortName(item.model),
      fullName: `${item.provider}/${item.model}`,
      size: item.cost,
      percentage: totalCost > 0 ? (item.cost / totalCost) * 100 : 0,
      fill: COLORS[idx % COLORS.length],
      requests: item.request_count,
      inputTokens: item.input_tokens,
      outputTokens: item.output_tokens,
    }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-muted-foreground text-center px-4'>
        No data yet. Start using Claude Code to see your model usage here.
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={300}>
      <Treemap
        data={chartData}
        dataKey='size'
        aspectRatio={4 / 3}
        content={<CustomTreemapContent x={0} y={0} width={0} height={0} name='' percentage={0} fill='' />}
      >
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload as (typeof chartData)[0]
              return (
                <div className='rounded-lg border bg-background p-3 shadow-md min-w-[180px]'>
                  <div className='mb-2 font-medium text-sm truncate max-w-[200px] flex items-center gap-2'>
                    <span
                      className='h-3 w-3 rounded shrink-0'
                      style={{ backgroundColor: data.fill }}
                    />
                    {data.fullName}
                  </div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Cost
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        ${data.size.toFixed(4)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Share
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
      </Treemap>
    </ResponsiveContainer>
  )
}
