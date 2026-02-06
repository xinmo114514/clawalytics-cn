import { formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  Link,
  Link2Off,
  ShieldX,
  ShieldCheck,
  Activity,
  Globe,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type ConnectionEvent } from '@/lib/api'

interface ConnectionsListProps {
  connections: ConnectionEvent[]
  isLoading: boolean
  title?: string
  description?: string
}

ConnectionsList.displayName = 'ConnectionsList'

const eventTypeConfig: Record<
  string,
  {
    iconBg: string
    textColor: string
    icon: typeof Link
    label: string
  }
> = {
  connection: {
    iconBg: 'bg-emerald-500',
    textColor: 'text-emerald-500',
    icon: Link,
    label: 'Connection',
  },
  disconnection: {
    iconBg: 'bg-gray-500',
    textColor: 'text-gray-500',
    icon: Link2Off,
    label: 'Disconnection',
  },
  auth_failure: {
    iconBg: 'bg-red-500',
    textColor: 'text-red-500',
    icon: ShieldX,
    label: 'Auth Failure',
  },
  auth_success: {
    iconBg: 'bg-blue-500',
    textColor: 'text-blue-500',
    icon: ShieldCheck,
    label: 'Auth Success',
  },
  heartbeat: {
    iconBg: 'bg-violet-500',
    textColor: 'text-violet-500',
    icon: Activity,
    label: 'Heartbeat',
  },
}

const defaultEventConfig = {
  iconBg: 'bg-gray-500',
  textColor: 'text-gray-500',
  icon: Globe,
  label: 'Unknown',
}

export function ConnectionsList({
  connections,
  isLoading,
  title = 'Connection Events',
  description = 'Recent connection activity',
}: ConnectionsListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-40' />
          <Skeleton className='h-4 w-56' />
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {[...Array(5)].map((_, i) => (
              <div key={i} className='flex items-center gap-4 p-3 rounded-lg border'>
                <Skeleton className='h-8 w-8 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-3 w-32' />
                </div>
                <Skeleton className='h-4 w-20' />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Globe className='h-5 w-5' />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {connections.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <Activity className='h-12 w-12 text-muted-foreground mb-4' />
            <p className='text-lg font-medium text-muted-foreground'>
              No connection events
            </p>
            <p className='text-sm text-muted-foreground'>
              No activity recorded yet
            </p>
          </div>
        ) : (
          <div className='space-y-2'>
            {connections.map((connection) => {
              const config =
                eventTypeConfig[connection.event_type] ?? defaultEventConfig
              const IconComponent = config.icon

              return (
                <div
                  key={connection.id}
                  className='flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors'
                >
                  <div
                    className={`
                      flex h-8 w-8 items-center justify-center rounded-full
                      ${config.iconBg}
                    `}
                  >
                    <IconComponent className='h-4 w-4 text-white' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className={`font-jersey text-xs tracking-wider ${config.textColor}`}>
                        {config.label}
                      </span>
                      {connection.device_id && (
                        <span className='text-xs text-muted-foreground font-mono truncate'>
                          {connection.device_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-2 mt-1'>
                      {connection.ip_address && (
                        <span className='text-xs text-muted-foreground'>
                          IP: {connection.ip_address}
                        </span>
                      )}
                      {connection.details && (
                        <span className='text-xs text-muted-foreground truncate'>
                          {connection.details}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className='text-xs text-muted-foreground whitespace-nowrap'>
                    {formatDistanceToNow(new Date(connection.timestamp), {
                      addSuffix: true,
                      locale: enUS,
                    })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
