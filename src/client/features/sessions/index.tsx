import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, format } from 'date-fns'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { getSessions } from '@/lib/api'

export function Sessions() {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', page, pageSize],
    queryFn: () => getSessions(pageSize, page * pageSize),
    refetchInterval: 10000,
  })

  const sessions = data?.sessions ?? []
  const filteredSessions = sessions.filter(
    (session) =>
      session.project_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.models_used.some((m) =>
        m.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )

  const exportToCSV = () => {
    const headers = [
      'Session ID',
      'Project',
      'Started',
      'Last Activity',
      'Input Tokens',
      'Output Tokens',
      'Cost',
      'Models',
    ]
    const rows = filteredSessions.map((s) => [
      s.id,
      s.project_path,
      s.started_at,
      s.last_activity,
      s.total_input_tokens,
      s.total_output_tokens,
      s.total_cost.toFixed(6),
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
          <span className='font-semibold text-lg'>Sessions</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <h1 className='text-2xl font-bold tracking-tight'>Sessions</h1>
          <Button onClick={exportToCSV} variant='outline' size='sm'>
            <Download className='mr-2 h-4 w-4' />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Sessions</CardTitle>
            <CardDescription>
              View all your OpenClaw sessions and their costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='mb-4 flex items-center gap-4'>
              <div className='relative flex-1'>
                <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search by project or model...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-8'
                />
              </div>
            </div>

            {isLoading ? (
              <div className='space-y-4'>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className='h-16 animate-pulse rounded bg-muted' />
                ))}
              </div>
            ) : (
              <>
                <div className='rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead className='text-right'>Input Tokens</TableHead>
                        <TableHead className='text-right'>Output Tokens</TableHead>
                        <TableHead className='text-right'>Cost</TableHead>
                        <TableHead>Models</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className='text-center py-8'>
                            No sessions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell className='font-medium'>
                              {formatProjectPath(session.project_path)}
                            </TableCell>
                            <TableCell>
                              {formatDistanceToNow(
                                new Date(session.last_activity),
                                { addSuffix: true }
                              )}
                            </TableCell>
                            <TableCell className='text-right'>
                              {session.total_input_tokens.toLocaleString()}
                            </TableCell>
                            <TableCell className='text-right'>
                              {session.total_output_tokens.toLocaleString()}
                            </TableCell>
                            <TableCell className='text-right font-mono'>
                              ${session.total_cost.toFixed(4)}
                            </TableCell>
                            <TableCell>
                              <div className='flex gap-1 flex-wrap'>
                                {session.models_used.map((model) => (
                                  <Badge
                                    key={model}
                                    variant='secondary'
                                    className='text-xs'
                                  >
                                    {getModelShortName(model)}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className='mt-4 flex items-center justify-between'>
                  <p className='text-sm text-muted-foreground'>
                    Showing {filteredSessions.length} of {data?.total ?? 0} sessions
                  </p>
                  <div className='flex gap-2'>
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
                      disabled={!data?.hasMore}
                    >
                      Next
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

function formatProjectPath(path: string): string {
  const parts = path.split('-')
  return parts[parts.length - 1] || path
}

function getModelShortName(model: string): string {
  if (model.includes('claude-opus')) return 'Opus'
  if (model.includes('claude-sonnet')) return 'Sonnet'
  if (model.includes('claude-haiku')) return 'Haiku'
  if (model.includes('gpt-4o-mini')) return '4o-mini'
  if (model.includes('gpt-4o')) return 'GPT-4o'
  if (model.includes('gpt-4')) return 'GPT-4'
  return model.split('-')[0]
}
