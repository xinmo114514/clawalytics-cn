import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Download, Search } from 'lucide-react'
import { SessionsIcon } from '@/components/icons/sessions-icon'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  getSessions,
  getSessionStats,
  getProjectBreakdown,
  getSessionFilters,
} from '@/lib/api'
import { SessionStatsCards } from './components/session-stats-cards'
import { ProjectCostChart } from './components/project-cost-chart'
import { SessionsTable } from './components/sessions-table'

const PAGE_SIZE = 50

export function Sessions() {
  const [page, setPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortBy, setSortBy] = useState('last_activity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [projectFilter, setProjectFilter] = useState<string | undefined>()
  const [modelFilter, setModelFilter] = useState<string | undefined>()
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['sessionStats'],
    queryFn: getSessionStats,
    refetchInterval: 10000,
  })

  const { data: projectBreakdown, isLoading: chartLoading } = useQuery({
    queryKey: ['projectBreakdown'],
    queryFn: () => getProjectBreakdown(10),
    refetchInterval: 10000,
  })

  const { data: filters } = useQuery({
    queryKey: ['sessionFilters'],
    queryFn: getSessionFilters,
    refetchInterval: 30000,
  })

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', page, PAGE_SIZE, sortBy, sortDir, projectFilter, modelFilter, searchQuery],
    queryFn: () =>
      getSessions({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sortBy,
        sortDir,
        project: projectFilter,
        model: modelFilter,
        search: searchQuery || undefined,
      }),
    refetchInterval: 10000,
  })

  const totalPages = sessionsData?.total ? Math.ceil(sessionsData.total / PAGE_SIZE) : 0
  const startItem = page * PAGE_SIZE + 1
  const endItem = Math.min((page + 1) * PAGE_SIZE, sessionsData?.total ?? 0)

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(0)
  }

  const handleProjectClick = (project: string) => {
    setProjectFilter((current) => (current === project ? undefined : project))
    setPage(0)
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setPage(0)
  }

  const exportToCSV = () => {
    const sessions = sessionsData?.sessions ?? []
    const headers = [
      'Session ID',
      'Project',
      'Started',
      'Last Activity',
      'Input Tokens',
      'Output Tokens',
      'Cost',
      'Requests',
      'Models',
    ]
    const rows = sessions.map((s) => [
      s.id,
      s.project_path,
      s.started_at,
      s.last_activity,
      s.total_input_tokens,
      s.total_output_tokens,
      s.total_cost.toFixed(6),
      s.request_count,
      s.models_used.join('; '),
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clawalytics-sessions-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <SessionsIcon active className='h-6 w-6' />
          <span className='font-jersey text-xl'>Sessions</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Sessions</h1>
            <p className='text-muted-foreground'>
              Session analytics and cost breakdown by project
            </p>
          </div>
          <Button onClick={exportToCSV} variant='outline' size='sm'>
            <Download className='mr-2 h-4 w-4' />
            Export CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className='mb-6'>
          <SessionStatsCards stats={stats} isLoading={statsLoading} />
        </div>

        {/* Project Cost Chart */}
        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>Cost by Project</CardTitle>
            <CardDescription>Click a bar to filter the table below</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            {chartLoading ? (
              <Skeleton className='h-[200px] w-full' />
            ) : (
              <ProjectCostChart
                data={projectBreakdown ?? []}
                activeProject={projectFilter}
                onProjectClick={handleProjectClick}
              />
            )}
          </CardContent>
        </Card>

        {/* Filter bar */}
        <div className='mb-4 flex flex-wrap items-center gap-3'>
          <div className='relative flex-1 min-w-[200px]'>
            <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search by project or model...'
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
              className='pl-8'
            />
          </div>
          <Select
            value={projectFilter ?? 'all'}
            onValueChange={(v) => {
              setProjectFilter(v === 'all' ? undefined : v)
              setPage(0)
            }}
          >
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='All Projects' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Projects</SelectItem>
              {(filters?.projects ?? []).map((p) => {
                const parts = p.split('-')
                const name = parts[parts.length - 1] || p
                return (
                  <SelectItem key={p} value={p}>
                    {name}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Select
            value={modelFilter ?? 'all'}
            onValueChange={(v) => {
              setModelFilter(v === 'all' ? undefined : v)
              setPage(0)
            }}
          >
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='All Models' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Models</SelectItem>
              {(filters?.models ?? []).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sessions Table */}
        {sessionsLoading ? (
          <div className='space-y-4'>
            {[...Array(5)].map((_, i) => (
              <div key={i} className='h-16 animate-pulse rounded bg-muted' />
            ))}
          </div>
        ) : (
          <>
            <SessionsTable
              sessions={sessionsData?.sessions ?? []}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              expandedSessionId={expandedSessionId}
              onToggleExpand={(id) =>
                setExpandedSessionId((prev) => (prev === id ? null : id))
              }
            />

            {/* Pagination */}
            <div className='mt-4 flex items-center justify-between'>
              <p className='text-sm text-muted-foreground'>
                {sessionsData?.total && sessionsData.total > 0
                  ? `Showing ${startItem}-${endItem} of ${sessionsData.total} sessions`
                  : 'No sessions'}
              </p>
              <div className='flex items-center gap-2'>
                <span className='text-sm text-muted-foreground'>
                  Page {page + 1} of {Math.max(1, totalPages)}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!sessionsData?.hasMore}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Main>
    </>
  )
}
