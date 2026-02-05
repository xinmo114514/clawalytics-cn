import { useState, Fragment } from 'react'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  ChevronDown,
  ChevronRight,
  FileSearch,
  User,
  Globe,
  Activity,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { type AuditEntry } from '@/lib/api'

interface AuditTableProps {
  entries: AuditEntry[]
  isLoading: boolean
}

AuditTable.displayName = 'AuditTable'

interface ExpandedRows {
  [key: number]: boolean
}

const actionConfig: Record<
  string,
  {
    className: string
    label: string
  }
> = {
  create: {
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    label: 'Created',
  },
  update: {
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    label: 'Updated',
  },
  delete: {
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    label: 'Deleted',
  },
  login: {
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    label: 'Login',
  },
  logout: {
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
    label: 'Logout',
  },
  access: {
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    label: 'Access',
  },
}

const defaultActionConfig = {
  className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
  label: 'Action',
}

export function AuditTable({ entries, isLoading }: AuditTableProps) {
  const [expandedRows, setExpandedRows] = useState<ExpandedRows>({})

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  if (isLoading) {
    return (
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-8' />
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(10)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className='h-4 w-4' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-5 w-20' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-4 w-32' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-4 w-24' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-4 w-28' />
                </TableCell>
                <TableCell>
                  <Skeleton className='h-4 w-24' />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-center rounded-md border'>
        <FileSearch className='h-12 w-12 text-muted-foreground mb-4' />
        <p className='text-lg font-medium text-muted-foreground'>
          No audit entries found
        </p>
        <p className='text-sm text-muted-foreground'>
          Activities will be logged here
        </p>
      </div>
    )
  }

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-8' />
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Timestamp</TableHead>
            <TableHead>IP Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const config = actionConfig[entry.action] ?? defaultActionConfig
            const isExpanded = expandedRows[entry.id]
            const hasDetails = entry.details !== null && entry.details !== ''

            return (
              <Fragment key={entry.id}>
                <TableRow
                  className={hasDetails ? 'cursor-pointer' : ''}
                  onClick={() => hasDetails && toggleRow(entry.id)}
                >
                  <TableCell>
                    {hasDetails ? (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 p-0'
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleRow(entry.id)
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className='h-4 w-4' />
                        ) : (
                          <ChevronRight className='h-4 w-4' />
                        )}
                      </Button>
                    ) : (
                      <Activity className='h-4 w-4 text-muted-foreground' />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={config.className}>
                      {entry.action ?? config.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.entity_type && (
                      <div className='flex flex-col'>
                        <span className='text-sm font-medium'>
                          {entry.entity_type}
                        </span>
                        {entry.entity_id && (
                          <span className='text-xs text-muted-foreground font-mono'>
                            {entry.entity_id.length > 12
                              ? `${entry.entity_id.slice(0, 12)}...`
                              : entry.entity_id}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.actor ? (
                      <div className='flex items-center gap-2'>
                        <User className='h-4 w-4 text-muted-foreground' />
                        <span className='text-sm'>{entry.actor}</span>
                      </div>
                    ) : (
                      <span className='text-sm text-muted-foreground'>System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className='text-sm'>
                      {format(new Date(entry.timestamp), 'MM/dd/yyyy HH:mm:ss', {
                        locale: enUS,
                      })}
                    </span>
                  </TableCell>
                  <TableCell>
                    {entry.ip_address ? (
                      <div className='flex items-center gap-2'>
                        <Globe className='h-4 w-4 text-muted-foreground' />
                        <span className='text-sm font-mono'>
                          {entry.ip_address}
                        </span>
                      </div>
                    ) : (
                      <span className='text-sm text-muted-foreground'>-</span>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && hasDetails && (
                  <TableRow>
                    <TableCell colSpan={6} className='bg-muted/50'>
                      <div className='px-4 py-3'>
                        <p className='text-xs font-medium text-muted-foreground mb-1'>
                          Details
                        </p>
                        <pre className='text-sm whitespace-pre-wrap font-mono bg-background p-3 rounded-md border'>
                          {entry.details}
                        </pre>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
