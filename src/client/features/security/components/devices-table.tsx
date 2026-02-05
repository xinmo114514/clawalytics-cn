import { formatDistanceToNow, format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { Smartphone, Monitor, Globe, HelpCircle } from 'lucide-react'
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
import { type Device } from '@/lib/api'

interface DevicesTableProps {
  devices: Device[]
  isLoading: boolean
}

DevicesTable.displayName = 'DevicesTable'

const deviceTypeConfig: Record<
  string,
  {
    icon: typeof Smartphone
    label: string
  }
> = {
  mobile: {
    icon: Smartphone,
    label: 'Mobile',
  },
  desktop: {
    icon: Monitor,
    label: 'Desktop',
  },
  browser: {
    icon: Globe,
    label: 'Browser',
  },
}

const defaultDeviceConfig = {
  icon: HelpCircle,
  label: 'Unknown',
}

const statusConfig: Record<
  string,
  {
    className: string
    label: string
  }
> = {
  active: {
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    label: 'Active',
  },
  inactive: {
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
    label: 'Inactive',
  },
  suspended: {
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    label: 'Suspended',
  },
}

const defaultStatusConfig = {
  className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
  label: 'Unknown',
}

export function DevicesTable({ devices, isLoading }: DevicesTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='h-4 w-48' />
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className='text-right'>Connections</TableHead>
                  <TableHead>Paired</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className='h-4 w-32' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-16' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-5 w-16' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-24' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-8 ml-auto' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-20' />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Smartphone className='h-5 w-5' />
          Paired Devices
        </CardTitle>
        <CardDescription>
          {devices.length > 0
            ? `${devices.length} device${devices.length !== 1 ? 's' : ''} paired`
            : 'No devices paired'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <Smartphone className='h-12 w-12 text-muted-foreground mb-4' />
            <p className='text-lg font-medium text-muted-foreground'>
              No devices found
            </p>
            <p className='text-sm text-muted-foreground'>
              Pair a device to get started
            </p>
          </div>
        ) : (
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className='text-right'>Connections</TableHead>
                  <TableHead>Paired</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => {
                  const typeConfig =
                    deviceTypeConfig[device.type ?? ''] ?? defaultDeviceConfig
                  const statusCfg =
                    statusConfig[device.status] ?? defaultStatusConfig
                  const IconComponent = typeConfig.icon

                  return (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <IconComponent className='h-4 w-4 text-muted-foreground' />
                          <span className='font-medium'>
                            {device.name ?? 'Unnamed'}
                          </span>
                        </div>
                        <span className='text-xs text-muted-foreground font-mono'>
                          {device.id.slice(0, 12)}...
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>{typeConfig.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusCfg.className}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {device.last_seen ? (
                          <span className='text-sm'>
                            {formatDistanceToNow(new Date(device.last_seen), {
                              addSuffix: true,
                              locale: enUS,
                            })}
                          </span>
                        ) : (
                          <span className='text-sm text-muted-foreground'>
                            Never
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='text-right font-mono'>
                        {device.connection_count}
                      </TableCell>
                      <TableCell>
                        <span className='text-sm'>
                          {format(new Date(device.paired_at), 'MM/dd/yyyy', {
                            locale: enUS,
                          })}
                        </span>
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
  )
}
