import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Wrench,
} from 'lucide-react'
import { ToolsIcon } from '@/components/icons/tools-icon'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { getOutboundCalls, getToolStats } from '@/lib/api'

ToolsAnalytics.displayName = 'ToolsAnalytics'

const statusConfig: Record<
  string,
  {
    className: string
    icon: typeof CheckCircle
    label: string
  }
> = {
  success: {
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle,
    label: 'Success',
  },
  error: {
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
    label: 'Error',
  },
  pending: {
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Clock,
    label: 'Pending',
  },
}

const defaultStatusConfig = {
  className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
  icon: Activity,
  label: 'Unknown',
}

export function ToolsAnalytics() {
  const { data: toolCalls, isLoading: callsLoading } = useQuery({
    queryKey: ['toolCalls'],
    queryFn: () => getOutboundCalls(50),
    refetchInterval: 10000,
  })

  const { data: toolStats, isLoading: statsLoading } = useQuery({
    queryKey: ['toolStats'],
    queryFn: () => getToolStats(30),
    refetchInterval: 30000,
  })

  const totalCalls = toolCalls?.length ?? 0
  const errorCalls =
    toolCalls?.filter((c) => c.status === 'error').length ?? 0
  const errorRate = totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0
  const avgDuration =
    toolCalls && toolCalls.length > 0
      ? toolCalls.reduce((acc, c) => acc + (c.duration_ms ?? 0), 0) /
        toolCalls.filter((c) => c.duration_ms !== null).length
      : 0

  const chartData = (toolStats ?? [])
    .slice(0, 10)
    .map((stat) => ({
      name:
        stat.toolName.length > 15
          ? `${stat.toolName.slice(0, 12)}...`
          : stat.toolName,
      fullName: stat.toolName,
      count: stat.count,
      avgDuration: Math.round(stat.avgDuration),
    }))
    .reverse()

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <ToolsIcon active className='h-6 w-6' />
          <span className='font-semibold text-lg'>Tools</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Tool Analytics</h1>
            <p className='text-muted-foreground'>
              Overview of tool calls and statistics
            </p>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-3 mb-6'>
          {/* Total Calls Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Calls
              </CardTitle>
              <Activity className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>{totalCalls}</div>
                  <p className='text-xs text-muted-foreground'>
                    Last 50 calls
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Average Duration Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Average Duration
              </CardTitle>
              <Clock className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <>
                  <Skeleton className='h-8 w-20 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {avgDuration > 0 ? `${Math.round(avgDuration)}ms` : '-'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Per call
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Error Rate Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Error Rate</CardTitle>
              <AlertCircle className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div
                    className={`text-2xl font-bold ${
                      errorRate > 10
                        ? 'text-red-600 dark:text-red-400'
                        : errorRate > 5
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {errorRate.toFixed(1)}%
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {errorCalls} of {totalCalls} failed
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart and Table Row */}
        <div className='grid gap-6 lg:grid-cols-2'>
          {/* Tool Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Tool Usage</CardTitle>
              <CardDescription>
                Most used tools (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className='h-[300px] w-full' />
              ) : chartData.length === 0 ? (
                <div className='flex flex-col items-center justify-center h-[300px]'>
                  <Wrench className='h-12 w-12 text-muted-foreground mb-4' />
                  <p className='text-muted-foreground'>No data available</p>
                </div>
              ) : (
                <ResponsiveContainer width='100%' height={300}>
                  <BarChart
                    data={chartData}
                    layout='vertical'
                    margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                    <XAxis type='number' className='text-xs' />
                    <YAxis
                      dataKey='name'
                      type='category'
                      width={100}
                      className='text-xs'
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className='rounded-lg border bg-background p-3 shadow-md'>
                              <p className='font-medium'>{data.fullName}</p>
                              <p className='text-sm text-muted-foreground'>
                                Calls: {data.count}
                              </p>
                              <p className='text-sm text-muted-foreground'>
                                Average: {data.avgDuration}ms
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar
                      dataKey='count'
                      fill='hsl(var(--primary))'
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent Tool Calls Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Tool Calls</CardTitle>
              <CardDescription>
                Most recent tool calls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <div className='space-y-4'>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className='flex items-center gap-4'>
                      <Skeleton className='h-8 w-8 rounded-full' />
                      <div className='flex-1 space-y-2'>
                        <Skeleton className='h-4 w-32' />
                        <Skeleton className='h-3 w-24' />
                      </div>
                      <Skeleton className='h-5 w-16' />
                    </div>
                  ))}
                </div>
              ) : (toolCalls ?? []).length === 0 ? (
                <div className='flex flex-col items-center justify-center py-8'>
                  <Activity className='h-12 w-12 text-muted-foreground mb-4' />
                  <p className='text-muted-foreground'>
                    No tool calls found
                  </p>
                </div>
              ) : (
                <div className='rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tool</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className='text-right'>Duration</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(toolCalls ?? []).slice(0, 10).map((call) => {
                        const config =
                          statusConfig[call.status ?? ''] ?? defaultStatusConfig
                        const StatusIcon = config.icon

                        return (
                          <TableRow key={call.id}>
                            <TableCell>
                              <div className='flex items-center gap-2'>
                                <Wrench className='h-4 w-4 text-muted-foreground' />
                                <span className='font-medium text-sm'>
                                  {call.tool_name.length > 20
                                    ? `${call.tool_name.slice(0, 17)}...`
                                    : call.tool_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={config.className}>
                                <StatusIcon className='mr-1 h-3 w-3' />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell className='text-right font-mono text-sm'>
                              {call.duration_ms !== null
                                ? `${call.duration_ms}ms`
                                : '-'}
                            </TableCell>
                            <TableCell className='text-sm text-muted-foreground'>
                              {formatDistanceToNow(new Date(call.timestamp), {
                                addSuffix: true,
                                locale: enUS,
                              })}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
