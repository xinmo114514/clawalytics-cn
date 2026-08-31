import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { getSessionRequests, type SessionRequest } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useCurrency } from '@/context/currency-provider'
import { useLocale } from '@/context/locale-provider'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

function toFiniteNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getModelShortName(
  model: string | undefined,
  fallback: string
): string {
  if (!model?.trim()) return fallback
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
    const model = r.model?.trim() || 'unknown'
    const existing = map.get(model)
    if (existing) {
      existing.cost += toFiniteNumber(r.cost)
      existing.count += toFiniteNumber(r.api_call_count) || 1
      existing.inputTokens += toFiniteNumber(r.input_tokens)
      existing.outputTokens += toFiniteNumber(r.output_tokens)
      existing.cacheReadTokens += toFiniteNumber(r.cache_read_tokens)
    } else {
      map.set(model, {
        model,
        cost: toFiniteNumber(r.cost),
        count: toFiniteNumber(r.api_call_count) || 1,
        inputTokens: toFiniteNumber(r.input_tokens),
        outputTokens: toFiniteNumber(r.output_tokens),
        cacheReadTokens: toFiniteNumber(r.cache_read_tokens),
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost)
}

function formatRequestTime(timestamp: string): string {
  const value = new Date(timestamp)
  if (Number.isNaN(value.getTime())) return '--:--:--'
  return format(value, 'HH:mm:ss')
}

export function SessionDetailRow({ sessionId }: SessionDetailRowProps) {
  const { text } = useLocale()
  const { formatCurrency } = useCurrency()
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
      <div className='p-4 text-center text-sm text-muted-foreground'>
        {text(
          '当前会话暂无请求数据。',
          'No request data available for this session.'
        )}
      </div>
    )
  }

  const models = aggregateByModel(requests)
  const totalCacheRead = requests.reduce(
    (acc, r) => acc + toFiniteNumber(r.cache_read_tokens),
    0
  )
  const totalInputTokens = requests.reduce(
    (acc, r) => acc + toFiniteNumber(r.input_tokens),
    0
  )
  const cacheHitPercent =
    totalInputTokens > 0
      ? ((totalCacheRead / (totalInputTokens + totalCacheRead)) * 100).toFixed(
          1
        )
      : '0'
  const unknownModelLabel = text('未知模型', 'Unknown')
  const containsAggregateData = requests.some(
    (request) => request.usage_granularity === 'aggregate'
  )
  const totalApiCalls = requests.reduce(
    (total, request) => total + (toFiniteNumber(request.api_call_count) || 1),
    0
  )

  return (
    <div className='space-y-4 p-4'>
      {containsAggregateData && (
        <div className='rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-sm'>
          <div className='font-medium text-violet-700 dark:text-violet-300'>
            {text('Hermes 聚合用量', 'Hermes aggregate usage')}
          </div>
          <p className='mt-1 text-xs leading-5 text-muted-foreground'>
            {text(
              `以下 ${totalApiCalls} 次调用按模型聚合，时间归到每条记录的最后更新时间。`,
              `${totalApiCalls} calls are grouped by model; dates use each record's last-seen time.`
            )}
          </p>
        </div>
      )}
      {/* Model breakdown */}
      <div>
        <h4 className='mb-2 text-sm font-medium'>
          {text('模型拆分', 'Model Breakdown')}
        </h4>
        <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
          {models.map((m) => (
            <div key={m.model} className='space-y-1 rounded-lg border p-3'>
              <div className='flex items-center justify-between'>
                <Badge variant='outline' className='text-xs'>
                  {getModelShortName(m.model, unknownModelLabel)}
                </Badge>
                <span className='font-mono text-sm font-medium text-primary'>
                  {formatCurrency(m.cost)}
                </span>
              </div>
              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <span>
                  {m.count} {text('次请求', 'requests')}
                </span>
                <span>
                  {text('输入', 'In')} {formatNumber(m.inputTokens)} /{' '}
                  {text('输出', 'Out')} {formatNumber(m.outputTokens)}
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
              {text('缓存效率', 'Cache Efficiency')}
            </span>
            <span className='font-mono text-sm font-medium text-emerald-700 dark:text-emerald-400'>
              {text(
                `命中率 ${cacheHitPercent}%`,
                `${cacheHitPercent}% hit rate`
              )}
            </span>
          </div>
          <p className='mt-1 text-xs text-muted-foreground'>
            {text(
              `从缓存中读取了 ${formatNumber(totalCacheRead)} 个 Token`,
              `${formatNumber(totalCacheRead)} tokens read from cache`
            )}
          </p>
        </div>
      )}

      {/* Request timeline */}
      <div>
        <h4 className='mb-2 text-sm font-medium'>
          {text(
            containsAggregateData
              ? `聚合记录（${requests.length}）`
              : `请求时间线（${requests.length}）`,
            containsAggregateData
              ? `Aggregate Records (${requests.length})`
              : `Request Timeline (${requests.length})`
          )}
        </h4>
        <div className='max-h-[300px] overflow-y-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='text-xs'>
                  {text('时间', 'Time')}
                </TableHead>
                <TableHead className='text-xs'>
                  {text('模型', 'Model')}
                </TableHead>
                <TableHead className='text-right text-xs'>
                  {text('输入', 'Input')}
                </TableHead>
                <TableHead className='text-right text-xs'>
                  {text('输出', 'Output')}
                </TableHead>
                <TableHead className='hidden text-right text-xs sm:table-cell'>
                  {text('缓存', 'Cache')}
                </TableHead>
                <TableHead className='text-right text-xs'>
                  {text('成本', 'Cost')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r, i) => (
                <TableRow key={r.id ?? i} className='text-xs'>
                  <TableCell className='py-1.5 font-mono'>
                    {formatRequestTime(r.timestamp)}
                  </TableCell>
                  <TableCell className='py-1.5'>
                    {getModelShortName(r.model, unknownModelLabel)}
                  </TableCell>
                  <TableCell className='py-1.5 text-right font-mono'>
                    {formatNumber(toFiniteNumber(r.input_tokens))}
                  </TableCell>
                  <TableCell className='py-1.5 text-right font-mono'>
                    {formatNumber(toFiniteNumber(r.output_tokens))}
                  </TableCell>
                  <TableCell className='hidden py-1.5 text-right font-mono sm:table-cell'>
                    {toFiniteNumber(r.cache_read_tokens) > 0
                      ? formatNumber(toFiniteNumber(r.cache_read_tokens))
                      : '-'}
                  </TableCell>
                  <TableCell className='py-1.5 text-right font-mono'>
                    {formatCurrency(toFiniteNumber(r.cost))}
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
