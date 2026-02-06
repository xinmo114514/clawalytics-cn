import { Activity, DollarSign, TrendingUp, FolderOpen } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/format'
import type { SessionStats } from '@/lib/api'

interface SessionStatsCardsProps {
  stats: SessionStats | undefined
  isLoading: boolean
}

function formatProjectName(path: string): string {
  const parts = path.split('-')
  return parts[parts.length - 1] || path
}

export function SessionStatsCards({ stats, isLoading }: SessionStatsCardsProps) {
  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      <Card className='relative overflow-hidden'>
        <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Total Sessions</CardTitle>
          <div className='rounded-full bg-red-500/10 p-2'>
            <Activity className='h-4 w-4 text-red-500' />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Skeleton className='h-8 w-16 mb-1' />
              <Skeleton className='h-4 w-24' />
            </>
          ) : (
            <>
              <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                {formatNumber(stats?.totalSessions ?? 0)}
              </div>
              <p className='text-xs text-muted-foreground'>
                {stats?.totalSessionsThisMonth ?? 0} this month
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className='relative overflow-hidden'>
        <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-bl-full' />
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Total Cost</CardTitle>
          <div className='rounded-full bg-rose-500/10 p-2'>
            <DollarSign className='h-4 w-4 text-rose-500' />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Skeleton className='h-8 w-24 mb-1' />
              <Skeleton className='h-4 w-32' />
            </>
          ) : (
            <>
              <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                {formatCurrency(stats?.totalCost ?? 0)}
              </div>
              <p className='text-xs text-muted-foreground'>
                Across all sessions
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className='relative overflow-hidden'>
        <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Avg Cost / Session</CardTitle>
          <div className='rounded-full bg-red-500/10 p-2'>
            <TrendingUp className='h-4 w-4 text-red-500' />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Skeleton className='h-8 w-20 mb-1' />
              <Skeleton className='h-4 w-28' />
            </>
          ) : (
            <>
              <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                {formatCurrency(stats?.avgCostPerSession ?? 0)}
              </div>
              <p className='text-xs text-muted-foreground'>
                Per session average
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className='relative overflow-hidden'>
        <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Most Active Project</CardTitle>
          <div className='rounded-full bg-red-500/10 p-2'>
            <FolderOpen className='h-4 w-4 text-red-500' />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Skeleton className='h-8 w-24 mb-1' />
              <Skeleton className='h-4 w-20' />
            </>
          ) : (
            <>
              <div className='text-2xl font-bold text-red-600 dark:text-red-400 truncate'>
                {stats?.mostActiveProject
                  ? formatProjectName(stats.mostActiveProject.project)
                  : 'N/A'}
              </div>
              <p className='text-xs text-muted-foreground'>
                {stats?.mostActiveProject
                  ? `${stats.mostActiveProject.sessionCount} sessions`
                  : 'No data'}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
