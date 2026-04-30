import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLocale } from '@/context/locale-provider'
import { useCurrency } from '@/context/currency-provider'
import type { ModelUsageItem } from '@/lib/api'

interface ModelsTableProps {
  models: ModelUsageItem[]
}

export function ModelsTable({ models }: ModelsTableProps) {
  const { text } = useLocale()
  const { formatCurrency } = useCurrency()

  const formatNumber = (value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toString()
  }

  const getProviderColor = (provider: string): string => {
    const colors: Record<string, string> = {
      anthropic:
        'bg-warning/10 text-warning',
      openai:
        'bg-success/10 text-success',
      google:
        'bg-info/10 text-info',
      moonshot:
        'bg-chart-3/10 text-chart-3',
      minimax:
        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      'minimax-portal':
        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      qwen:
        'bg-orange-500/10 text-orange-600 dark:text-orange-300',
      'qwen-portal':
        'bg-orange-500/10 text-orange-600 dark:text-orange-300',
      dashscope:
        'bg-orange-500/10 text-orange-600 dark:text-orange-300',
      doubao:
        'bg-rose-500/10 text-rose-600 dark:text-rose-300',
      volcengine:
        'bg-rose-500/10 text-rose-600 dark:text-rose-300',
      ark:
        'bg-rose-500/10 text-rose-600 dark:text-rose-300',
      deepseek:
        'bg-chart-4/10 text-chart-4',
      zhipu:
        'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
      bigmodel:
        'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
      openrouter:
        'bg-chart-5/10 text-chart-5',
      meta:
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      mistral:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    }

    return (
      colors[provider.toLowerCase()] ||
      'bg-muted/10 text-muted-foreground'
    )
  }

  if (models.length === 0) {
    return (
      <div className='py-8 text-center text-muted-foreground'>
        {text(
          '还没有模型使用数据。开始使用 OpenClaw 后，这里会显示模型分析。',
          'No model usage yet. Start using OpenClaw to see model analytics.'
        )}
      </div>
    )
  }

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{text('模型', 'Model')}</TableHead>
            <TableHead>{text('提供商', 'Provider')}</TableHead>
            <TableHead className='text-right'>
              {text('输入 Token', 'Input Tokens')}
            </TableHead>
            <TableHead className='text-right'>
              {text('输出 Token', 'Output Tokens')}
            </TableHead>
            <TableHead className='text-right'>{text('请求数', 'Requests')}</TableHead>
            <TableHead className='text-right'>{text('成本', 'Cost')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model, idx) => (
            <TableRow key={`${model.provider}-${model.model}-${idx}`}>
              <TableCell className='font-medium'>{model.model}</TableCell>
              <TableCell>
                <Badge variant='outline' className={getProviderColor(model.provider)}>
                  {model.provider}
                </Badge>
              </TableCell>
              <TableCell className='text-right tabular-nums'>
                {formatNumber(model.inputTokens)}
              </TableCell>
              <TableCell className='text-right tabular-nums'>
                {formatNumber(model.outputTokens)}
              </TableCell>
              <TableCell className='text-right tabular-nums'>
                {formatNumber(model.requestCount)}
              </TableCell>
              <TableCell className='text-right tabular-nums font-medium text-primary'>
                {formatCurrency(model.cost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
