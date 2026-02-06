import { formatDistanceToNow, differenceInMinutes, differenceInHours } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber } from '@/lib/format'
import type { EnhancedSession } from '@/lib/api'
import { SessionDetailRow } from './session-detail-row'

interface SessionsTableProps {
  sessions: EnhancedSession[]
  sortBy: string
  sortDir: 'asc' | 'desc'
  onSort: (field: string) => void
  expandedSessionId: string | null
  onToggleExpand: (sessionId: string) => void
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

function getModelBadgeClass(model: string): string {
  if (model.includes('opus')) return 'border-red-500/50 text-red-600 dark:text-red-400'
  if (model.includes('sonnet')) return 'border-rose-500/50 text-rose-600 dark:text-rose-400'
  if (model.includes('haiku')) return 'border-pink-500/50 text-pink-600 dark:text-pink-400'
  if (model.includes('gpt')) return 'border-fuchsia-500/50 text-fuchsia-600 dark:text-fuchsia-400'
  return 'border-gray-500/50'
}

function formatDuration(startedAt: string, lastActivity: string): string {
  const start = new Date(startedAt)
  const end = new Date(lastActivity)
  const hours = differenceInHours(end, start)
  const minutes = differenceInMinutes(end, start) % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}

type SortableField = 'last_activity' | 'request_count' | 'total_input_tokens' | 'total_output_tokens' | 'total_cost'

function SortableHeader({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
  className,
}: {
  label: string
  field: SortableField
  sortBy: string
  sortDir: 'asc' | 'desc'
  onSort: (field: string) => void
  className?: string
}) {
  const isActive = sortBy === field
  const Icon = isActive ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead className={className}>
      <div
        className='flex items-center gap-1 cursor-pointer select-none hover:text-foreground'
        onClick={() => onSort(field)}
      >
        {label}
        <Icon className='h-3.5 w-3.5' />
      </div>
    </TableHead>
  )
}

export function SessionsTable({
  sessions,
  sortBy,
  sortDir,
  onSort,
  expandedSessionId,
  onToggleExpand,
}: SessionsTableProps) {
  const maxCost = sessions.reduce((max, s) => Math.max(max, s.total_cost), 0)

  if (sessions.length === 0) {
    return (
      <div className='rounded-md border'>
        <div className='flex h-[200px] items-center justify-center text-muted-foreground'>
          No sessions found matching your filters.
        </div>
      </div>
    )
  }

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-8' />
            <TableHead>Project</TableHead>
            <SortableHeader label='Last Activity' field='last_activity' sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <TableHead className='hidden md:table-cell'>Duration</TableHead>
            <SortableHeader label='Requests' field='request_count' sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortableHeader label='Input' field='total_input_tokens' sortBy={sortBy} sortDir={sortDir} onSort={onSort} className='hidden sm:table-cell' />
            <SortableHeader label='Output' field='total_output_tokens' sortBy={sortBy} sortDir={sortDir} onSort={onSort} className='hidden sm:table-cell' />
            <SortableHeader label='Cost' field='total_cost' sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => {
            const isExpanded = expandedSessionId === session.id
            return (
              <SessionTableRow
                key={session.id}
                session={session}
                isExpanded={isExpanded}
                maxCost={maxCost}
                onToggle={() => onToggleExpand(session.id)}
              />
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function SessionTableRow({
  session,
  isExpanded,
  maxCost,
  onToggle,
}: {
  session: EnhancedSession
  isExpanded: boolean
  maxCost: number
  onToggle: () => void
}) {
  const costPercent = maxCost > 0 ? (session.total_cost / maxCost) * 100 : 0
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight

  return (
    <>
      <TableRow
        className='cursor-pointer hover:bg-muted/50'
        onClick={onToggle}
      >
        <TableCell className='py-2 w-8'>
          <ChevronIcon className='h-4 w-4 text-muted-foreground' />
        </TableCell>
        <TableCell className='py-2'>
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
              <div className='flex gap-1 mt-0.5 flex-wrap'>
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
                  <Badge variant='outline' className='text-[10px] px-1 py-0'>
                    +{session.models_used.length - 2}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className='py-2 text-muted-foreground text-sm'>
          {formatDistanceToNow(new Date(session.last_activity), {
            addSuffix: true,
            locale: enUS,
          })}
        </TableCell>
        <TableCell className='py-2 text-muted-foreground text-sm hidden md:table-cell'>
          {formatDuration(session.started_at, session.last_activity)}
        </TableCell>
        <TableCell className='py-2 font-mono text-sm text-right'>
          {session.request_count}
        </TableCell>
        <TableCell className='py-2 font-mono text-sm text-right hidden sm:table-cell'>
          {formatNumber(session.total_input_tokens)}
        </TableCell>
        <TableCell className='py-2 font-mono text-sm text-right hidden sm:table-cell'>
          {formatNumber(session.total_output_tokens)}
        </TableCell>
        <TableCell className='py-2'>
          <div className='flex items-center gap-2 justify-end'>
            <span className='font-mono text-sm font-medium'>
              {formatCurrency(session.total_cost)}
            </span>
            <div className='relative h-2 w-16 overflow-hidden rounded-full bg-muted'>
              <div
                className='h-full bg-red-500 transition-all'
                style={{ width: `${costPercent}%` }}
              />
            </div>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8} className='p-0 bg-muted/30'>
            <SessionDetailRow sessionId={session.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
