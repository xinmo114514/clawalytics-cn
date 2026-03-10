import { useQuery } from '@tanstack/react-query'
import { DollarSign, Coins, Layers, Building2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/format'
import { getModels, getModelStats, getProviderSummary, getModelDailyUsage } from '@/lib/api'
import { ModelsTable } from '@/features/models/components/models-table'
import { ModelCostChart } from '@/features/models/components/model-cost-chart'
import { ProviderDistributionChart } from '@/features/models/components/provider-distribution-chart'

interface ModelsTabProps {
  enabled: boolean
}

export function ModelsTab({ enabled }: ModelsTabProps) {
  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => getModels(30),
    refetchInterval: 10000,
    enabled,
  })

  const { data: modelStats, isLoading: statsLoading } = useQuery({
    queryKey: ['modelStats'],
    queryFn: () => getModelStats(30),
    refetchInterval: 10000,
    enabled,
  })

  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => getProviderSummary(30),
    refetchInterval: 10000,
    enabled,
  })

  const { data: dailyUsage, isLoading: dailyLoading } = useQuery({
    queryKey: ['modelDailyUsage'],
    queryFn: () => getModelDailyUsage(30),
    refetchInterval: 10000,
    enabled,
  })

  const totalCost = models?.reduce((acc, m) => acc + m.cost, 0) ?? 0
  const totalInputTokens = models?.reduce((acc, m) => acc + m.inputTokens, 0) ?? 0
  const totalOutputTokens = models?.reduce((acc, m) => acc + m.outputTokens, 0) ?? 0

  return (
    <div className='space-y-6'>
      {/* Stats Cards Row */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>模型总成本</CardTitle>
            <div className='rounded-full bg-red-500/10 p-2'>
              <DollarSign className='h-4 w-4 text-red-500' />
            </div>
          </CardHeader>
          <CardContent>
            {modelsLoading ? (
              <>
                <Skeleton className='h-8 w-24 mb-1' />
                <Skeleton className='h-4 w-32' />
              </>
            ) : (
              <>
                <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                  {formatCurrency(totalCost)}
                </div>
                <p className='text-xs text-muted-foreground'>最近 30 天</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>已使用模型</CardTitle>
            <div className='rounded-full bg-rose-500/10 p-2'>
              <Layers className='h-4 w-4 text-rose-500' />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <>
                <Skeleton className='h-8 w-16 mb-1' />
                <Skeleton className='h-4 w-24' />
              </>
            ) : (
              <>
                <div className='text-2xl font-bold text-rose-600 dark:text-rose-400'>
                  {modelStats?.totalModels ?? 0}
                </div>
                <p className='text-xs text-muted-foreground'>
                  来自 {modelStats?.totalProviders ?? 0} 个提供商
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>总 Token 数</CardTitle>
            <div className='rounded-full bg-red-500/10 p-2'>
              <Coins className='h-4 w-4 text-red-500' />
            </div>
          </CardHeader>
          <CardContent>
            {modelsLoading ? (
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
                  输入 {formatNumber(totalInputTokens)} / 输出 {formatNumber(totalOutputTokens)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>主要提供商</CardTitle>
            <div className='rounded-full bg-red-500/10 p-2'>
              <Building2 className='h-4 w-4 text-red-500' />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <>
                <Skeleton className='h-8 w-24 mb-1' />
                <Skeleton className='h-4 w-32' />
              </>
            ) : (
              <>
                <div className='text-2xl font-bold text-red-600 dark:text-red-400 capitalize'>
                  {modelStats?.topProvider?.provider ?? '暂无'}
                </div>
                <p className='text-xs text-muted-foreground'>
                  {modelStats?.topProvider
                    ? `${formatCurrency(modelStats.topProvider.cost)} (${modelStats.topProvider.modelCount} models)`
                    : '暂无数据'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-7'>
        <Card className='col-span-1 lg:col-span-4'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <DollarSign className='h-5 w-5' />
              按模型查看每日成本
            </CardTitle>
            <CardDescription>最近 30 天的模型成本</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            {dailyLoading ? (
              <Skeleton className='h-[300px] w-full' />
            ) : (
              <ModelCostChart data={dailyUsage ?? []} />
            )}
          </CardContent>
        </Card>

        <Card className='col-span-1 lg:col-span-3'>
          <CardHeader>
            <CardTitle>提供商成本分布</CardTitle>
            <CardDescription>不同提供商的成本占比</CardDescription>
          </CardHeader>
          <CardContent>
            {providersLoading ? (
              <Skeleton className='h-[300px] w-full' />
            ) : (
              <ProviderDistributionChart providers={providers ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Models Table */}
      <Card>
        <CardHeader>
          <CardTitle>全部模型</CardTitle>
          <CardDescription>最近 30 天所有模型的使用情况与成本</CardDescription>
        </CardHeader>
        <CardContent>
          {modelsLoading ? (
            <div className='space-y-4'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : (
            <ModelsTable models={models ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
