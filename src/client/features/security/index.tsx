import { useQuery } from '@tanstack/react-query'
import {
  Smartphone,
  Bell,
  AlertTriangle,
  Link,
} from 'lucide-react'
import { SecurityIcon } from '@/components/icons/security-icon'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  getSecurityDashboard,
  getAlerts,
  getRecentConnections,
} from '@/lib/api'
import { AlertsList } from './components/alerts-list'
import { ConnectionsList } from './components/connections-list'

SecurityDashboard.displayName = 'SecurityDashboard'

export function SecurityDashboard() {
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

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <SecurityIcon active className='h-6 w-6' />
          <span className='font-semibold text-lg'>Security</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              Security Overview
            </h1>
            <p className='text-muted-foreground'>
              Monitor devices, alerts, and connections
            </p>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
          {/* Active Devices Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Active Devices
              </CardTitle>
              <Smartphone className='h-4 w-4 text-muted-foreground' />
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
                    {dashboardStats?.activeDevices ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Paired devices
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Pending Requests Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Pending Requests
              </CardTitle>
              <Bell className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div
                    className={`text-2xl font-bold ${
                      (dashboardStats?.pendingRequests ?? 0) > 0
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : ''
                    }`}
                  >
                    {dashboardStats?.pendingRequests ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Pairing requests
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Unacknowledged Alerts Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Unacknowledged Alerts
              </CardTitle>
              <AlertTriangle className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div
                    className={`text-2xl font-bold ${
                      (dashboardStats?.unacknowledgedAlerts ?? 0) > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {dashboardStats?.unacknowledgedAlerts ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Unacknowledged
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Connections Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Connections (24h)
              </CardTitle>
              <Link className='h-4 w-4 text-muted-foreground' />
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
                    {dashboardStats?.recentConnections ?? 0}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Last 24 hours
                  </p>
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

        {/* Alerts and Connections Row */}
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
      </Main>
    </>
  )
}
