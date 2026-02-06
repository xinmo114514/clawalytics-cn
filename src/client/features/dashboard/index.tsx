import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign,
  Coins,
  Database,
  Activity,
  TrendingUp,
  Download,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { formatCurrency, formatNumber } from '@/lib/format'
import {
  getEnhancedStats,
  getDailyCosts,
  getModelUsage,
  getTokenBreakdown,
  getBudgetStatus,
  type BudgetPeriod,
} from '@/lib/api'
import { DailyCostChart } from './components/daily-cost-chart'
import { OverviewTab } from './tabs/overview-tab'
import { ModelsTab } from './tabs/models-tab'
import { AgentsTab } from './tabs/agents-tab'
import { ChannelsTab } from './tabs/channels-tab'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const visitedTabs = useRef(new Set(['overview']))

  const handleTabChange = (tab: string) => {
    visitedTabs.current.add(tab)
    setActiveTab(tab)
  }

  const hasVisited = (tab: string) => visitedTabs.current.has(tab)

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

  const { data: budgetStatus } = useQuery({
    queryKey: ['budgetStatus'],
    queryFn: getBudgetStatus,
    refetchInterval: 10000,
  })

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
          <span className='font-jersey text-xl'>Dashboard</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Overview</h1>
            <p className='text-muted-foreground'>
              Your cost analytics at a glance
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => window.open('/api/export/costs?format=csv', '_blank')}
          >
            <Download className='mr-2 h-4 w-4' />
            Export CSV
          </Button>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Total Cost</CardTitle>
              <div className='rounded-full bg-red-500/10 p-2'>
                <DollarSign className='h-4 w-4 text-red-500' />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
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
                    {formatCurrency(stats?.monthCost ?? 0)} this month
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Total Tokens</CardTitle>
              <div className='rounded-full bg-rose-500/10 p-2'>
                <Coins className='h-4 w-4 text-rose-500' />
              </div>
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
                      <div className='text-2xl font-bold cursor-help text-rose-600 dark:text-rose-400'>
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

          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Cache Savings</CardTitle>
              <div className='rounded-full bg-red-500/10 p-2'>
                <Database className='h-4 w-4 text-red-500' />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className='h-8 w-24 mb-1' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                    {formatCurrency(stats?.cacheSavings ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>Saved via prompt caching</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Active Sessions</CardTitle>
              <div className='rounded-full bg-red-500/10 p-2'>
                <Activity className='h-4 w-4 text-red-500' />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                    {stats?.activeSessionsThisMonth ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>This month</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Budget Progress */}
        {budgetStatus && (budgetStatus.daily || budgetStatus.weekly || budgetStatus.monthly) && (
          <div className='grid gap-4 sm:grid-cols-3 mb-6'>
            {budgetStatus.daily && (
              <BudgetBar label='Daily Budget' period={budgetStatus.daily} />
            )}
            {budgetStatus.weekly && (
              <BudgetBar label='Weekly Budget' period={budgetStatus.weekly} />
            )}
            {budgetStatus.monthly && (
              <BudgetBar label='Monthly Budget' period={budgetStatus.monthly} />
            )}
          </div>
        )}

        {/* Daily Cost Chart (always visible, above tabs) */}
        <Card className='mb-6'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <TrendingUp className='h-5 w-5' />
              Daily Costs
            </CardTitle>
            <CardDescription>Your spending over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            {dailyCostsLoading ? (
              <Skeleton className='h-[300px] w-full' />
            ) : (
              <DailyCostChart data={dailyCosts ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Tabbed Breakdown */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='models'>Models</TabsTrigger>
            <TabsTrigger value='agents'>Agents</TabsTrigger>
            <TabsTrigger value='channels'>Channels</TabsTrigger>
          </TabsList>

          <TabsContent value='overview'>
            <OverviewTab
              modelUsage={modelUsage}
              modelUsageLoading={modelUsageLoading}
              tokenBreakdown={tokenBreakdown}
              tokenBreakdownLoading={tokenBreakdownLoading}
              onSwitchTab={handleTabChange}
            />
          </TabsContent>

          <TabsContent value='models'>
            <ModelsTab enabled={hasVisited('models')} />
          </TabsContent>

          <TabsContent value='agents'>
            <AgentsTab enabled={hasVisited('agents')} />
          </TabsContent>

          <TabsContent value='channels'>
            <ChannelsTab enabled={hasVisited('channels')} />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

function BudgetBar({
  label,
  period,
}: {
  label: string
  period: BudgetPeriod
}) {
  const color =
    period.percent >= 90
      ? 'bg-red-500'
      : period.percent >= 70
        ? 'bg-yellow-500'
        : 'bg-green-500'

  const textColor =
    period.percent >= 90
      ? 'text-red-600 dark:text-red-400'
      : period.percent >= 70
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-green-600 dark:text-green-400'

  return (
    <Card className='p-4'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-sm font-medium'>{label}</span>
        <span className={`text-sm font-semibold ${textColor}`}>
          {formatCurrency(period.spent)} / {formatCurrency(period.budget)}
        </span>
      </div>
      <div className='relative h-2 w-full overflow-hidden rounded-full bg-muted'>
        <div
          className={`h-full transition-all ${color}`}
          style={{ width: `${Math.min(100, period.percent)}%` }}
        />
      </div>
      <p className='text-xs text-muted-foreground mt-1'>
        {period.percent.toFixed(0)}% used
      </p>
    </Card>
  )
}
