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
import { formatDate, formatRelativeTime } from '@/lib/i18n'

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
    label: '移动端',
  },
  desktop: {
    icon: Monitor,
    label: '桌面端',
  },
  browser: {
    icon: Globe,
    label: '浏览器',
  },
}

const defaultDeviceConfig = {
  icon: HelpCircle,
  label: '未知',
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
    label: '活跃',
  },
  inactive: {
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
    label: '不活跃',
  },
  suspended: {
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    label: '已停用',
  },
}

const defaultStatusConfig = {
  className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
  label: '未知',
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
                  <TableHead>设备</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近在线</TableHead>
                  <TableHead className='text-right'>连接次数</TableHead>
                  <TableHead>配对时间</TableHead>
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
          已配对设备
        </CardTitle>
        <CardDescription>
          {devices.length > 0
            ? `已配对 ${devices.length} 台设备`
            : '暂无已配对设备'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <Smartphone className='h-12 w-12 text-muted-foreground mb-4' />
            <p className='text-lg font-medium text-muted-foreground'>
              未找到设备
            </p>
            <p className='text-sm text-muted-foreground'>
              先配对设备再开始使用
            </p>
          </div>
        ) : (
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>设备</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近在线</TableHead>
                  <TableHead className='text-right'>连接次数</TableHead>
                  <TableHead>配对时间</TableHead>
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
                            {device.name ?? '未命名设备'}
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
                            {formatRelativeTime(device.last_seen)}
                          </span>
                        ) : (
                          <span className='text-sm text-muted-foreground'>
                            从未
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='text-right font-mono'>
                        {device.connection_count}
                      </TableCell>
                      <TableCell>
                        <span className='text-sm'>
                          {formatDate(device.paired_at)}
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
