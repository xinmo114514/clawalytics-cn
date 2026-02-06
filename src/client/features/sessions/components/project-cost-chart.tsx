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
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ProjectBreakdown } from '@/lib/api'

interface ProjectCostChartProps {
  data: ProjectBreakdown[]
  activeProject: string | undefined
  onProjectClick: (project: string) => void
}

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
  const colorIndex = Math.min(
    Math.floor((index / total) * BAR_COLORS.length),
    BAR_COLORS.length - 1
  )
  return BAR_COLORS[colorIndex]
}

function formatProjectName(path: string): string {
  const parts = path.split('-')
  return (parts[parts.length - 1] || path).toUpperCase()
}

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

export function ProjectCostChart({
  data,
  activeProject,
  onProjectClick,
}: ProjectCostChartProps) {
  const chartData = data
    .filter((p) => p.totalCost > 0 || p.sessionCount > 0)
    .map((p) => ({
      name: formatProjectName(p.project),
      project: p.project,
      cost: p.totalCost,
      sessions: p.sessionCount,
      inputTokens: p.totalInputTokens,
      outputTokens: p.totalOutputTokens,
    }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[200px] items-center justify-center text-muted-foreground text-center px-4'>
        No project data available yet.
      </div>
    )
  }

  const chartHeight = Math.max(200, chartData.length * 28 + 40)

  return (
    <div>
      {activeProject && (
        <div className='mb-3 flex items-center gap-2'>
          <span className='text-sm text-muted-foreground'>Filtered by:</span>
          <Badge
            variant='secondary'
            className='cursor-pointer gap-1'
            onClick={() => onProjectClick(activeProject)}
          >
            {formatProjectName(activeProject)}
            <X className='h-3 w-3' />
          </Badge>
        </div>
      )}
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
                const d = payload[0].payload as (typeof chartData)[0]
                return (
                  <div className='rounded-lg border bg-background p-3 shadow-md min-w-[180px]'>
                    <div className='mb-2 font-jersey text-base'>{d.name}</div>
                    <div className='space-y-1.5'>
                      <div className='flex items-center justify-between gap-4'>
                        <span className='text-xs text-muted-foreground'>Cost</span>
                        <span className='font-mono font-medium text-sm'>
                          ${d.cost.toFixed(4)}
                        </span>
                      </div>
                      <div className='flex items-center justify-between gap-4'>
                        <span className='text-xs text-muted-foreground'>Sessions</span>
                        <span className='font-mono font-medium text-sm'>
                          {d.sessions.toLocaleString('en-US')}
                        </span>
                      </div>
                      <div className='flex items-center justify-between gap-4 text-xs text-muted-foreground border-t pt-1.5'>
                        <span>{(d.inputTokens / 1000).toFixed(1)}K in</span>
                        <span>{(d.outputTokens / 1000).toFixed(1)}K out</span>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar
            dataKey='cost'
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            cursor='pointer'
            onClick={(_entry, index) => {
              if (typeof index === 'number' && chartData[index]) {
                onProjectClick(chartData[index].project)
              }
            }}
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBarColor(index, chartData.length)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
