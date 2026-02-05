import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  DollarSign,
  Coins,
  Database,
  Activity,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { HomeIcon } from '@/components/icons/home-icon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  getEnhancedStats,
  getDailyCosts,
  getModelUsage,
  getTokenBreakdown,
  getSessions,
} from '@/lib/api'
import { DailyCostChart } from './components/daily-cost-chart'
import { ModelUsageChart } from './components/model-usage-chart'
import { TokenBreakdownCard } from './components/token-breakdown-card'
import { RecentSessionsTable } from './components/recent-sessions-table'

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['enhancedStats'],
    queryFn: getEnhancedStats,
    refetchInterval: 5000,
  })

  const { data: dailyCosts, isLoading: dailyCostsLoading } = useQuery({
    queryKey: ['dailyCosts'],
    queryFn: () => getDailyCosts(30),
    refetchInterval: 10000,
  })

  const { data: modelUsage, isLoading: modelUsageLoading } = useQuery({
    queryKey: ['modelUsage'],
    queryFn: () => getModelUsage(30),
    refetchInterval: 10000,
  })

  const { data: tokenBreakdown, isLoading: tokenBreakdownLoading } = useQuery({
    queryKey: ['tokenBreakdown'],
    queryFn: () => getTokenBreakdown(30),
    refetchInterval: 10000,
  })

  const { data: recentSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['recentSessions'],
    queryFn: () => getSessions(10, 0),
    refetchInterval: 10000,
  })

  const formatCurrency = (value: number) => {
    if (value >= 100) return `$${value.toFixed(0)}`
    if (value >= 10) return `$${value.toFixed(1)}`
    if (value >= 1) return `$${value.toFixed(2)}`
    if (value >= 0.01) return `$${value.toFixed(2)}`
    return `$${value.toFixed(4)}`
  }

  const formatNumber = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toString()
  }

  const totalTokens = stats
    ? stats.totalTokens.input +
      stats.totalTokens.output +
      stats.totalTokens.cacheRead +
      stats.totalTokens.cacheCreation
    : 0

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <HomeIcon active className='h-6 w-6' />
          <span className='font-semibold text-lg'>Dashboard</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Uebersicht</h1>
            <p className='text-muted-foreground'>
              Deine Kostenanalyse auf einen Blick
            </p>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
          {/* Total Cost Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Gesamtkosten
              </CardTitle>
              <DollarSign className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className='h-8 w-24 mb-1' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {formatCurrency(stats?.totalCost ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {formatCurrency(stats?.monthCost ?? 0)} diesen Monat
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Tokens Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Tokens gesamt
              </CardTitle>
              <Coins className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className='h-8 w-24 mb-1' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className='text-2xl font-bold cursor-help'>
                        {formatNumber(totalTokens)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-sm'>
                      <div className='space-y-1'>
                        <div className='flex justify-between gap-4'>
                          <span>Input:</span>
                          <span className='font-mono'>
                            {stats?.totalTokens.input.toLocaleString()}
                          </span>
                        </div>
                        <div className='flex justify-between gap-4'>
                          <span>Output:</span>
                          <span className='font-mono'>
                            {stats?.totalTokens.output.toLocaleString()}
                          </span>
                        </div>
                        <div className='flex justify-between gap-4'>
                          <span>Cache (read):</span>
                          <span className='font-mono'>
                            {stats?.totalTokens.cacheRead.toLocaleString()}
                          </span>
                        </div>
                        <div className='flex justify-between gap-4'>
                          <span>Cache (write):</span>
                          <span className='font-mono'>
                            {stats?.totalTokens.cacheCreation.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <p className='text-xs text-muted-foreground'>
                    {formatNumber(stats?.totalTokens.input ?? 0)} in /{' '}
                    {formatNumber(stats?.totalTokens.output ?? 0)} out
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cache Savings Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Cache-Ersparnis
              </CardTitle>
              <Database className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className='h-8 w-24 mb-1' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
                    {formatCurrency(stats?.cacheSavings ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Durch Prompt-Caching gespart
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Active Sessions Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Aktive Sessions
              </CardTitle>
              <Activity className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {stats?.activeSessionsThisMonth ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>Diesen Monat</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-7 mb-6'>
          {/* Daily Cost Chart - Takes 4 columns */}
          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <TrendingUp className='h-5 w-5' />
                Tageskosten
              </CardTitle>
              <CardDescription>
                Deine Ausgaben der letzten 30 Tage
              </CardDescription>
            </CardHeader>
            <CardContent className='ps-2'>
              {dailyCostsLoading ? (
                <Skeleton className='h-[300px] w-full' />
              ) : (
                <DailyCostChart data={dailyCosts ?? []} />
              )}
            </CardContent>
          </Card>

          {/* Model Usage Chart - Takes 3 columns */}
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <CardTitle>Modell-Nutzung</CardTitle>
              <CardDescription>Kostenverteilung nach Modell</CardDescription>
            </CardHeader>
            <CardContent>
              {modelUsageLoading ? (
                <Skeleton className='h-[300px] w-full' />
              ) : (
                <ModelUsageChart data={modelUsage ?? []} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Token Breakdown and Recent Sessions Row */}
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-7'>
          {/* Token Breakdown Card - Takes 3 columns */}
          <div className='col-span-1 lg:col-span-3'>
            {tokenBreakdownLoading ? (
              <Card>
                <CardHeader>
                  <Skeleton className='h-6 w-32' />
                  <Skeleton className='h-4 w-48' />
                </CardHeader>
                <CardContent>
                  <Skeleton className='h-[200px] w-full' />
                </CardContent>
              </Card>
            ) : (
              <TokenBreakdownCard data={tokenBreakdown} />
            )}
          </div>

          {/* Recent Sessions Table - Takes 4 columns */}
          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader className='flex flex-row items-center justify-between'>
              <div>
                <CardTitle>Letzte Sessions</CardTitle>
                <CardDescription>
                  Deine aktuellsten OpenClaw-Sessions
                </CardDescription>
              </div>
              <Link to='/sessions'>
                <Button variant='ghost' size='sm' className='gap-1'>
                  Alle anzeigen
                  <ArrowRight className='h-4 w-4' />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className='space-y-4'>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className='flex items-center gap-4'>
                      <Skeleton className='h-10 w-10 rounded-full' />
                      <div className='flex-1 space-y-2'>
                        <Skeleton className='h-4 w-32' />
                        <Skeleton className='h-3 w-24' />
                      </div>
                      <Skeleton className='h-4 w-16' />
                    </div>
                  ))}
                </div>
              ) : (
                <RecentSessionsTable sessions={recentSessions?.sessions ?? []} />
              )}
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
