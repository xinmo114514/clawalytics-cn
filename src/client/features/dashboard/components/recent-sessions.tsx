import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { getSessions } from '@/lib/api'
import { Badge } from '@/components/ui/badge'

export function RecentSessions() {
  const { data, isLoading } = useQuery({
    queryKey: ['recentSessions'],
    queryFn: () => getSessions(5, 0),
    refetchInterval: 10000,
  })

  if (isLoading) {
    return (
      <div className='space-y-4'>
        {[...Array(5)].map((_, i) => (
          <div key={i} className='flex items-center animate-pulse'>
            <div className='h-9 w-9 rounded-full bg-muted' />
            <div className='ml-4 space-y-1'>
              <div className='h-4 w-[200px] rounded bg-muted' />
              <div className='h-3 w-[150px] rounded bg-muted' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const sessions = data?.sessions ?? []

  if (sessions.length === 0) {
    return (
      <div className='text-center text-muted-foreground py-8'>
        No sessions yet. Start using OpenClaw to see your sessions here.
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {sessions.map((session) => (
        <div key={session.id} className='flex items-center'>
          <div className='h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center'>
            <span className='text-primary text-sm font-medium'>
              {getProjectInitials(session.project_path)}
            </span>
          </div>
          <div className='ml-4 space-y-1 flex-1 min-w-0'>
            <p className='text-sm font-medium leading-none truncate'>
              {formatProjectPath(session.project_path)}
            </p>
            <p className='text-xs text-muted-foreground'>
              {formatDistanceToNow(new Date(session.last_activity), { addSuffix: true })}
            </p>
          </div>
          <div className='ml-auto text-right'>
            <p className='text-sm font-medium'>
              ${session.total_cost.toFixed(4)}
            </p>
            <div className='flex gap-1 justify-end flex-wrap'>
              {session.models_used.slice(0, 2).map((model) => (
                <Badge key={model} variant='outline' className='text-[10px] px-1'>
                  {getModelShortName(model)}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
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
  // Shorten model names for display
  if (model.includes('claude-opus')) return 'Opus'
  if (model.includes('claude-sonnet')) return 'Sonnet'
  if (model.includes('claude-haiku')) return 'Haiku'
  if (model.includes('gpt-4o-mini')) return '4o-mini'
  if (model.includes('gpt-4o')) return 'GPT-4o'
  if (model.includes('gpt-4')) return 'GPT-4'
  return model.split('-')[0]
}
