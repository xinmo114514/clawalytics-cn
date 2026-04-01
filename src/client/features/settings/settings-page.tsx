import { Settings as SettingsIcon } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { LanguageSwitch } from '@/components/language-switch'
import { useLocale } from '@/context/locale-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AppearanceSettings } from './components/appearance-settings'
import { OpenClawSettings } from './components/openclaw-settings'

export function SettingsPage() {
  const { text } = useLocale()

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <SettingsIcon className='h-6 w-6' />
          <span className='font-jersey text-xl'>
            {text('设置', 'Settings')}
          </span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>
            {text('设置', 'Settings')}
          </h1>
          <p className='text-muted-foreground'>
            {text('管理应用的外观和行为', 'Manage app appearance and behavior')}
          </p>
        </div>

        <div className='space-y-6'>
          <OpenClawSettings />
          <AppearanceSettings />
        </div>
      </Main>
    </>
  )
}

export function SettingsItem({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1'>
      <Label className='text-base'>{label}</Label>
      {description && (
        <p className='text-sm text-muted-foreground'>{description}</p>
      )}
      <div className='mt-2'>{children}</div>
    </div>
  )
}

export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className='space-y-6'>{children}</CardContent>
    </Card>
  )
}
