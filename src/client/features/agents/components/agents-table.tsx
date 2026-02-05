import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { ArrowUpDown, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Agent } from '@/lib/api'

interface AgentsTableProps {
  agents: Agent[]
}

type SortField = 'name' | 'total_cost' | 'session_count' | 'created_at'
type SortDirection = 'asc' | 'desc'

export function AgentsTable({ agents }: AgentsTableProps) {
  const [sortField, setSortField] = useState<SortField>('total_cost')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value)
  }

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedAgents = [...agents].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1

    switch (sortField) {
      case 'name':
        return multiplier * a.name.localeCompare(b.name)
      case 'total_cost':
        return multiplier * (a.total_cost - b.total_cost)
      case 'session_count':
        return multiplier * (a.session_count - b.session_count)
      case 'created_at':
        return (
          multiplier *
          (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        )
      default:
        return 0
    }
  })

  if (agents.length === 0) {
    return (
      <div className='flex h-32 items-center justify-center text-muted-foreground'>
        No agents found. Connect OpenClaw with a messaging channel.
      </div>
    )
  }

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                variant='ghost'
                size='sm'
                className='-ml-3 h-8'
                onClick={() => handleSort('name')}
              >
                Name
                <ArrowUpDown className='ml-2 h-4 w-4' />
              </Button>
            </TableHead>
            <TableHead>Workspace</TableHead>
            <TableHead className='text-right'>
              <Button
                variant='ghost'
                size='sm'
                className='-mr-3 h-8'
                onClick={() => handleSort('total_cost')}
              >
                Cost
                <ArrowUpDown className='ml-2 h-4 w-4' />
              </Button>
            </TableHead>
            <TableHead className='text-right'>Input Tokens</TableHead>
            <TableHead className='text-right'>Output Tokens</TableHead>
            <TableHead className='text-right'>
              <Button
                variant='ghost'
                size='sm'
                className='-mr-3 h-8'
                onClick={() => handleSort('session_count')}
              >
                Sessions
                <ArrowUpDown className='ml-2 h-4 w-4' />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant='ghost'
                size='sm'
                className='-ml-3 h-8'
                onClick={() => handleSort('created_at')}
              >
                Created
                <ArrowUpDown className='ml-2 h-4 w-4' />
              </Button>
            </TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAgents.map((agent) => (
            <TableRow key={agent.id}>
              <TableCell className='font-medium'>{agent.name}</TableCell>
              <TableCell>
                {agent.workspace ? (
                  <Badge variant='secondary' className='font-normal'>
                    {agent.workspace}
                  </Badge>
                ) : (
                  <span className='text-muted-foreground'>-</span>
                )}
              </TableCell>
              <TableCell className='text-right font-mono'>
                {formatCurrency(agent.total_cost)}
              </TableCell>
              <TableCell className='text-right font-mono text-muted-foreground'>
                {formatNumber(agent.total_input_tokens)}
              </TableCell>
              <TableCell className='text-right font-mono text-muted-foreground'>
                {formatNumber(agent.total_output_tokens)}
              </TableCell>
              <TableCell className='text-right'>
                <Badge variant='outline'>{agent.session_count}</Badge>
              </TableCell>
              <TableCell className='text-muted-foreground'>
                {formatDistanceToNow(new Date(agent.created_at), {
                  addSuffix: true,
                  locale: enUS,
                })}
              </TableCell>
              <TableCell>
                <Link
                  to='/agents/$agentId'
                  params={{ agentId: agent.id }}
                  className='inline-flex'
                >
                  <Button variant='ghost' size='icon' className='h-8 w-8'>
                    <ExternalLink className='h-4 w-4' />
                    <span className='sr-only'>View details</span>
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

AgentsTable.displayName = 'AgentsTable'
