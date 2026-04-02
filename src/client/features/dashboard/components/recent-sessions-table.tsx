import { differenceInHours, differenceInMinutes } from 'date-fns'
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
import type { Session } from '@/lib/api'
import { formatDurationCompact, formatRelativeTime } from '@/lib/i18n'

interface RecentSessionsTableProps {
  sessions: Session[]
}

function formatProjectPath(path: string): string {
  const parts = path.split('-')
  return parts[parts.length - 1] || path
}

function getProjectInitials(path: string): string {
  const name = formatProjectPath(path)
  return name.substring(0, 2).toUpperCase()
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

function formatDuration(
  startedAt: string,
  lastActivity: string,
  locale: 'zh' | 'en'
): string {
  const start = new Date(startedAt)
  const end = new Date(lastActivity)
  const hours = differenceInHours(end, start)
  const minutes = differenceInMinutes(end, start) % 60

  return formatDurationCompact(hours, minutes, locale)
}

function formatTokens(input: number, output: number): string {
  const total = input + output
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K`
  return total.toString()
}

function formatCurrency(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.01) return `$${value.toFixed(2)}`
  return `$${value.toFixed(4)}`
}

function getModelBadgeClass(model: string): string {
  if (model.includes('opus')) return 'border-primary/50 text-primary'
  if (model.includes('sonnet')) return 'border-chart-1/50 text-chart-1'
  if (model.includes('haiku')) return 'border-chart-5/50 text-chart-5'
  if (model.includes('gpt')) return 'border-chart-4/50 text-chart-4'
  return 'border-muted-foreground/50'
}

export function RecentSessionsTable({ sessions }: RecentSessionsTableProps) {
  const { locale, text } = useLocale()

  if (sessions.length === 0) {
    return (
      <div className='flex h-[200px] items-center justify-center text-center text-muted-foreground'>
        {text(
          '暂无会话。开始使用 Claude Code 后，这里会显示会话记录。',
          'No sessions yet. Start using Claude Code to see your sessions here.'
        )}
      </div>
    )
  }

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{text('项目', 'Project')}</TableHead>
            <TableHead className='hidden sm:table-cell'>
              {text('开始时间', 'Started')}
            </TableHead>
            <TableHead className='hidden md:table-cell'>
              {text('持续时间', 'Duration')}
            </TableHead>
            <TableHead className='text-right'>{text('Tokens', 'Tokens')}</TableHead>
            <TableHead className='text-right'>{text('成本', 'Cost')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <div className='flex items-center gap-3'>
                  <div className='hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-1 sm:flex'>
                    <span className='text-xs font-medium text-primary-foreground'>
                      {getProjectInitials(session.project_path)}
                    </span>
                  </div>
                  <div className='min-w-0'>
                    <div className='max-w-[120px] truncate font-medium sm:max-w-[180px]'>
                      {formatProjectPath(session.project_path)}
                    </div>
                    <div className='mt-1 flex flex-wrap gap-1'>
                      {session.models_used.slice(0, 2).map((model) => (
                        <Badge
                          key={model}
                          variant='outline'
                          className={`px-1 py-0 text-[10px] ${getModelBadgeClass(model)}`}
                        >
                          {getModelShortName(model)}
                        </Badge>
                      ))}
                      {session.models_used.length > 2 && (
                        <Badge variant='outline' className='px-1 py-0 text-[10px]'>
                          +{session.models_used.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className='hidden text-muted-foreground sm:table-cell'>
                {formatRelativeTime(session.started_at, locale)}
              </TableCell>
              <TableCell className='hidden text-muted-foreground md:table-cell'>
                {formatDuration(session.started_at, session.last_activity, locale)}
              </TableCell>
              <TableCell className='text-right font-mono text-sm'>
                {formatTokens(
                  session.total_input_tokens,
                  session.total_output_tokens
                )}
              </TableCell>
              <TableCell className='text-right font-mono text-sm font-medium'>
                {formatCurrency(session.total_cost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
