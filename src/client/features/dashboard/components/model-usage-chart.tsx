import { useMemo } from 'react'
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts'
import type { ModelUsage } from '@/lib/api'
import { useCurrency } from '@/context/currency-provider'
import { useLocale } from '@/context/locale-provider'
import { useChartColors } from '@/hooks/use-chart-colors'

interface ModelUsageChartProps {
  data: ModelUsage[]
}

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

const DEFAULT_COLORS = [
  'oklch(0.646 0.222 41.116)',
  'oklch(0.6 0.118 184.704)',
  'oklch(0.398 0.07 227.392)',
  'oklch(0.828 0.189 84.429)',
  'oklch(0.769 0.188 70.08)',
  'oklch(0.488 0.243 264.376)',
]

interface TreemapContentProps {
  x: number
  y: number
  width: number
  height: number
  name: string
  percentage: number
  fill: string
}

const LABEL_HORIZONTAL_PADDING = 8
const MIN_LABEL_CHARACTERS = 4
const ELLIPSIS = '…'

function getApproximateTextWidth(value: string, fontSize: number): number {
  return [...value].reduce(
    (width, character) =>
      width + (character.charCodeAt(0) > 255 ? fontSize : fontSize * 0.58),
    0
  )
}

function truncateLabel(
  value: string,
  availableWidth: number,
  fontSize: number
): string {
  if (getApproximateTextWidth(value, fontSize) <= availableWidth) {
    return value
  }

  let visible = ''
  for (const character of value) {
    const candidate = `${visible}${character}${ELLIPSIS}`
    if (getApproximateTextWidth(candidate, fontSize) > availableWidth) {
      break
    }
    visible += character
  }

  return visible.length >= MIN_LABEL_CHARACTERS ? `${visible}${ELLIPSIS}` : ''
}

function CustomTreemapContent({
  x,
  y,
  width,
  height,
  name,
  percentage,
  fill,
}: TreemapContentProps) {
  const nameFontSize = width > 80 ? 13 : 11
  const availableTextWidth = Math.max(0, width - LABEL_HORIZONTAL_PADDING * 2)
  const displayName = truncateLabel(name, availableTextWidth, nameFontSize)
  const displayPercentage = `${percentage.toFixed(1)}%`
  const canShowPercentage =
    height >= 28 &&
    getApproximateTextWidth(displayPercentage, 11) <= availableTextWidth
  const hasName = height > 30 && displayName.length > 0
  const showTwoLines = hasName && canShowPercentage && height > 50
  const showName = hasName && (!canShowPercentage || height > 50)
  const showPercentage =
    canShowPercentage && (showTwoLines || !hasName || height <= 50)
  const clipId = `treemap-cell-${Math.round(x)}-${Math.round(y)}-${Math.round(width)}-${Math.round(height)}`

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={x + 2}
            y={y + 2}
            width={Math.max(0, width - 4)}
            height={Math.max(0, height - 4)}
          />
        </clipPath>
      </defs>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke='hsl(var(--background))'
        strokeWidth={3}
        className='cursor-pointer transition-opacity hover:opacity-80'
      />
      {(showName || showPercentage) && (
        <g clipPath={`url(#${clipId})`}>
          {showName && (
            <text
              x={x + width / 2}
              y={y + height / 2 - (showTwoLines ? 6 : 0)}
              textAnchor='middle'
              dominantBaseline='central'
              fill='white'
              fontSize={nameFontSize}
              fontWeight={600}
            >
              {displayName}
            </text>
          )}
          {showPercentage && (
            <text
              x={x + width / 2}
              y={y + height / 2 + (showTwoLines ? 14 : 0)}
              textAnchor='middle'
              dominantBaseline='central'
              fill='rgba(255,255,255,0.8)'
              fontSize={11}
            >
              {displayPercentage}
            </text>
          )}
        </g>
      )}
    </g>
  )
}

export function ModelUsageChart({ data }: ModelUsageChartProps) {
  const { text } = useLocale()
  const { formatCurrencyPrecise } = useCurrency()
  const colors = useChartColors()
  const totalCost = useMemo(
    () => data.reduce((acc, item) => acc + item.cost, 0),
    [data]
  )

  const chartColors = useMemo(
    () => [
      colors.chart1 || DEFAULT_COLORS[0],
      colors.chart2 || DEFAULT_COLORS[1],
      colors.chart3 || DEFAULT_COLORS[2],
      colors.chart4 || DEFAULT_COLORS[3],
      colors.chart5 || DEFAULT_COLORS[4],
      colors.primary || DEFAULT_COLORS[5],
    ],
    [colors]
  )

  const chartData = useMemo(
    () =>
      data
        .filter((item) => item.cost > 0)
        .slice(0, 8)
        .map((item, idx) => ({
          name: getModelShortName(item.model),
          fullName: `${item.provider}/${item.model}`,
          size: item.cost,
          percentage: totalCost > 0 ? (item.cost / totalCost) * 100 : 0,
          fill: chartColors[idx % chartColors.length],
          requests: item.requestCount,
          inputTokens: item.inputTokens,
          outputTokens: item.outputTokens,
        })),
    [data, totalCost, chartColors]
  )

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center px-4 text-center text-muted-foreground'>
        {text(
          '暂无数据。开始使用 Claude Code 后，这里会显示模型使用情况。',
          'No data yet. Start using Claude Code to see your model usage here.'
        )}
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={300}>
      <Treemap
        isAnimationActive={false}
        data={chartData}
        dataKey='size'
        aspectRatio={4 / 3}
        content={
          <CustomTreemapContent
            x={0}
            y={0}
            width={0}
            height={0}
            name=''
            percentage={0}
            fill=''
          />
        }
      >
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const item = payload[0].payload as (typeof chartData)[0]

              return (
                <div className='min-w-[180px] rounded-lg border bg-background p-3 shadow-md'>
                  <div className='mb-2 flex max-w-[200px] items-center gap-2 truncate text-sm font-medium'>
                    <span
                      className='h-3 w-3 shrink-0 rounded'
                      style={{ backgroundColor: item.fill }}
                    />
                    {item.fullName}
                  </div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        {text('成本', 'Cost')}
                      </span>
                      <span className='font-mono text-sm font-medium'>
                        {formatCurrencyPrecise(item.size)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        {text('占比', 'Share')}
                      </span>
                      <span className='font-mono text-sm font-medium'>
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        {text('请求数', 'Requests')}
                      </span>
                      <span className='font-mono text-sm font-medium'>
                        {item.requests}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4 border-t pt-1.5 text-xs text-muted-foreground'>
                      <span>
                        {(item.inputTokens / 1000).toFixed(1)}K{' '}
                        {text('输入', 'in')}
                      </span>
                      <span>
                        {(item.outputTokens / 1000).toFixed(1)}K{' '}
                        {text('输出', 'out')}
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
