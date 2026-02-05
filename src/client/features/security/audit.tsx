import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { Filter, X, Download } from 'lucide-react'
import { AuditIcon } from '@/components/icons/audit-icon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { getAuditLog, type AuditFilters } from '@/lib/api'
import { AuditTable } from './components/audit-table'

SecurityAudit.displayName = 'SecurityAudit'

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

export function SecurityAudit() {
  const [filters, setFilters] = useState<AuditFilters>({
    limit: 100,
  })
  const [action, setAction] = useState<string>('all')
  const [entityType, setEntityType] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>(
    format(subDays(new Date(), 7), 'yyyy-MM-dd')
  )
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

  const activeFilters: AuditFilters = {
    ...filters,
    action: action !== 'all' ? action : undefined,
    entityType: entityType !== 'all' ? entityType : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }

  const { data: auditEntries, isLoading } = useQuery({
    queryKey: ['auditLog', activeFilters],
    queryFn: () => getAuditLog(activeFilters),
    refetchInterval: 30000,
  })

  const handleResetFilters = () => {
    setAction('all')
    setEntityType('all')
    setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    setEndDate(format(new Date(), 'yyyy-MM-dd'))
    setFilters({ limit: 100 })
  }

  const hasActiveFilters =
    action !== 'all' || entityType !== 'all' || startDate || endDate

  const exportToCSV = () => {
    if (!auditEntries || auditEntries.length === 0) return

    const headers = [
      'ID',
      'Action',
      'Entity Type',
      'Entity ID',
      'Timestamp',
      'Actor',
      'IP Address',
      'Details',
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
          <AuditIcon active className='h-6 w-6' />
          <span className='font-semibold text-lg'>Audit Log</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Audit Log</h1>
            <p className='text-muted-foreground'>
              Review all system activities
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={exportToCSV}
            disabled={!auditEntries || auditEntries.length === 0}
          >
            <Download className='mr-2 h-4 w-4' />
            Export CSV
          </Button>
        </div>

        <Card className='mb-6'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Filter className='h-4 w-4' />
              Filter
            </CardTitle>
            <CardDescription>
              Filter audit entries by various criteria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <div className='space-y-2'>
                <Label htmlFor='action'>Action</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger id='action'>
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
              </div>

              <div className='space-y-2'>
                <Label htmlFor='entityType'>Entity Type</Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger id='entityType'>
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
              </div>

              <div className='space-y-2'>
                <Label htmlFor='startDate'>From</Label>
                <Input
                  id='startDate'
                  type='date'
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='endDate'>To</Label>
                <Input
                  id='endDate'
                  type='date'
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className='mt-4 flex justify-end'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleResetFilters}
                >
                  <X className='mr-2 h-4 w-4' />
                  Reset Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Entries</CardTitle>
            <CardDescription>
              {auditEntries
                ? `${auditEntries.length} entries found`
                : 'Loading entries...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuditTable entries={auditEntries ?? []} isLoading={isLoading} />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
