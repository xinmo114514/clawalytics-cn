import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import type { Agent } from '@/lib/api'

interface AgentDistributionChartProps {
  agents: Agent[]
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
]

export function AgentDistributionChart({
  agents,
}: AgentDistributionChartProps) {
  const totalCost = agents.reduce((acc, agent) => acc + agent.total_cost, 0)

  const chartData = agents
    .filter((agent) => agent.total_cost > 0)
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 6)
    .map((agent, idx) => ({
      name: agent.name,
      value: agent.total_cost,
      percentage: totalCost > 0 ? (agent.total_cost / totalCost) * 100 : 0,
      fill: COLORS[idx % COLORS.length],
      sessions: agent.session_count,
      inputTokens: agent.total_input_tokens,
      outputTokens: agent.total_output_tokens,
    }))

  if (chartData.length === 0) {
    return (
      <div className='flex h-[300px] items-center justify-center text-muted-foreground text-center px-4'>
        No data available yet. The distribution will be displayed here once
        agents are active.
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
                        Sessions
                      </span>
                      <span className='font-mono font-medium text-sm'>
                        {tooltipData.sessions}
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

AgentDistributionChart.displayName = 'AgentDistributionChart'
