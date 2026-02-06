import { formatDistanceToNow, differenceInMinutes, differenceInHours } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Session } from '@/lib/api'

interface RecentSessionsTableProps {
  sessions: Session[]
}

function formatProjectPath(path: string): string {
  // Convert encoded path like "-Users-name-project" to "project"
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

function formatDuration(startedAt: string, lastActivity: string): string {
  const start = new Date(startedAt)
  const end = new Date(lastActivity)
  const hours = differenceInHours(end, start)
  const minutes = differenceInMinutes(end, start) % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return '<1m'
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

// Model badge color mapping (red/rose palette)
function getModelBadgeClass(model: string): string {
  if (model.includes('opus')) return 'border-red-500/50 text-red-600 dark:text-red-400'
  if (model.includes('sonnet')) return 'border-rose-500/50 text-rose-600 dark:text-rose-400'
  if (model.includes('haiku')) return 'border-pink-500/50 text-pink-600 dark:text-pink-400'
  if (model.includes('gpt')) return 'border-fuchsia-500/50 text-fuchsia-600 dark:text-fuchsia-400'
  return 'border-gray-500/50'
}

export function RecentSessionsTable({ sessions }: RecentSessionsTableProps) {
  if (sessions.length === 0) {
    return (
      <div className='flex h-[200px] items-center justify-center text-muted-foreground text-center'>
        No sessions yet. Start using Claude Code to see your sessions here.
      </div>
    )
  }

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead className='hidden sm:table-cell'>Started</TableHead>
            <TableHead className='hidden md:table-cell'>Duration</TableHead>
            <TableHead className='text-right'>Tokens</TableHead>
            <TableHead className='text-right'>Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <div className='flex items-center gap-3'>
                  <div className='hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-500 sm:flex'>
                    <span className='text-xs font-medium text-white'>
                      {getProjectInitials(session.project_path)}
                    </span>
                  </div>
                  <div className='min-w-0'>
                    <div className='font-medium truncate max-w-[120px] sm:max-w-[180px]'>
                      {formatProjectPath(session.project_path)}
                    </div>
                    <div className='flex gap-1 mt-1 flex-wrap'>
                      {session.models_used.slice(0, 2).map((model) => (
                        <Badge
                          key={model}
                          variant='outline'
                          className={`text-[10px] px-1 py-0 ${getModelBadgeClass(model)}`}
                        >
                          {getModelShortName(model)}
                        </Badge>
                      ))}
                      {session.models_used.length > 2 && (
                        <Badge
                          variant='outline'
                          className='text-[10px] px-1 py-0'
                        >
                          +{session.models_used.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className='hidden sm:table-cell text-muted-foreground'>
                {formatDistanceToNow(new Date(session.started_at), {
                  addSuffix: true,
                  locale: enUS,
                })}
              </TableCell>
              <TableCell className='hidden md:table-cell text-muted-foreground'>
                {formatDuration(session.started_at, session.last_activity)}
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
