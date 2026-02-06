import { ArrowUpDown } from 'lucide-react'
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
import type { Channel } from '@/lib/api'

interface ChannelsTableProps {
  channels: Channel[]
}

type SortField = 'name' | 'total_cost' | 'message_count'
type SortDirection = 'asc' | 'desc'


export function ChannelsTable({ channels }: ChannelsTableProps) {
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

  const sortedChannels = [...channels].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1

    switch (sortField) {
      case 'name':
        return multiplier * a.name.localeCompare(b.name)
      case 'total_cost':
        return multiplier * (a.total_cost - b.total_cost)
      case 'message_count':
        return multiplier * (a.message_count - b.message_count)
      default:
        return 0
    }
  })

  if (channels.length === 0) {
    return (
      <div className='flex h-32 items-center justify-center text-muted-foreground'>
        No channels found. Connect OpenClaw with a messaging service.
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
                Channel
                <ArrowUpDown className='ml-2 h-4 w-4' />
              </Button>
            </TableHead>
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
                onClick={() => handleSort('message_count')}
              >
                Messages
                <ArrowUpDown className='ml-2 h-4 w-4' />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedChannels.map((channel) => (
            <TableRow key={channel.id}>
              <TableCell>
                <span className='font-jersey text-base uppercase'>
                  {channel.name}
                </span>
              </TableCell>
              <TableCell className='text-right font-mono'>
                {formatCurrency(channel.total_cost)}
              </TableCell>
              <TableCell className='text-right font-mono text-muted-foreground'>
                {formatNumber(channel.total_input_tokens)}
              </TableCell>
              <TableCell className='text-right font-mono text-muted-foreground'>
                {formatNumber(channel.total_output_tokens)}
              </TableCell>
              <TableCell className='text-right font-mono'>
                {formatNumber(channel.message_count)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

ChannelsTable.displayName = 'ChannelsTable'
