import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
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
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'
import { useLocale } from '@/context/locale-provider'
import { appLocale, formatRelativeTime } from '@/lib/i18n'
import { getAgent, getAgentDailyCosts } from '@/lib/api'
import { AgentCostChart } from './components/agent-cost-chart'

interface AgentDetailProps {
  agentId: string
}

export function AgentDetail({ agentId }: AgentDetailProps) {
  const { text } = useLocale()
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
          <span className='font-jersey text-xl'>
            {text('代理详情', 'Agent Detail')}
          </span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6'>
          <Link to='/'>
            <Button variant='ghost' size='sm' className='mb-4 -ml-2'>
              <ArrowLeft className='mr-2 h-4 w-4' />
              {text('返回概览', 'Back to Overview')}
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
            {text('查看代理详情与成本分析', 'Detail view and cost analysis')}
          </p>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
          {/* Total Cost Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {text('总成本', 'Total Cost')}
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
                    {text('自创建以来', 'Since creation')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Input Tokens Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {text('输入 Token', 'Input Tokens')}
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
                    {text('已消耗输入 Token', 'Consumed input tokens')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Output Tokens Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {text('输出 Token', 'Output Tokens')}
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
                    {text('已生成输出 Token', 'Generated output tokens')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Sessions Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {text('会话数', 'Sessions')}
              </CardTitle>
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
                    {text('创建于', 'Created')}{' '}
                    {agent?.created_at &&
                      formatRelativeTime(agent.created_at)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cost Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{text('成本历史', 'Cost History')}</CardTitle>
            <CardDescription>
              {text(
                '该代理最近 30 天的每日成本',
                'Daily costs for the last 30 days for this agent'
              )}
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
              <CardTitle>{text('代理信息', 'Agent Information')}</CardTitle>
              <CardDescription>
                {text('关于该代理的技术信息', 'Technical details about the agent')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <dt className='text-sm font-medium text-muted-foreground'>
                    {text('代理 ID', 'Agent ID')}
                  </dt>
                  <dd className='mt-1 font-mono text-sm'>{agent.id}</dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-muted-foreground'>
                    {text('创建时间', 'Created')}
                  </dt>
                  <dd className='mt-1 text-sm'>
                    {format(new Date(agent.created_at), 'PPPp', {
                      locale: appLocale,
                    })}
                  </dd>
                </div>
                {agent.workspace && (
                  <div>
                    <dt className='text-sm font-medium text-muted-foreground'>
                      {text('工作区', 'Workspace')}
                    </dt>
                    <dd className='mt-1 text-sm'>{agent.workspace}</dd>
                  </div>
                )}
                <div>
                  <dt className='text-sm font-medium text-muted-foreground'>
                    {text('单次会话平均成本', 'Average Cost per Session')}
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
