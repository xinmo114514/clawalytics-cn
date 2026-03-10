import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Clock,
  AlertCircle,
  Wrench,
  Search,
  Download,
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
  Cell,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'
import { getOutboundCalls, getToolStats } from '@/lib/api'
import { formatRelativeTime } from '@/lib/i18n'

ToolsAnalytics.displayName = 'ToolsAnalytics'

const PAGE_SIZE = 50

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'success', label: '成功' },
  { value: 'error', label: '失败' },
  { value: 'pending', label: '处理中' },
]

// Red gradient colors for bars (darker to lighter)
const BAR_COLORS = [
  '#7f1d1d', // Red 900
  '#991b1b', // Red 800
  '#b91c1c', // Red 700
  '#dc2626', // Red 600
  '#ef4444', // Red 500
  '#f87171', // Red 400
  '#fca5a5', // Red 300
  '#fecaca', // Red 200
  '#fee2e2', // Red 100
  '#fef2f2', // Red 50
]

export function ToolsAnalytics() {
  const [page, setPage] = useState(0)
  const [toolNameSearch, setToolNameSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filters = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    toolName: toolNameSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  }

  const { data: toolCallsData, isLoading: callsLoading } = useQuery({
    queryKey: ['toolCalls', filters],
    queryFn: () => getOutboundCalls(filters),
    refetchInterval: 10000,
  })

  const { data: toolStats, isLoading: statsLoading } = useQuery({
    queryKey: ['toolStats'],
    queryFn: () => getToolStats(30),
    refetchInterval: 30000,
  })

  const toolCalls = toolCallsData?.calls ?? []
  const total = toolCallsData?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const startItem = page * PAGE_SIZE + 1
  const endItem = Math.min((page + 1) * PAGE_SIZE, total)

  const errorCalls = toolCalls.filter((c) => c.status === 'error').length
  const errorRate = toolCalls.length > 0 ? (errorCalls / toolCalls.length) * 100 : 0
  const avgDuration =
    toolCalls.length > 0
      ? toolCalls.reduce((acc, c) => acc + (c.duration_ms ?? 0), 0) /
        toolCalls.filter((c) => c.duration_ms !== null).length
      : 0

  const handleFilterChange = () => {
    setPage(0)
  }

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
          <span className='font-jersey text-xl'>工具</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>工具分析</h1>
            <p className='text-muted-foreground'>
              查看工具调用与运行统计
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => window.open('/api/export/tools?format=csv', '_blank')}
          >
            <Download className='mr-2 h-4 w-4' />
            导出 CSV
          </Button>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-3 mb-6'>
          {/* Total Calls Card */}
          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                总调用数
              </CardTitle>
              <div className='rounded-full bg-red-500/10 p-2'>
                <Activity className='h-4 w-4 text-red-500' />
              </div>
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold text-red-600 dark:text-red-400'>{total}</div>
                  <p className='text-xs text-muted-foreground'>
                    工具总调用次数
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Average Duration Card */}
          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                平均耗时
              </CardTitle>
              <div className='rounded-full bg-red-500/10 p-2'>
                <Clock className='h-4 w-4 text-red-500' />
              </div>
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <>
                  <Skeleton className='h-8 w-20 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                    {avgDuration > 0 ? `${Math.round(avgDuration)}ms` : '-'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    每次调用
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Error Rate Card */}
          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>失败率</CardTitle>
              <div className='rounded-full bg-red-500/10 p-2'>
                <AlertCircle className='h-4 w-4 text-red-500' />
              </div>
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                    {errorRate.toFixed(1)}%
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    共 {toolCalls.length} 次调用，其中失败 {errorCalls} 次
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
              <CardTitle>工具使用情况</CardTitle>
              <CardDescription>
                最近 30 天最常用的工具
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className='h-[300px] w-full' />
              ) : chartData.length === 0 ? (
                <div className='flex flex-col items-center justify-center h-[300px]'>
                  <Wrench className='h-12 w-12 text-muted-foreground mb-4' />
                  <p className='text-muted-foreground'>暂无数据</p>
                </div>
              ) : (
                <ResponsiveContainer width='100%' height={300}>
                  <BarChart
                    data={chartData}
                    layout='vertical'
                    margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id='barGradient' x1='0' y1='0' x2='1' y2='0'>
                        <stop offset='0%' stopColor='#7f1d1d' />
                        <stop offset='100%' stopColor='#ef4444' />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                    <XAxis type='number' className='text-xs' />
                    <YAxis
                      dataKey='name'
                      type='category'
                      width={100}
                      interval={0}
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
                                调用次数：{data.count}
                              </p>
                              <p className='text-sm text-muted-foreground'>
                                平均耗时：{data.avgDuration}ms
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar
                      dataKey='count'
                      radius={[0, 4, 4, 0]}
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={BAR_COLORS[index % BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent Tool Calls Table */}
          <Card>
            <CardHeader>
              <CardTitle>最近工具调用</CardTitle>
              <CardDescription>
                最近 10 条工具调用
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
              ) : toolCalls.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-8'>
                  <Activity className='h-12 w-12 text-muted-foreground mb-4' />
                  <p className='text-muted-foreground'>
                    未找到工具调用
                  </p>
                </div>
              ) : (
                <div className='rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>工具</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className='text-right'>耗时</TableHead>
                        <TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {toolCalls.slice(0, 10).map((call) => {
                        const isError = call.status === 'error'
                        const isSuccess = call.status === 'success'

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
                              <span
                                className={`font-jersey text-xs uppercase tracking-wider ${
                                  isError
                                    ? 'text-red-600 dark:text-red-400'
                                    : isSuccess
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {call.status ?? 'UNKNOWN'}
                              </span>
                            </TableCell>
                            <TableCell className='text-right font-mono text-sm'>
                              {call.duration_ms !== null
                                ? `${call.duration_ms}ms`
                                : '-'}
                            </TableCell>
                            <TableCell className='text-sm text-muted-foreground'>
                              {formatRelativeTime(call.timestamp)}
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

        {/* Full Tool Calls Table with Pagination */}
        <Card className='mt-6'>
          <CardHeader>
          <CardTitle>全部工具调用</CardTitle>
          <CardDescription>
              {total > 0
                ? `显示第 ${startItem}-${endItem} 条，共 ${total} 次调用`
                : '未找到调用记录'}
          </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Controls */}
            <div className='mb-4 flex flex-col gap-4 sm:flex-row sm:items-center'>
              <div className='relative flex-1 max-w-sm'>
                <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='按工具名称搜索...'
                  value={toolNameSearch}
                  onChange={(e) => {
                    setToolNameSearch(e.target.value)
                    handleFilterChange()
                  }}
                  className='pl-8'
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v)
                  handleFilterChange()
                }}
              >
                <SelectTrigger className='w-[150px]'>
                  <SelectValue placeholder='按状态筛选' />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {callsLoading ? (
              <div className='space-y-4'>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className='h-12 animate-pulse rounded bg-muted' />
                ))}
              </div>
            ) : toolCalls.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-8'>
                <Activity className='h-12 w-12 text-muted-foreground mb-4' />
                <p className='text-muted-foreground'>
                  未找到工具调用
                </p>
              </div>
            ) : (
              <>
                <div className='rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>工具</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className='text-right'>耗时</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead>代理</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {toolCalls.map((call) => {
                        const isError = call.status === 'error'
                        const isSuccess = call.status === 'success'

                        return (
                          <TableRow key={call.id}>
                            <TableCell>
                              <div className='flex items-center gap-2'>
                                <Wrench className='h-4 w-4 text-muted-foreground' />
                                <span className='font-medium text-sm' title={call.tool_name}>
                                  {call.tool_name.length > 30
                                    ? `${call.tool_name.slice(0, 27)}...`
                                    : call.tool_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`font-jersey text-xs uppercase tracking-wider ${
                                  isError
                                    ? 'text-red-600 dark:text-red-400'
                                    : isSuccess
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {call.status ?? 'UNKNOWN'}
                              </span>
                            </TableCell>
                            <TableCell className='text-right font-mono text-sm'>
                              {call.duration_ms !== null
                                ? `${call.duration_ms}ms`
                                : '-'}
                            </TableCell>
                            <TableCell className='text-sm text-muted-foreground'>
                              {formatRelativeTime(call.timestamp)}
                            </TableCell>
                            <TableCell className='text-sm text-muted-foreground'>
                              {call.agent_id
                                ? call.agent_id.length > 15
                                  ? `${call.agent_id.slice(0, 12)}...`
                                  : call.agent_id
                                : '-'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className='mt-4 flex items-center justify-between'>
                  <p className='text-sm text-muted-foreground'>
                    共 {total} 次调用
                  </p>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm text-muted-foreground'>
                      第 {page + 1} 页，共 {Math.max(1, totalPages)} 页
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      上一页
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
