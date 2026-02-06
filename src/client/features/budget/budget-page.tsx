import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Save, Loader2 } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { formatCurrency } from '@/lib/format'
import {
  getConfig,
  updateConfig,
  getBudgetStatus,
  type BudgetPeriod,
} from '@/lib/api'
import { toast } from 'sonner'

export function BudgetPage() {
  const queryClient = useQueryClient()

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
  })

  const { data: budgetStatus, isLoading: budgetLoading } = useQuery({
    queryKey: ['budgetStatus'],
    queryFn: getBudgetStatus,
    refetchInterval: 10000,
  })

  const [daily, setDaily] = useState('')
  const [weekly, setWeekly] = useState('')
  const [monthly, setMonthly] = useState('')
  const [dailyEnabled, setDailyEnabled] = useState(true)
  const [weeklyEnabled, setWeeklyEnabled] = useState(true)
  const [monthlyEnabled, setMonthlyEnabled] = useState(true)

  // Sync form state when config loads
  useEffect(() => {
    if (!config) return
    const t = config.alertThresholds
    setDaily(t.dailyBudget > 0 ? t.dailyBudget.toString() : '')
    setWeekly(t.weeklyBudget > 0 ? t.weeklyBudget.toString() : '')
    setMonthly(t.monthlyBudget > 0 ? t.monthlyBudget.toString() : '')
    setDailyEnabled(t.dailyBudget > 0)
    setWeeklyEnabled(t.weeklyBudget > 0)
    setMonthlyEnabled(t.monthlyBudget > 0)
  }, [config])

  const mutation = useMutation({
    mutationFn: (thresholds: {
      dailyBudget: number
      weeklyBudget: number
      monthlyBudget: number
    }) => updateConfig({ alertThresholds: thresholds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      queryClient.invalidateQueries({ queryKey: ['budgetStatus'] })
      toast.success('Budget updated')
    },
    onError: () => {
      toast.error('Failed to update budget')
    },
  })

  const handleSave = () => {
    mutation.mutate({
      dailyBudget: dailyEnabled ? (parseFloat(daily) || 0) : 0,
      weeklyBudget: weeklyEnabled ? (parseFloat(weekly) || 0) : 0,
      monthlyBudget: monthlyEnabled ? (parseFloat(monthly) || 0) : 0,
    })
  }

  const hasChanges = config
    ? (dailyEnabled ? (parseFloat(daily) || 0) : 0) !== config.alertThresholds.dailyBudget ||
      (weeklyEnabled ? (parseFloat(weekly) || 0) : 0) !== config.alertThresholds.weeklyBudget ||
      (monthlyEnabled ? (parseFloat(monthly) || 0) : 0) !== config.alertThresholds.monthlyBudget
    : false

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <DollarSign className='h-6 w-6' />
          <span className='font-jersey text-xl'>Budget</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Budget</h1>
          <p className='text-muted-foreground'>
            Set spending limits and track your budget usage
          </p>
        </div>

        {/* Budget Status Bars */}
        {budgetLoading ? (
          <div className='grid gap-4 sm:grid-cols-3 mb-6'>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className='h-24 w-full' />
            ))}
          </div>
        ) : budgetStatus && (budgetStatus.daily || budgetStatus.weekly || budgetStatus.monthly) ? (
          <div className='grid gap-4 sm:grid-cols-3 mb-6'>
            {budgetStatus.daily && (
              <BudgetBar label='Daily Budget' period={budgetStatus.daily} />
            )}
            {budgetStatus.weekly && (
              <BudgetBar label='Weekly Budget' period={budgetStatus.weekly} />
            )}
            {budgetStatus.monthly && (
              <BudgetBar label='Monthly Budget' period={budgetStatus.monthly} />
            )}
          </div>
        ) : (
          <Card className='mb-6'>
            <CardContent className='pt-6'>
              <p className='text-sm text-muted-foreground text-center'>
                No budgets configured yet. Set your limits below.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Budget Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Limits</CardTitle>
            <CardDescription>
              Set spending thresholds for alerts. Disable a period to turn off its alert.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {configLoading ? (
              <div className='space-y-6'>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className='h-12 w-full' />
                ))}
              </div>
            ) : (
              <div className='space-y-6'>
                <BudgetRow
                  label='Daily'
                  value={daily}
                  enabled={dailyEnabled}
                  onValueChange={setDaily}
                  onEnabledChange={setDailyEnabled}
                />
                <BudgetRow
                  label='Weekly'
                  value={weekly}
                  enabled={weeklyEnabled}
                  onValueChange={setWeekly}
                  onEnabledChange={setWeeklyEnabled}
                />
                <BudgetRow
                  label='Monthly'
                  value={monthly}
                  enabled={monthlyEnabled}
                  onValueChange={setMonthly}
                  onEnabledChange={setMonthlyEnabled}
                />

                <div className='flex justify-end pt-2'>
                  <Button
                    onClick={handleSave}
                    disabled={mutation.isPending || !hasChanges}
                  >
                    {mutation.isPending ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : (
                      <Save className='mr-2 h-4 w-4' />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

function BudgetRow({
  label,
  value,
  enabled,
  onValueChange,
  onEnabledChange,
}: {
  label: string
  value: string
  enabled: boolean
  onValueChange: (v: string) => void
  onEnabledChange: (v: boolean) => void
}) {
  return (
    <div className='flex items-center gap-4'>
      <Label className='w-20 text-sm font-medium'>{label}</Label>
      <div className='relative flex-1 max-w-[200px]'>
        <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'>
          $
        </span>
        <Input
          type='number'
          min='0'
          step='0.01'
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={!enabled}
          className='pl-7'
          placeholder='0.00'
        />
      </div>
      <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      <span className='text-sm text-muted-foreground w-16'>
        {enabled ? 'Active' : 'Off'}
      </span>
    </div>
  )
}

function BudgetBar({
  label,
  period,
}: {
  label: string
  period: BudgetPeriod
}) {
  const color =
    period.percent >= 90
      ? 'bg-red-500'
      : period.percent >= 70
        ? 'bg-yellow-500'
        : 'bg-green-500'

  const textColor =
    period.percent >= 90
      ? 'text-red-600 dark:text-red-400'
      : period.percent >= 70
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-green-600 dark:text-green-400'

  return (
    <Card className='p-4'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-sm font-medium'>{label}</span>
        <span className={`text-sm font-semibold ${textColor}`}>
          {formatCurrency(period.spent)} / {formatCurrency(period.budget)}
        </span>
      </div>
      <div className='relative h-2 w-full overflow-hidden rounded-full bg-muted'>
        <div
          className={`h-full transition-all ${color}`}
          style={{ width: `${Math.min(100, period.percent)}%` }}
        />
      </div>
      <p className='text-xs text-muted-foreground mt-1'>
        {period.percent.toFixed(0)}% used
      </p>
    </Card>
  )
}
