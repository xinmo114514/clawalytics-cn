import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import {
  Smartphone,
  AlertTriangle,
  Link,
  X,
  Download,
  Search,
} from 'lucide-react'
import { SecurityIcon } from '@/components/icons/security-icon'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  getSecurityDashboard,
  getAlerts,
  getRecentConnections,
  getDevices,
  getAuditLog,
  type AuditFilters,
} from '@/lib/api'
import { AlertsList } from './components/alerts-list'
import { ConnectionsList } from './components/connections-list'
import { DevicesTable } from './components/devices-table'
import { AuditTable } from './components/audit-table'

SecurityPage.displayName = 'SecurityPage'

const PAGE_SIZE = 50

const actionOptions = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'access', label: 'Access' },
]

const entityTypeOptions = [
  { value: 'all', label: 'All Entities' },
  { value: 'device', label: 'Device' },
  { value: 'session', label: 'Session' },
  { value: 'config', label: 'Configuration' },
  { value: 'alert', label: 'Alert' },
  { value: 'user', label: 'User' },
]

export function SecurityPage() {
  const [activeTab, setActiveTab] = useState('overview')

  // Track which tabs have been visited for lazy loading
  const visitedTabs = useRef(new Set(['overview']))

  const handleTabChange = (tab: string) => {
    visitedTabs.current.add(tab)
    setActiveTab(tab)
  }

  const hasVisited = (tab: string) => visitedTabs.current.has(tab)

  // ----- Overview queries (always loaded) -----
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ['securityDashboard'],
    queryFn: getSecurityDashboard,
    refetchInterval: 10000,
  })

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['securityAlerts'],
    queryFn: () => getAlerts(false, 10),
    refetchInterval: 10000,
  })

  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ['recentConnections'],
    queryFn: () => getRecentConnections(24),
    refetchInterval: 10000,
  })

  // ----- Devices queries (lazy) -----
  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    refetchInterval: 10000,
    enabled: hasVisited('devices'),
  })

  // ----- Audit state -----
  const [page, setPage] = useState(0)
  const [action, setAction] = useState<string>('all')
  const [entityType, setEntityType] = useState<string>('all')
  const [actor, setActor] = useState<string>('')
  const [ipAddress, setIpAddress] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(
    format(subDays(new Date(), 7), 'yyyy-MM-dd')
  )
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

  const activeFilters: AuditFilters = {
    action: action !== 'all' ? action : undefined,
    entityType: entityType !== 'all' ? entityType : undefined,
    actor: actor || undefined,
    ipAddress: ipAddress || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['auditLog', activeFilters],
    queryFn: () => getAuditLog(activeFilters),
    refetchInterval: 30000,
    enabled: hasVisited('audit'),
  })

  const auditEntries = auditData?.entries ?? []
  const total = auditData?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const startItem = page * PAGE_SIZE + 1
  const endItem = Math.min((page + 1) * PAGE_SIZE, total)

  const handleResetFilters = () => {
    setAction('all')
    setEntityType('all')
    setActor('')
    setIpAddress('')
    setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    setEndDate(format(new Date(), 'yyyy-MM-dd'))
    setPage(0)
  }

  const hasActiveFilters =
    action !== 'all' || entityType !== 'all' || actor || ipAddress || startDate || endDate

  const handleFilterChange = () => {
    setPage(0)
  }

  const exportAuditCSV = () => {
    if (!auditEntries || auditEntries.length === 0) return

    const headers = [
      'ID', 'Action', 'Entity Type', 'Entity ID',
      'Timestamp', 'Actor', 'IP Address', 'Details',
    ]
    const rows = auditEntries.map((entry) => [
      entry.id,
      entry.action,
      entry.entity_type ?? '',
      entry.entity_id ?? '',
      entry.timestamp,
      entry.actor ?? '',
      entry.ip_address ?? '',
      entry.details ?? '',
    ])

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) =>
            typeof cell === 'string' && cell.includes(',')
              ? `"${cell.replace(/"/g, '""')}"`
              : cell
          )
          .join(',')
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <SecurityIcon active className='h-6 w-6' />
          <span className='font-jersey text-xl'>Security</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Security</h1>
            <p className='text-muted-foreground'>
              Monitor devices, alerts, and connections
            </p>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-3 mb-6'>
          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Active Devices</CardTitle>
              <div className='rounded-full bg-red-500 p-2'>
                <Smartphone className='h-4 w-4 text-white' />
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
                  <div className='text-2xl font-bold text-red-500'>
                    {dashboardStats?.activeDevices ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>Paired devices</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Unacknowledged Alerts</CardTitle>
              <div className='rounded-full bg-red-500 p-2'>
                <AlertTriangle className='h-4 w-4 text-white' />
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
                    {dashboardStats?.unacknowledgedAlerts ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>Unacknowledged</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className='relative overflow-hidden'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Connections (24h)</CardTitle>
              <div className='rounded-full bg-red-500 p-2'>
                <Link className='h-4 w-4 text-white' />
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
                    {dashboardStats?.recentConnections ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>Last 24 hours</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerts by Severity Row */}
        {dashboardStats?.alertsByLevel && (
          <div className='grid gap-4 sm:grid-cols-4 mb-6'>
            <Card className='border-l-4 border-l-red-500'>
              <CardContent className='pt-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Critical</span>
                  <span className='text-2xl font-bold text-red-600 dark:text-red-400'>
                    {dashboardStats.alertsByLevel.critical}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className='border-l-4 border-l-orange-500'>
              <CardContent className='pt-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>High</span>
                  <span className='text-2xl font-bold text-orange-600 dark:text-orange-400'>
                    {dashboardStats.alertsByLevel.high}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className='border-l-4 border-l-yellow-500'>
              <CardContent className='pt-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Medium</span>
                  <span className='text-2xl font-bold text-yellow-600 dark:text-yellow-400'>
                    {dashboardStats.alertsByLevel.medium}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className='border-l-4 border-l-gray-400'>
              <CardContent className='pt-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Low</span>
                  <span className='text-2xl font-bold text-gray-600 dark:text-gray-400'>
                    {dashboardStats.alertsByLevel.low}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='devices'>Devices</TabsTrigger>
            <TabsTrigger value='audit'>Audit Log</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value='overview'>
            <div className='grid gap-6 lg:grid-cols-2'>
              <AlertsList
                alerts={alerts ?? []}
                isLoading={alertsLoading}
                showAcknowledgeAll
              />
              <ConnectionsList
                connections={connections ?? []}
                isLoading={connectionsLoading}
                title='Recent Connections'
                description='Connection activity from the last 24 hours'
              />
            </div>
          </TabsContent>

          {/* Devices Tab */}
          <TabsContent value='devices'>
            <DevicesTable devices={devices ?? []} isLoading={devicesLoading} />
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value='audit'>
            {/* Compact filter bar */}
            <div className='flex flex-wrap items-end gap-3 mb-4'>
              <div className='relative'>
                <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Actor...'
                  value={actor}
                  onChange={(e) => {
                    setActor(e.target.value)
                    handleFilterChange()
                  }}
                  className='pl-8 h-9 w-36'
                />
              </div>

              <div className='relative'>
                <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='IP address...'
                  value={ipAddress}
                  onChange={(e) => {
                    setIpAddress(e.target.value)
                    handleFilterChange()
                  }}
                  className='pl-8 h-9 w-36'
                />
              </div>

              <Select value={action} onValueChange={(v) => { setAction(v); handleFilterChange(); }}>
                <SelectTrigger className='h-9 w-[140px]'>
                  <SelectValue placeholder='All Actions' />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={entityType} onValueChange={(v) => { setEntityType(v); handleFilterChange(); }}>
                <SelectTrigger className='h-9 w-[140px]'>
                  <SelectValue placeholder='All Entities' />
                </SelectTrigger>
                <SelectContent>
                  {entityTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type='date'
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  handleFilterChange()
                }}
                className='h-9 w-[140px]'
              />

              <span className='text-muted-foreground text-sm pb-1'>&ndash;</span>

              <Input
                type='date'
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  handleFilterChange()
                }}
                className='h-9 w-[140px]'
              />

              {hasActiveFilters && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-9'
                  onClick={handleResetFilters}
                >
                  <X className='mr-1 h-3.5 w-3.5' />
                  Reset
                </Button>
              )}

              <div className='ml-auto'>
                <Button
                  variant='outline'
                  size='sm'
                  className='h-9'
                  onClick={exportAuditCSV}
                  disabled={!auditEntries || auditEntries.length === 0}
                >
                  <Download className='mr-2 h-4 w-4' />
                  Export CSV
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className='pt-6'>
                <AuditTable entries={auditEntries} isLoading={auditLoading} />

                {total > 0 && (
                  <div className='mt-4 flex items-center justify-between'>
                    <p className='text-sm text-muted-foreground'>
                      {startItem}&ndash;{endItem} of {total} entries
                    </p>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm text-muted-foreground'>
                        Page {page + 1} / {Math.max(1, totalPages)}
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
                        disabled={page >= totalPages - 1}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
