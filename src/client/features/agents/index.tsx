import { useQuery } from '@tanstack/react-query'
import { DollarSign, Coins, Activity, TrendingUp, Bot } from 'lucide-react'
import { AgentsIcon } from '@/components/icons/agents-icon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { getAgentStats, getAllAgentsDailyCosts } from '@/lib/api'
import { AgentsTable } from './components/agents-table'
import { AgentCostChart } from './components/agent-cost-chart'
import { AgentDistributionChart } from './components/agent-distribution-chart'

export function Agents() {
  const { data: agentStats, isLoading: statsLoading } = useQuery({
    queryKey: ['agentStats'],
    queryFn: () => getAgentStats(50),
    refetchInterval: 10000,
  })

  const { data: dailyCosts, isLoading: dailyCostsLoading } = useQuery({
    queryKey: ['agentDailyCosts'],
    queryFn: () => getAllAgentsDailyCosts(30),
    refetchInterval: 10000,
  })

  const formatCurrency = (value: number): string => {
    if (value >= 100) return `$${value.toFixed(0)}`
    if (value >= 10) return `$${value.toFixed(1)}`
    if (value >= 1) return `$${value.toFixed(2)}`
    if (value >= 0.01) return `$${value.toFixed(2)}`
    return `$${value.toFixed(4)}`
  }

  const formatNumber = (value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toString()
  }

  const agents = agentStats?.agents ?? []
  const totalInputTokens = agents.reduce(
    (acc, a) => acc + a.total_input_tokens,
    0
  )
  const totalOutputTokens = agents.reduce(
    (acc, a) => acc + a.total_output_tokens,
    0
  )

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <AgentsIcon active className='h-6 w-6' />
          <span className='font-semibold text-lg'>Agents</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              Agent Overview
            </h1>
            <p className='text-muted-foreground'>
              Manage and analyze your OpenClaw Agents
            </p>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
          {/* Total Cost Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Agent Costs
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
                    {formatCurrency(agentStats?.totalCost ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    All agents combined
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Agents Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Number of Agents
              </CardTitle>
              <Bot className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>{agents.length}</div>
                  <p className='text-xs text-muted-foreground'>
                    Registered agents
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Tokens Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Tokens
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
                  <div className='text-2xl font-bold'>
                    {formatNumber(totalInputTokens + totalOutputTokens)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {formatNumber(totalInputTokens)} in /{' '}
                    {formatNumber(totalOutputTokens)} out
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Sessions Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Sessions
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
                    {agentStats?.totalSessions ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    All agent sessions
                  </p>
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
                Daily Costs
              </CardTitle>
              <CardDescription>
                Agent costs for the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent className='ps-2'>
              {dailyCostsLoading ? (
                <Skeleton className='h-[300px] w-full' />
              ) : (
                <AgentCostChart data={dailyCosts ?? []} />
              )}
            </CardContent>
          </Card>

          {/* Distribution Chart - Takes 3 columns */}
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <CardTitle>Cost Distribution</CardTitle>
              <CardDescription>Costs by agent</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className='h-[300px] w-full' />
              ) : (
                <AgentDistributionChart agents={agents} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Agents Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Agents</CardTitle>
            <CardDescription>
              List of all registered OpenClaw Agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className='space-y-4'>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className='h-16 w-full' />
                ))}
              </div>
            ) : (
              <AgentsTable agents={agents} />
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

Agents.displayName = 'Agents'
