import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getSessionRequests, type SessionRequest } from '@/lib/api'
import { formatCurrency, formatNumber } from '@/lib/format'

interface SessionDetailRowProps {
  sessionId: string
}

interface ModelBreakdown {
  model: string
  cost: number
  count: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
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
  return model.split('-')[0]
}

function aggregateByModel(requests: SessionRequest[]): ModelBreakdown[] {
  const map = new Map<string, ModelBreakdown>()
  for (const r of requests) {
    const existing = map.get(r.model)
    if (existing) {
      existing.cost += r.cost
      existing.count += 1
      existing.inputTokens += r.input_tokens
      existing.outputTokens += r.output_tokens
      existing.cacheReadTokens += r.cache_read_tokens
    } else {
      map.set(r.model, {
        model: r.model,
        cost: r.cost,
        count: 1,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheReadTokens: r.cache_read_tokens,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost)
}

export function SessionDetailRow({ sessionId }: SessionDetailRowProps) {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['sessionRequests', sessionId],
    queryFn: () => getSessionRequests(sessionId),
  })

  if (isLoading) {
    return (
      <div className='space-y-3 p-4'>
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-32 w-full' />
      </div>
    )
  }

  if (!requests || requests.length === 0) {
    return (
      <div className='p-4 text-sm text-muted-foreground text-center'>
        No request data available for this session.
      </div>
    )
  }

  const models = aggregateByModel(requests)
  const totalCacheRead = requests.reduce((acc, r) => acc + r.cache_read_tokens, 0)
  const totalInputTokens = requests.reduce((acc, r) => acc + r.input_tokens, 0)
  const cacheHitPercent = totalInputTokens > 0
    ? ((totalCacheRead / (totalInputTokens + totalCacheRead)) * 100).toFixed(1)
    : '0'

  return (
    <div className='space-y-4 p-4'>
      {/* Model breakdown */}
      <div>
        <h4 className='text-sm font-medium mb-2'>Model Breakdown</h4>
        <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
          {models.map((m) => (
            <div
              key={m.model}
              className='rounded-lg border p-3 space-y-1'
            >
              <div className='flex items-center justify-between'>
                <Badge variant='outline' className='text-xs'>
                  {getModelShortName(m.model)}
                </Badge>
                <span className='font-mono text-sm font-medium text-red-600 dark:text-red-400'>
                  {formatCurrency(m.cost)}
                </span>
              </div>
              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <span>{m.count} requests</span>
                <span>
                  {formatNumber(m.inputTokens)} in / {formatNumber(m.outputTokens)} out
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cache efficiency */}
      {totalCacheRead > 0 && (
        <div className='rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-emerald-700 dark:text-emerald-400'>
              Cache Efficiency
            </span>
            <span className='text-sm font-mono font-medium text-emerald-700 dark:text-emerald-400'>
              {cacheHitPercent}% hit rate
            </span>
          </div>
          <p className='text-xs text-muted-foreground mt-1'>
            {formatNumber(totalCacheRead)} tokens read from cache
          </p>
        </div>
      )}

      {/* Request timeline */}
      <div>
        <h4 className='text-sm font-medium mb-2'>Request Timeline ({requests.length})</h4>
        <div className='rounded-md border max-h-[300px] overflow-y-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='text-xs'>Time</TableHead>
                <TableHead className='text-xs'>Model</TableHead>
                <TableHead className='text-xs text-right'>Input</TableHead>
                <TableHead className='text-xs text-right'>Output</TableHead>
                <TableHead className='text-xs text-right hidden sm:table-cell'>Cache</TableHead>
                <TableHead className='text-xs text-right'>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r, i) => (
                <TableRow key={r.id ?? i} className='text-xs'>
                  <TableCell className='py-1.5 font-mono'>
                    {format(new Date(r.timestamp), 'HH:mm:ss')}
                  </TableCell>
                  <TableCell className='py-1.5'>
                    {getModelShortName(r.model)}
                  </TableCell>
                  <TableCell className='py-1.5 text-right font-mono'>
                    {formatNumber(r.input_tokens)}
                  </TableCell>
                  <TableCell className='py-1.5 text-right font-mono'>
                    {formatNumber(r.output_tokens)}
                  </TableCell>
                  <TableCell className='py-1.5 text-right font-mono hidden sm:table-cell'>
                    {r.cache_read_tokens > 0 ? formatNumber(r.cache_read_tokens) : '-'}
                  </TableCell>
                  <TableCell className='py-1.5 text-right font-mono'>
                    {formatCurrency(r.cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
