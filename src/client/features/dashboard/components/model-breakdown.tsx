import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { type ModelUsage } from '@/lib/api'

interface ModelBreakdownProps {
  data: ModelUsage[]
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function ModelBreakdown({ data }: ModelBreakdownProps) {
  const totalCost = data.reduce((acc, item) => acc + item.cost, 0)

  const chartData = data.map((item, idx) => ({
    name: `${item.provider}/${item.model}`,
    value: item.cost,
    percentage: totalCost > 0 ? (item.cost / totalCost) * 100 : 0,
    fill: COLORS[idx % COLORS.length],
    ...item,
  }))

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Usage</CardTitle>
          <CardDescription>No data yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex h-[300px] items-center justify-center text-muted-foreground'>
            Start using OpenClaw to see your model usage breakdown.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      <Card>
        <CardHeader>
          <CardTitle>Cost by Model</CardTitle>
          <CardDescription>
            Distribution of spending across models (last 30 days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width='100%' height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx='50%'
                cy='50%'
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey='value'
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className='rounded-lg border bg-background p-2 shadow-sm'>
                        <div className='grid gap-2'>
                          <div className='font-medium'>{data.name}</div>
                          <div className='flex items-center justify-between gap-4'>
                            <span className='text-[0.70rem] uppercase text-muted-foreground'>
                              Cost
                            </span>
                            <span className='font-bold'>
                              ${data.value.toFixed(4)}
                            </span>
                          </div>
                          <div className='flex items-center justify-between gap-4'>
                            <span className='text-[0.70rem] uppercase text-muted-foreground'>
                              Share
                            </span>
                            <span className='font-bold'>
                              {data.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Details</CardTitle>
          <CardDescription>
            Token usage and cost breakdown per model
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {chartData.map((item) => (
            <div key={item.name} className='space-y-2'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div
                    className='h-3 w-3 rounded-full'
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className='text-sm font-medium truncate max-w-[200px]'>
                    {item.model}
                  </span>
                </div>
                <span className='text-sm text-muted-foreground'>
                  ${item.cost.toFixed(4)}
                </span>
              </div>
              <Progress value={item.percentage} className='h-2' />
              <div className='flex justify-between text-xs text-muted-foreground'>
                <span>{item.request_count} requests</span>
                <span>
                  {(item.input_tokens / 1000).toFixed(1)}K in / {(item.output_tokens / 1000).toFixed(1)}K out
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
