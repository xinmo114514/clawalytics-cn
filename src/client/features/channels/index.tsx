import { useQuery } from '@tanstack/react-query'
import { DollarSign, Coins, Mail, MessageSquare } from 'lucide-react'
import { ChannelsIcon } from '@/components/icons/channels-icon'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { getChannelStats } from '@/lib/api'
import { ChannelsTable } from './components/channels-table'
import { ChannelComparisonChart } from './components/channel-comparison-chart'

export function Channels() {
  const { data: channelStats, isLoading } = useQuery({
    queryKey: ['channelStats'],
    queryFn: () => getChannelStats(50),
    refetchInterval: 10000,
  })

  const formatCurrency = (value: number): string => {
    if (value >= 100) return `$${value.toFixed(0)}`
    if (value >= 10) return `$${value.toFixed(1)}`
    if (value >= 1) return `$${value.toFixed(2)}`
    if (value >= 0.01) return `$${value.toFixed(2)}`
    return `$${value.toFixed(4)}`
  }

  const formatNumber = (value: number): string => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toString()
  }

  const channels = channelStats?.channels ?? []
  const totalInputTokens = channels.reduce(
    (acc, c) => acc + c.total_input_tokens,
    0
  )
  const totalOutputTokens = channels.reduce(
    (acc, c) => acc + c.total_output_tokens,
    0
  )

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <ChannelsIcon active className='h-6 w-6' />
          <span className='font-semibold text-lg'>Channels</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              Channel Overview
            </h1>
            <p className='text-muted-foreground'>
              Costs and usage by messaging channel
            </p>
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6'>
          {/* Total Cost Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Channel Costs
              </CardTitle>
              <DollarSign className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className='h-8 w-24 mb-1' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {formatCurrency(channelStats?.totalCost ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    All channels combined
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Channels Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Number of Channels
              </CardTitle>
              <MessageSquare className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>{channels.length}</div>
                  <p className='text-xs text-muted-foreground'>
                    Active channels
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Tokens Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Tokens
              </CardTitle>
              <Coins className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className='h-8 w-24 mb-1' />
                  <Skeleton className='h-4 w-32' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {formatNumber(totalInputTokens + totalOutputTokens)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {formatNumber(totalInputTokens)} in /{' '}
                    {formatNumber(totalOutputTokens)} out
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Messages Card */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Messages
              </CardTitle>
              <Mail className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className='h-8 w-16 mb-1' />
                  <Skeleton className='h-4 w-24' />
                </>
              ) : (
                <>
                  <div className='text-2xl font-bold'>
                    {formatNumber(channelStats?.totalMessages ?? 0)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Processed messages
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts and Table Row */}
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6'>
          {/* Channel Comparison Chart */}
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

          {/* Channels Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Channels</CardTitle>
              <CardDescription>
                Detailed overview of all channels
              </CardDescription>
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

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>About Channels</CardTitle>
            <CardDescription>
              How channel cost analysis works
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='prose prose-sm dark:prose-invert max-w-none'>
              <p className='text-muted-foreground'>
                Channels represent the various messaging platforms through which
                OpenClaw receives and responds to messages. Each platform is
                tracked separately to give you a clear overview of cost
                distribution.
              </p>
              <ul className='mt-4 space-y-2 text-sm text-muted-foreground'>
                <li className='flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-green-500' />
                  <strong>WhatsApp</strong> - Business API Integration
                </li>
                <li className='flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-blue-500' />
                  <strong>Telegram</strong> - Bot API Integration
                </li>
                <li className='flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-purple-500' />
                  <strong>Slack</strong> - Workspace App Integration
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

Channels.displayName = 'Channels'
