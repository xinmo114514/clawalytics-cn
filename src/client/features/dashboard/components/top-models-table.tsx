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
import type { ModelUsage } from '@/lib/api'

interface TopModelsTableProps {
  models: ModelUsage[]
}

export function TopModelsTable({ models }: TopModelsTableProps) {
  const { text } = useLocale()

  const formatCurrency = (value: number): string => {
    if (value >= 100) return `$${value.toFixed(0)}`
    if (value >= 10) return `$${value.toFixed(1)}`
    if (value >= 1) return `$${value.toFixed(2)}`
    if (value >= 0.01) return `$${value.toFixed(2)}`
    return `$${value.toFixed(4)}`
  }

  const formatNumber = (value: number): string => {
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
      deepseek:
        'bg-chart-4/10 text-chart-4',
    }
    return (
      colors[provider.toLowerCase()] ||
      'bg-muted/10 text-muted-foreground'
    )
  }

  const topModels = [...models].sort((a, b) => b.cost - a.cost).slice(0, 5)

  if (topModels.length === 0) {
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{text('模型', 'Model')}</TableHead>
          <TableHead>{text('提供商', 'Provider')}</TableHead>
          <TableHead className='text-right'>{text('Tokens', 'Tokens')}</TableHead>
          <TableHead className='text-right'>{text('成本', 'Cost')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {topModels.map((model, idx) => (
          <TableRow key={`${model.provider}-${model.model}-${idx}`}>
            <TableCell className='max-w-[180px] truncate font-medium'>
              {model.model}
            </TableCell>
            <TableCell>
              <Badge variant='outline' className={getProviderColor(model.provider)}>
                {model.provider}
              </Badge>
            </TableCell>
            <TableCell className='text-right tabular-nums text-muted-foreground'>
              {formatNumber(model.input_tokens + model.output_tokens)}
            </TableCell>
            <TableCell className='text-right tabular-nums font-medium text-primary'>
              {formatCurrency(model.cost)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

TopModelsTable.displayName = 'TopModelsTable'
