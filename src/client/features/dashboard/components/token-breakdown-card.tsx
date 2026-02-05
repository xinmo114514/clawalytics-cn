import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { TokenBreakdown } from '@/lib/api'

interface TokenBreakdownCardProps {
  data: TokenBreakdown | undefined
}

interface TokenBarItem {
  label: string
  value: number
  percentage: number
  color: string
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}

export function TokenBreakdownCard({ data }: TokenBreakdownCardProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token-Aufteilung</CardTitle>
          <CardDescription>Letzte 30 Tage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex h-[200px] items-center justify-center text-muted-foreground'>
            Lade Daten...
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = data.input + data.output + data.cacheRead + data.cacheCreation

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token-Aufteilung</CardTitle>
          <CardDescription>Letzte 30 Tage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex h-[200px] items-center justify-center text-muted-foreground text-center px-4'>
            Noch keine Daten vorhanden. Starte OpenClaw, um hier deine Token-Nutzung zu sehen.
          </div>
        </CardContent>
      </Card>
    )
  }

  const items: TokenBarItem[] = [
    {
      label: 'Input',
      value: data.input,
      percentage: (data.input / total) * 100,
      color: 'bg-chart-1',
    },
    {
      label: 'Output',
      value: data.output,
      percentage: (data.output / total) * 100,
      color: 'bg-chart-2',
    },
    {
      label: 'Cache (read)',
      value: data.cacheRead,
      percentage: (data.cacheRead / total) * 100,
      color: 'bg-chart-3',
    },
    {
      label: 'Cache (write)',
      value: data.cacheCreation,
      percentage: (data.cacheCreation / total) * 100,
      color: 'bg-chart-4',
    },
  ].filter((item) => item.value > 0) // Only show items with values

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token-Aufteilung</CardTitle>
        <CardDescription>
          Letzte 30 Tage - {formatTokenCount(total)} Tokens gesamt
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Stacked horizontal bar */}
        <div className='space-y-2'>
          <div className='flex h-8 w-full overflow-hidden rounded-full'>
            {items.map((item, idx) => (
              <div
                key={idx}
                className={`${item.color} transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${item.percentage}%` }}
                title={`${item.label}: ${formatTokenCount(item.value)} (${item.percentage.toFixed(1)}%)`}
              />
            ))}
          </div>
        </div>

        {/* Legend with details */}
        <div className='grid grid-cols-2 gap-4'>
          {items.map((item, idx) => (
            <div key={idx} className='flex items-center gap-3'>
              <div className={`h-3 w-3 rounded-full ${item.color} shrink-0`} />
              <div className='min-w-0 flex-1'>
                <div className='flex items-baseline justify-between gap-2'>
                  <span className='text-sm font-medium truncate'>
                    {item.label}
                  </span>
                  <span className='text-sm text-muted-foreground tabular-nums shrink-0'>
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className='text-xs text-muted-foreground font-mono'>
                  {formatTokenCount(item.value)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Individual progress bars */}
        <div className='space-y-3 pt-2 border-t'>
          {items.map((item, idx) => (
            <div key={idx} className='space-y-1.5'>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>{item.label}</span>
                <span className='font-mono text-muted-foreground'>
                  {formatTokenCount(item.value)}
                </span>
              </div>
              <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
                <div
                  className={`h-full ${item.color} transition-all duration-500`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
