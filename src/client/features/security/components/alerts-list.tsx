import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { AlertTriangle, CheckCircle, Bell, ShieldAlert, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  type SecurityAlert,
  acknowledgeAlert,
  acknowledgeAllAlerts,
} from '@/lib/api'

interface AlertsListProps {
  alerts: SecurityAlert[]
  isLoading: boolean
  showAcknowledgeAll?: boolean
}

AlertsList.displayName = 'AlertsList'

const severityConfig = {
  critical: {
    iconBg: 'bg-red-500',
    textColor: 'text-red-500',
    icon: ShieldAlert,
    label: 'CRITICAL',
  },
  high: {
    iconBg: 'bg-orange-500',
    textColor: 'text-orange-500',
    icon: AlertTriangle,
    label: 'HIGH',
  },
  medium: {
    iconBg: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    icon: Bell,
    label: 'MEDIUM',
  },
  low: {
    iconBg: 'bg-gray-500',
    textColor: 'text-gray-500',
    icon: Info,
    label: 'LOW',
  },
} as const

export function AlertsList({
  alerts,
  isLoading,
  showAcknowledgeAll = true,
}: AlertsListProps) {
  const queryClient = useQueryClient()

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityAlerts'] })
      queryClient.invalidateQueries({ queryKey: ['securityDashboard'] })
      toast.success('Alert acknowledged')
    },
    onError: () => {
      toast.error('Failed to acknowledge alert')
    },
  })

  const acknowledgeAllMutation = useMutation({
    mutationFn: acknowledgeAllAlerts,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['securityAlerts'] })
      queryClient.invalidateQueries({ queryKey: ['securityDashboard'] })
      toast.success(`${data.count} alerts acknowledged`)
    },
    onError: () => {
      toast.error('Failed to acknowledge alerts')
    },
  })

  const handleAcknowledge = (id: number) => {
    acknowledgeMutation.mutate(id)
  }

  const handleAcknowledgeAll = () => {
    acknowledgeAllMutation.mutate()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='h-4 w-48' />
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {[...Array(3)].map((_, i) => (
              <div key={i} className='flex items-start gap-4 p-4 rounded-lg border'>
                <Skeleton className='h-10 w-10 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-32' />
                  <Skeleton className='h-4 w-48' />
                  <Skeleton className='h-3 w-24' />
                </div>
                <Skeleton className='h-8 w-24' />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged)

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-4'>
        <div>
          <CardTitle className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5' />
            Security Alerts
          </CardTitle>
          <CardDescription>
            {unacknowledgedAlerts.length > 0
              ? `${unacknowledgedAlerts.length} unacknowledged alerts`
              : 'No unacknowledged alerts'}
          </CardDescription>
        </div>
        {showAcknowledgeAll && unacknowledgedAlerts.length > 1 && (
          <Button
            variant='outline'
            size='sm'
            onClick={handleAcknowledgeAll}
            disabled={acknowledgeAllMutation.isPending}
          >
            <CheckCircle className='mr-2 h-4 w-4' />
            Acknowledge All
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <CheckCircle className='h-12 w-12 text-emerald-500 mb-4' />
            <p className='text-lg font-medium text-muted-foreground'>
              No alerts found
            </p>
            <p className='text-sm text-muted-foreground'>
              Your system is secure
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity]
              const IconComponent = config.icon

              return (
                <div
                  key={alert.id}
                  className={`
                    flex items-start gap-4 p-4 rounded-lg border
                    ${alert.acknowledged ? 'opacity-60' : ''}
                    transition-opacity
                  `}
                >
                  <div
                    className={`
                      flex h-10 w-10 items-center justify-center rounded-full
                      ${config.iconBg}
                    `}
                  >
                    <IconComponent className='h-5 w-5 text-white' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      <span className={`font-jersey text-xs tracking-wider ${config.textColor}`}>
                        {config.label}
                      </span>
                      <span className='text-sm font-medium'>{alert.type}</span>
                    </div>
                    <p className='text-sm text-muted-foreground truncate'>
                      {alert.message}
                    </p>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {formatDistanceToNow(new Date(alert.timestamp), {
                        addSuffix: true,
                        locale: enUS,
                      })}
                    </p>
                  </div>
                  {!alert.acknowledged && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={acknowledgeMutation.isPending}
                    >
                      <CheckCircle className='mr-2 h-4 w-4' />
                      Acknowledge
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
