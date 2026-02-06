import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow, format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  DollarSign,
  Coins,
  Calendar,
  ArrowLeft,
  FolderOpen,
} from 'lucide-react'
import { AgentsIcon } from '@/components/icons/agents-icon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { getAgent, getAgentDailyCosts } from '@/lib/api'
import { AgentCostChart } from './components/agent-cost-chart'

interface AgentDetailProps {
  agentId: string
}

export function AgentDetail({ agentId }: AgentDetailProps) {
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => getAgent(agentId),
    refetchInterval: 10000,
  })

  const { data: dailyCosts, isLoading: dailyCostsLoading } = useQuery({
    queryKey: ['agentDailyCosts', agentId],
    queryFn: () => getAgentDailyCosts(agentId, 30),
    refetchInterval: 10000,
  })

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value)
  }

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <AgentsIcon active className='h-6 w-6' />
          <span className='font-jersey text-xl'>Agent Detail</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6'>
          <Link to='/'>
            <Button variant='ghost' size='sm' className='mb-4 -ml-2'>
              <ArrowLeft className='mr-2 h-4 w-4' />
              Back to Overview
            </Button>
          </Link>
          <div className='flex items-center gap-4'>
            {agentLoading ? (
              <>
                <Skeleton className='h-10 w-48' />
                <Skeleton className='h-6 w-24' />
              </>
            ) : (
              <>
                <h1 className='text-2xl font-bold tracking-tight'>
                  {agent?.name}
                </h1>
                {agent?.workspace && (
                  <Badge variant='secondary' className='text-sm'>
                    <FolderOpen className='mr-1 h-3 w-3' />
                    {agent.workspace}
                  </Badge>
                )}
              </>
            )}
          </div>
          <p className='text-muted-foreground'>
            Detail view and cost analysis
          </p>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
          {/* Total Cost Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Cost
              </CardTitle>
              <DollarSign className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {agentLoading ? (
                <>
                  <Skeleton className='h-8 w-24 mb-1' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {formatCurrency(agent?.total_cost ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Since creation
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Input Tokens Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Input Tokens
              </CardTitle>
              <Coins className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {agentLoading ? (
                <>
                  <Skeleton className='h-8 w-24 mb-1' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {formatNumber(agent?.total_input_tokens ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Consumed input tokens
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Output Tokens Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Output Tokens
              </CardTitle>
              <Coins className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {agentLoading ? (
                <>
                  <Skeleton className='h-8 w-24 mb-1' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {formatNumber(agent?.total_output_tokens ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Generated output tokens
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Sessions Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Sessions</CardTitle>
              <Calendar className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {agentLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {agent?.session_count ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Created{' '}
                    {agent?.created_at &&
                      formatDistanceToNow(new Date(agent.created_at), {
                        addSuffix: true,
                        locale: enUS,
                      })}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cost Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cost History</CardTitle>
            <CardDescription>
              Daily costs for the last 30 days for this agent
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

        {/* Agent Info Card */}
        {!agentLoading && agent && (
          <Card className='mt-6'>
            <CardHeader>
              <CardTitle>Agent Information</CardTitle>
              <CardDescription>Technical details about the agent</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <dt className='text-sm font-medium text-muted-foreground'>
                    Agent ID
                  </dt>
                  <dd className='mt-1 font-mono text-sm'>{agent.id}</dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-muted-foreground'>
                    Created
                  </dt>
                  <dd className='mt-1 text-sm'>
                    {format(new Date(agent.created_at), 'PPPp', { locale: enUS })}
                  </dd>
                </div>
                {agent.workspace && (
                  <div>
                    <dt className='text-sm font-medium text-muted-foreground'>
                      Workspace
                    </dt>
                    <dd className='mt-1 text-sm'>{agent.workspace}</dd>
                  </div>
                )}
                <div>
                  <dt className='text-sm font-medium text-muted-foreground'>
                    Average Cost per Session
                  </dt>
                  <dd className='mt-1 font-mono text-sm'>
                    {agent.session_count > 0
                      ? formatCurrency(agent.total_cost / agent.session_count)
                      : '-'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}

AgentDetail.displayName = 'AgentDetail'
