import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import type { ProviderSummary } from '@/lib/api'

interface ProviderDistributionChartProps {
  providers: ProviderSummary[]
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
]

export function ProviderDistributionChart({
  providers,
}: ProviderDistributionChartProps) {
  const totalCost = providers.reduce((acc, p) => acc + p.totalCost, 0)

  const chartData = providers
    .filter((p) => p.totalCost > 0)
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 6)
    .map((provider, idx) => ({
      name: provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1),
      value: provider.totalCost,
      percentage: totalCost > 0 ? (provider.totalCost / totalCost) * 100 : 0,
      fill: COLORS[idx % COLORS.length],
      modelCount: provider.modelCount,
      requestCount: provider.requestCount,
      inputTokens: provider.totalInputTokens,
      outputTokens: provider.totalOutputTokens,
    }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-muted-foreground text-center px-4'>
        No data available yet. The distribution will be displayed here once
        models are used.
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
              const tooltipData = payload[0].payload as (typeof chartData)[0]
              return (
                <div className='rounded-lg border bg-background p-3 shadow-md min-w-[180px]'>
                  <div className='mb-2 font-medium text-sm truncate max-w-[200px]'>
                    {tooltipData.name}
                  </div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Cost
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        ${tooltipData.value.toFixed(4)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Share
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {tooltipData.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Models
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {tooltipData.modelCount}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-4'>
                      <span className='text-xs text-muted-foreground'>
                        Requests
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {tooltipData.requestCount}
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

ProviderDistributionChart.displayName = 'ProviderDistributionChart'
