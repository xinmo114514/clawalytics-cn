import { useQuery } from '@tanstack/react-query'
import { DollarSign, Coins, MessageSquare, Mail } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/format'
import { getChannelStats } from '@/lib/api'
import { ChannelComparisonChart } from '@/features/channels/components/channel-comparison-chart'
import { ChannelsTable } from '@/features/channels/components/channels-table'

interface ChannelsTabProps {
  enabled: boolean
}

export function ChannelsTab({ enabled }: ChannelsTabProps) {
  const { data: channelStats, isLoading } = useQuery({
    queryKey: ['channelStats'],
    queryFn: () => getChannelStats(50),
    refetchInterval: 10000,
    enabled,
  })

  const channels = channelStats?.channels ?? []
  const totalInputTokens = channels.reduce((acc, c) => acc + c.total_input_tokens, 0)
  const totalOutputTokens = channels.reduce((acc, c) => acc + c.total_output_tokens, 0)

  return (
    <div className='space-y-6'>
      {/* Stats Cards Row */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Channel Costs</CardTitle>
            <div className='rounded-full bg-red-500/10 p-2'>
              <DollarSign className='h-4 w-4 text-red-500' />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
                <Skeleton className='h-8 w-24 mb-1' />
                <Skeleton className='h-4 w-32' />
              </>
            ) : (
              <>
                <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                  {formatCurrency(channelStats?.totalCost ?? 0)}
                </div>
                <p className='text-xs text-muted-foreground'>All channels combined</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Number of Channels</CardTitle>
            <div className='rounded-full bg-rose-500/10 p-2'>
              <MessageSquare className='h-4 w-4 text-rose-500' />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
                <Skeleton className='h-8 w-16 mb-1' />
                <Skeleton className='h-4 w-24' />
              </>
            ) : (
              <>
                <div className='text-2xl font-bold text-rose-600 dark:text-rose-400'>{channels.length}</div>
                <p className='text-xs text-muted-foreground'>Active channels</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Tokens</CardTitle>
            <div className='rounded-full bg-red-500/10 p-2'>
              <Coins className='h-4 w-4 text-red-500' />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
                <Skeleton className='h-8 w-24 mb-1' />
                <Skeleton className='h-4 w-32' />
              </>
            ) : (
              <>
                <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                  {formatNumber(totalInputTokens + totalOutputTokens)}
                </div>
                <p className='text-xs text-muted-foreground'>
                  {formatNumber(totalInputTokens)} in / {formatNumber(totalOutputTokens)} out
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Messages</CardTitle>
            <div className='rounded-full bg-red-500/10 p-2'>
              <Mail className='h-4 w-4 text-red-500' />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
                <Skeleton className='h-8 w-16 mb-1' />
                <Skeleton className='h-4 w-24' />
              </>
            ) : (
              <>
                <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                  {formatNumber(channelStats?.totalMessages ?? 0)}
                </div>
                <p className='text-xs text-muted-foreground'>Processed messages</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts and Table Row */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Cost Comparison</CardTitle>
            <CardDescription>Costs by messaging channel</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className='h-[300px] w-full' />
            ) : (
              <ChannelComparisonChart channels={channels} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Channels</CardTitle>
            <CardDescription>Detailed overview of all channels</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='space-y-4'>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className='h-12 w-full' />
                ))}
              </div>
            ) : (
              <ChannelsTable channels={channels} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
