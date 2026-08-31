import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Coins,
  Database,
  DollarSign,
  Download,
  TrendingUp,
} from 'lucide-react'
import {
  getAnalyticsStatus,
  getBudgetStatus,
  getDailyCosts,
  getEnhancedStats,
  getModelUsage,
  getTokenBreakdown,
  getTokenSummary,
  modelUsageQueryKey,
  type BudgetPeriod,
} from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { pollWhenVisible } from '@/lib/polling'
import { useCurrency } from '@/context/currency-provider'
import { useLocale } from '@/context/locale-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HomeIcon } from '@/components/icons/home-icon'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { deriveAnalyticsViewState } from './analytics-view-state'
import { DailyCostChart } from './components/daily-cost-chart'
import { TokenUsageCard } from './components/token-usage-card'
import { AgentsTab } from './tabs/agents-tab'
import { ChannelsTab } from './tabs/channels-tab'
import { ModelsTab } from './tabs/models-tab'
import { OverviewTab } from './tabs/overview-tab'

export function Dashboard() {
  const { locale, text } = useLocale()
  const { formatCurrency } = useCurrency()
  const [activeTab, setActiveTab] = useState('overview')
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['overview']))
  const numberLocale = locale === 'zh' ? 'zh-CN' : 'en-US'

  const handleTabChange = (tab: string) => {
    setVisitedTabs((current) => {
      if (current.has(tab)) {
        return current
      }

      const next = new Set(current)
      next.add(tab)
      return next
    })
    setActiveTab(tab)
  }

  const hasVisited = (tab: string) => visitedTabs.has(tab)

  const {
    data: analyticsStatus,
    isLoading: analyticsStatusLoading,
    isError: analyticsStatusError,
  } = useQuery({
    queryKey: ['analyticsStatus'],
    queryFn: getAnalyticsStatus,
    refetchInterval: (query) => {
      if (document.hidden) return false
      const status = query.state.data?.status
      return !status || status === 'scanning' ? 1000 : 30000
    },
    refetchIntervalInBackground: false,
  })
  const analyticsView = deriveAnalyticsViewState(
    analyticsStatus,
    analyticsStatusLoading,
    analyticsStatusError
  )
  const analyticsDataReady = analyticsView.canQuery
  const analyticsLoading = analyticsView.showSkeleton
  const analyticsUnavailable = analyticsView.showUnavailable
  const analyticsFailed =
    !analyticsDataReady &&
    (analyticsStatusError || analyticsStatus?.status === 'error')
  const lastSuccessfulScanLabel = analyticsStatus?.lastSuccessfulScanAt
    ? new Date(analyticsStatus.lastSuccessfulScanAt).toLocaleString(
        numberLocale
      )
    : null

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['enhancedStats'],
    queryFn: getEnhancedStats,
    enabled: analyticsDataReady,
    refetchInterval: pollWhenVisible(5000),
    refetchIntervalInBackground: false,
  })

  const { data: dailyCosts, isLoading: dailyCostsLoading } = useQuery({
    queryKey: ['dailyCosts'],
    queryFn: () => getDailyCosts(30),
    enabled: analyticsDataReady,
    refetchInterval: pollWhenVisible(15000),
    refetchIntervalInBackground: false,
  })

  const { data: modelUsage, isLoading: modelUsageLoading } = useQuery({
    queryKey: modelUsageQueryKey(30),
    queryFn: () => getModelUsage(30),
    enabled: analyticsDataReady,
    refetchInterval: pollWhenVisible(20000),
    refetchIntervalInBackground: false,
  })

  const { data: tokenBreakdown, isLoading: tokenBreakdownLoading } = useQuery({
    queryKey: ['tokenBreakdown'],
    queryFn: () => getTokenBreakdown(30),
    enabled: analyticsDataReady,
    refetchInterval: pollWhenVisible(25000),
    refetchIntervalInBackground: false,
  })

  const {
    data: tokenSummary,
    isLoading: tokenSummaryLoading,
    isError: tokenSummaryError,
    refetch: refetchTokenSummary,
  } = useQuery({
    queryKey: ['tokenSummary'],
    queryFn: getTokenSummary,
    enabled: analyticsDataReady,
    refetchInterval: pollWhenVisible(25000),
    refetchIntervalInBackground: false,
  })

  const { data: budgetStatus } = useQuery({
    queryKey: ['budgetStatus'],
    queryFn: getBudgetStatus,
    enabled: analyticsDataReady,
    refetchInterval: pollWhenVisible(30000),
    refetchIntervalInBackground: false,
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
          <span className='font-jersey text-xl'>
            {text('仪表盘', 'Dashboard')}
          </span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div className='space-y-2'>
            <div className='flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground'>
              <span className='h-1.5 w-1.5 rounded-full bg-primary' />
              {text('成本控制台', 'COST CONTROL CENTER')}
            </div>
            <h1 className='text-3xl font-bold tracking-tight sm:text-4xl'>
              {text('概览', 'Overview')}
            </h1>
            <p className='mt-1 max-w-xl text-sm text-muted-foreground'>
              {text(
                '一眼掌握你的成本分析概况',
                'Your cost analytics at a glance'
              )}
            </p>
            <p className='max-w-2xl text-sm leading-6 text-muted-foreground'>
              {text(
                'v0.7.5 更新：新增 Hermes 数据源与来源切换，优化分析数据采集、缓存、仪表盘可靠性及 Windows/WSL 支持；当前提供 Windows x64 安装版。',
                'v0.7.5: Added the Hermes data source and source switching, improved analytics ingestion, caching, dashboard reliability, and Windows/WSL support. Windows x64 installer available.'
              )}
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <div
              className='hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:flex'
              role='status'
              aria-live='polite'
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  analyticsFailed
                    ? 'bg-destructive'
                    : analyticsStatus?.status === 'unavailable'
                      ? 'bg-muted-foreground'
                      : analyticsView.isStale ||
                          analyticsLoading ||
                          analyticsView.isRefreshing
                        ? 'animate-pulse bg-warning'
                        : 'bg-success'
                }`}
              />
              {analyticsFailed
                ? text('分析数据扫描失败', 'Analytics scan failed')
                : analyticsStatus?.status === 'unavailable'
                  ? text('OpenClaw 数据源不可用', 'OpenClaw data unavailable')
                  : analyticsView.isStale
                    ? text('显示上次数据', 'Showing previous data')
                    : analyticsView.isCached
                      ? text('正在校验缓存数据…', 'Verifying cached data…')
                      : analyticsLoading || analyticsView.isRefreshing
                        ? text(
                            '正在扫描 OpenClaw 数据…',
                            'Scanning OpenClaw data…'
                          )
                        : text('分析数据已就绪', 'Analytics ready')}
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={() =>
                window.open('/api/export/costs?format=csv', '_blank')
              }
            >
              <Download className='mr-2 h-4 w-4' />
              {text('导出 CSV', 'Export CSV')}
            </Button>
          </div>
        </div>

        {analyticsUnavailable && (
          <div
            className='mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-muted-foreground'
            role='alert'
          >
            {analyticsStatusError || analyticsStatus?.status === 'error'
              ? text(
                  '分析数据扫描失败，请检查 OpenClaw 数据源后重试。',
                  'Analytics scan failed. Check the OpenClaw data source and retry.'
                )
              : text(
                  'OpenClaw 数据源不可用，暂时没有可展示的分析数据。',
                  'The OpenClaw data source is unavailable; no analytics data is available yet.'
                )}
          </div>
        )}

        {!analyticsUnavailable &&
          (analyticsView.isCached ||
            analyticsView.isStale ||
            analyticsView.isRefreshing) && (
            <div
              className='mb-6 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted-foreground'
              role='status'
              aria-live='polite'
            >
              {analyticsView.isStale
                ? text(
                    '最新刷新失败，当前显示上次成功的数据。',
                    'The latest refresh failed; the last successful data is still displayed.'
                  )
                : analyticsView.isCached
                  ? text(
                      '正在校验启动缓存，校验完成前数据可能不是最新。',
                      'Verifying the startup cache; values may be outdated until verification completes.'
                    )
                  : text(
                      '正在后台刷新，当前继续显示上次成功的数据。',
                      'Refreshing in the background while the last successful data remains visible.'
                    )}
              {lastSuccessfulScanLabel && (
                <span className='ms-1'>
                  {text(
                    `上次成功：${lastSuccessfulScanLabel}`,
                    `Last successful: ${lastSuccessfulScanLabel}`
                  )}
                </span>
              )}
            </div>
          )}

        <div className='mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Card className='relative overflow-hidden border-border/70 bg-card/90 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-chart-1/70'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {text('总成本', 'Total Cost')}
              </CardTitle>
              <div className='rounded-lg border border-chart-1/15 bg-chart-1/10 p-2.5'>
                <DollarSign className='h-4 w-4 text-chart-1' />
              </div>
            </CardHeader>
            <CardContent>
              {analyticsLoading || statsLoading ? (
                <>
                  <Skeleton className='mb-1 h-8 w-24' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold text-chart-1'>
                    {formatCurrency(stats?.totalCost ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {text('本月', 'This month')}{' '}
                    {formatCurrency(stats?.monthCost ?? 0)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden border-border/70 bg-card/90 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-chart-2/70'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {text('总 Token 数', 'Total Tokens')}
              </CardTitle>
              <div className='rounded-lg border border-chart-2/15 bg-chart-2/10 p-2.5'>
                <Coins className='h-4 w-4 text-chart-2' />
              </div>
            </CardHeader>
            <CardContent>
              {analyticsLoading || statsLoading ? (
                <>
                  <Skeleton className='mb-1 h-8 w-24' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type='button'
                        className='cursor-help rounded-md text-left text-2xl font-bold text-chart-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                      >
                        {formatNumber(totalTokens)}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-sm'>
                      <div className='space-y-1'>
                        <div className='flex justify-between gap-4'>
                          <span>{text('输入：', 'In:')}</span>
                          <span className='font-mono'>
                            {(stats?.totalTokens.input ?? 0).toLocaleString(
                              numberLocale
                            )}
                          </span>
                        </div>
                        <div className='flex justify-between gap-4'>
                          <span>{text('输出：', 'Out:')}</span>
                          <span className='font-mono'>
                            {(stats?.totalTokens.output ?? 0).toLocaleString(
                              numberLocale
                            )}
                          </span>
                        </div>
                        <div className='flex justify-between gap-4'>
                          <span>{text('缓存读取：', 'Cache Read:')}</span>
                          <span className='font-mono'>
                            {(stats?.totalTokens.cacheRead ?? 0).toLocaleString(
                              numberLocale
                            )}
                          </span>
                        </div>
                        <div className='flex justify-between gap-4'>
                          <span>{text('缓存写入：', 'Cache Write:')}</span>
                          <span className='font-mono'>
                            {(
                              stats?.totalTokens.cacheCreation ?? 0
                            ).toLocaleString(numberLocale)}
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <p className='text-xs text-muted-foreground'>
                    {text(
                      `输入 ${formatNumber(stats?.totalTokens.input ?? 0)} / 输出 ${formatNumber(stats?.totalTokens.output ?? 0)}`,
                      `In ${formatNumber(stats?.totalTokens.input ?? 0)} / Out ${formatNumber(stats?.totalTokens.output ?? 0)}`
                    )}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden border-border/70 bg-card/90 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-success/70'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {text('缓存节省', 'Cache Savings')}
              </CardTitle>
              <div className='rounded-lg border border-success/15 bg-success/10 p-2.5'>
                <Database className='h-4 w-4 text-success' />
              </div>
            </CardHeader>
            <CardContent>
              {analyticsLoading || statsLoading ? (
                <>
                  <Skeleton className='mb-1 h-8 w-24' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold text-success'>
                    {formatCurrency(stats?.cacheSavings ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {text('通过提示缓存节省', 'Saved via prompt caching')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden border-border/70 bg-card/90 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-info/70'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {text('活跃会话', 'Active Sessions')}
              </CardTitle>
              <div className='rounded-lg border border-info/15 bg-info/10 p-2.5'>
                <Activity className='h-4 w-4 text-info' />
              </div>
            </CardHeader>
            <CardContent>
              {analyticsLoading || statsLoading ? (
                <>
                  <Skeleton className='mb-1 h-8 w-16' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold text-info'>
                    {stats?.activeSessionsThisMonth ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {text('本月', 'This month')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {!analyticsLoading &&
          budgetStatus &&
          (budgetStatus.daily ||
            budgetStatus.weekly ||
            budgetStatus.monthly) && (
            <div className='mb-6 grid gap-4 sm:grid-cols-3'>
              {budgetStatus.daily && (
                <BudgetBar
                  label={text('日预算', 'Daily Budget')}
                  period={budgetStatus.daily}
                />
              )}
              {budgetStatus.weekly && (
                <BudgetBar
                  label={text('周预算', 'Weekly Budget')}
                  period={budgetStatus.weekly}
                />
              )}
              {budgetStatus.monthly && (
                <BudgetBar
                  label={text('月预算', 'Monthly Budget')}
                  period={budgetStatus.monthly}
                />
              )}
            </div>
          )}

        <div className='mb-6 grid gap-6 lg:grid-cols-2'>
          <Card className='min-w-0'>
            <CardHeader className='gap-3 border-b bg-muted/10'>
              <CardTitle className='flex items-center gap-2'>
                <TrendingUp className='h-5 w-5' />
                {text('每日成本', 'Daily Cost')}
              </CardTitle>
              <CardDescription>
                {text(
                  '最近 30 天的花费趋势',
                  'Cost trend over the last 30 days'
                )}
              </CardDescription>
              <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                <span className='flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-chart-1' />
                  {text('成本', 'Cost')}
                </span>
                <span className='flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-chart-2' />
                  {text('缓存节省', 'Cache savings')}
                </span>
              </div>
            </CardHeader>
            <CardContent className='ps-2 pe-4'>
              {analyticsLoading || dailyCostsLoading ? (
                <Skeleton className='h-[300px] w-full' />
              ) : (
                <DailyCostChart data={dailyCosts ?? []} />
              )}
            </CardContent>
          </Card>

          <TokenUsageCard
            data={dailyCosts ?? []}
            summary={tokenSummary}
            chartLoading={analyticsLoading || dailyCostsLoading}
            summaryLoading={analyticsLoading || tokenSummaryLoading}
            summaryError={tokenSummaryError}
            onRetry={() => {
              void refetchTokenSummary()
            }}
          />
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value='overview'>
              {text('概览', 'Overview')}
            </TabsTrigger>
            <TabsTrigger value='models'>{text('模型', 'Models')}</TabsTrigger>
            <TabsTrigger value='agents'>{text('代理', 'Agents')}</TabsTrigger>
            <TabsTrigger value='channels'>
              {text('渠道', 'Channels')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='overview'>
            <OverviewTab
              modelUsage={modelUsage}
              modelUsageLoading={analyticsLoading || modelUsageLoading}
              tokenBreakdown={tokenBreakdown}
              tokenBreakdownLoading={analyticsLoading || tokenBreakdownLoading}
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

function BudgetBar({ label, period }: { label: string; period: BudgetPeriod }) {
  const { text } = useLocale()
  const { formatCurrency } = useCurrency()

  const color =
    period.percent >= 90
      ? 'bg-primary'
      : period.percent >= 70
        ? 'bg-warning'
        : 'bg-success'

  const textColor =
    period.percent >= 90
      ? 'text-primary'
      : period.percent >= 70
        ? 'text-warning'
        : 'text-success'

  return (
    <Card className='p-4'>
      <div className='mb-2 flex items-center justify-between'>
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
      <p className='mt-1 text-xs text-muted-foreground'>
        {text(
          `已使用 ${period.percent.toFixed(0)}%`,
          `Used ${period.percent.toFixed(0)}%`
        )}
      </p>
    </Card>
  )
}
