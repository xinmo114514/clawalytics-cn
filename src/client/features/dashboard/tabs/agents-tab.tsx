import { useQuery } from '@tanstack/react-query'
import { DollarSign, Coins, Activity, TrendingUp, Bot } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/format'
import { getAgentStats, getAllAgentsDailyCosts } from '@/lib/api'
import { AgentsTable } from '@/features/agents/components/agents-table'
import { AgentCostChart } from '@/features/agents/components/agent-cost-chart'
import { AgentDistributionChart } from '@/features/agents/components/agent-distribution-chart'

interface AgentsTabProps {
  enabled: boolean
}

export function AgentsTab({ enabled }: AgentsTabProps) {
  const { data: agentStats, isLoading: statsLoading } = useQuery({
    queryKey: ['agentStats'],
    queryFn: () => getAgentStats(50),
    refetchInterval: 10000,
    enabled,
  })

  const { data: dailyCosts, isLoading: dailyCostsLoading } = useQuery({
    queryKey: ['agentDailyCosts'],
    queryFn: () => getAllAgentsDailyCosts(30),
    refetchInterval: 10000,
    enabled,
  })

  const agents = agentStats?.agents ?? []
  const totalInputTokens = agents.reduce((acc, a) => acc + a.total_input_tokens, 0)
  const totalOutputTokens = agents.reduce((acc, a) => acc + a.total_output_tokens, 0)

  return (
    <div className='space-y-6'>
      {/* Stats Cards Row */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Agent Costs</CardTitle>
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
                  {formatCurrency(agentStats?.totalCost ?? 0)}
                </div>
                <p className='text-xs text-muted-foreground'>All agents combined</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Number of Agents</CardTitle>
            <div className='rounded-full bg-rose-500/10 p-2'>
              <Bot className='h-4 w-4 text-rose-500' />
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
                <div className='text-2xl font-bold text-rose-600 dark:text-rose-400'>{agents.length}</div>
                <p className='text-xs text-muted-foreground'>Registered agents</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Tokens</CardTitle>
            <div className='rounded-full bg-red-500/10 p-2'>
              <Coins className='h-4 w-4 text-red-500' />
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
                  {formatNumber(totalInputTokens + totalOutputTokens)}
                </div>
                <p className='text-xs text-muted-foreground'>
                  {formatNumber(totalInputTokens)} in / {formatNumber(totalOutputTokens)} out
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Sessions</CardTitle>
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
                  {agentStats?.totalSessions ?? 0}
                </div>
                <p className='text-xs text-muted-foreground'>All agent sessions</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <TrendingUp className='h-5 w-5' />
              Daily Costs
            </CardTitle>
            <CardDescription>Agent costs for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            {dailyCostsLoading ? (
              <Skeleton className='h-[300px] w-full' />
            ) : (
              <AgentCostChart data={dailyCosts ?? []} />
            )}
          </CardContent>
        </Card>

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
          <CardDescription>List of all registered OpenClaw Agents</CardDescription>
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
    </div>
  )
}
