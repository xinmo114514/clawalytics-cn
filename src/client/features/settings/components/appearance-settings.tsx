import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocale } from '@/context/locale-provider'
import { useTheme, colorThemes } from '@/context/theme-provider'
import { useFont } from '@/context/font-provider'
import { fonts } from '@/config/fonts'
import { SettingsCard, SettingsItem } from '../settings-page'
import { Button } from '@/components/ui/button'

const themeOptions = [
  { value: 'light', zh: '浅色', en: 'Light', icon: Sun },
  { value: 'dark', zh: '深色', en: 'Dark', icon: Moon },
  { value: 'system', zh: '跟随系统', en: 'System', icon: Monitor },
] as const

const localeOptions = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
] as const

const fontNames: Record<string, { zh: string; en: string }> = {
  inter: { zh: 'Inter', en: 'Inter' },
  manrope: { zh: 'Manrope', en: 'Manrope' },
  system: { zh: '系统默认', en: 'System Default' },
}

const colorThemeStyles: Record<string, string> = {
  blue: 'bg-sky-500',
  purple: 'bg-violet-500',
  green: 'bg-emerald-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  windows: 'bg-gradient-to-br from-blue-500 to-purple-500',
}

export function AppearanceSettings() {
  const { text } = useLocale()
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme()
  const { locale, setLocale } = useLocale()
  const { font, setFont } = useFont()

  return (
    <SettingsCard
      title={text('外观', 'Appearance')}
      description={text('自定义应用的外观设置', 'Customize the appearance of the app')}
    >
      <SettingsItem
        label={text('主题', 'Theme')}
        description={text('选择应用的显示主题', 'Choose the display theme for the app')}
      >
        <div className='flex gap-2'>
          {themeOptions.map((option) => {
            const Icon = option.icon
            const isActive = theme === option.value
            return (
              <Button
                key={option.value}
                variant={isActive ? 'default' : 'outline'}
                className={cn(
                  'flex h-auto flex-col gap-2 px-6 py-4',
                  isActive && 'ring-2 ring-primary'
                )}
                onClick={() => setTheme(option.value)}
              >
                <Icon className='h-5 w-5' />
                <span className='text-sm'>{text(option.zh, option.en)}</span>
                {isActive && (
                  <Check className='absolute right-2 top-2 h-4 w-4' />
                )}
              </Button>
            )
          })}
        </div>
      </SettingsItem>

      <SettingsItem
        label={text('主色调', 'Accent Color')}
        description={text('选择应用的主色调', 'Choose the accent color for the app')}
      >
        <div className='flex gap-2'>
          {colorThemes.map((option) => {
            const isActive = colorTheme === option.value
            return (
              <Button
                key={option.value}
                variant={isActive ? 'default' : 'outline'}
                className={cn(
                  'flex h-auto flex-col gap-2 px-6 py-4',
                  isActive && 'ring-2 ring-primary'
                )}
                onClick={() => setColorTheme(option.value)}
              >
                <div
                  className={cn('h-5 w-5 rounded-full', colorThemeStyles[option.value])}
                />
                <span className='text-sm'>{text(option.zh, option.en)}</span>
                {isActive && (
                  <Check className='absolute right-2 top-2 h-4 w-4' />
                )}
              </Button>
            )
          })}
        </div>
      </SettingsItem>

      <SettingsItem
        label={text('语言', 'Language')}
        description={text('选择应用的显示语言', 'Choose the display language for the app')}
      >
        <div className='flex items-center rounded-full border border-white/12 bg-white/45 p-1 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.72)] backdrop-blur-xl dark:bg-white/8'>
          {localeOptions.map((option) => (
            <Button
              key={option.value}
              variant={locale === option.value ? 'secondary' : 'ghost'}
              size='sm'
              className='h-7 rounded-full px-4 text-xs'
              onClick={() => setLocale(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </SettingsItem>

      <SettingsItem
        label={text('字体', 'Font')}
        description={text('选择应用的显示字体', 'Choose the display font for the app')}
      >
        <div className='flex gap-2'>
          {fonts.map((fontOption) => {
            const isActive = font === fontOption
            return (
              <Button
                key={fontOption}
                variant={isActive ? 'default' : 'outline'}
                className={cn(
                  'relative px-6 py-3',
                  isActive && 'ring-2 ring-primary'
                )}
                style={{ fontFamily: fontOption === 'system' ? undefined : `var(--font-${fontOption})` }}
                onClick={() => setFont(fontOption)}
              >
                {text(fontNames[fontOption]?.zh || fontOption, fontNames[fontOption]?.en || fontOption)}
                {isActive && (
                  <Check className='absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2' />
                )}
              </Button>
            )
          })}
        </div>
      </SettingsItem>
    </SettingsCard>
  )
}
