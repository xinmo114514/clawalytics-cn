import { useEffect, useState } from 'react'
import { Power, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { isWindowsDesktopShell } from '@/components/layout/desktop-window-chrome'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useLocale } from '@/context/locale-provider'
import {
  getApiErrorMessage,
  getDesktopPreferences,
  updateDesktopPreferences,
  type DesktopPreferences,
  type DesktopStartupMode,
} from '@/lib/api'
import { SettingsCard, SettingsItem } from '../settings-page'

const DEFAULT_STARTUP_MODE: DesktopStartupMode = 'window'

export function DesktopSettings() {
  const { text } = useLocale()
  const [preferences, setPreferences] = useState<DesktopPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isWindowsDesktopShell()) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadPreferences() {
      try {
        const nextPreferences = await getDesktopPreferences()
        if (!cancelled) {
          setPreferences(nextPreferences)
        }
      } catch (error) {
        console.error('Failed to load desktop preferences:', error)
        if (!cancelled) {
          toast.error(
            getApiErrorMessage(
              error,
              text('\u52a0\u8f7d\u684c\u9762\u8bbe\u7f6e\u5931\u8d25', 'Failed to load desktop settings')
            )
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadPreferences()

    return () => {
      cancelled = true
    }
  }, [text])

  if (!isWindowsDesktopShell()) {
    return null
  }

  async function savePreferences(
    updates: Partial<DesktopPreferences>,
    successMessage: string
  ) {
    try {
      setIsSaving(true)
      const nextPreferences = await updateDesktopPreferences(updates)
      setPreferences(nextPreferences)
      toast.success(successMessage)
    } catch (error) {
      console.error('Failed to save desktop preferences:', error)
      toast.error(
        getApiErrorMessage(
          error,
          text('\u4fdd\u5b58\u684c\u9762\u8bbe\u7f6e\u5931\u8d25', 'Failed to save desktop settings')
        )
      )
    } finally {
      setIsSaving(false)
    }
  }

  const launchOnStartup = preferences?.launchOnStartup ?? false
  const startupMode = preferences?.startupMode ?? DEFAULT_STARTUP_MODE
  const controlsDisabled = isLoading || isSaving || !preferences

  return (
    <SettingsCard
      title={text('\u684c\u9762\u542f\u52a8', 'Desktop Startup')}
      description={text(
        '\u914d\u7f6e Windows \u684c\u9762\u7248\u7684\u5f00\u673a\u81ea\u542f\u548c\u542f\u52a8\u65b9\u5f0f',
        'Configure launch-at-startup behavior for the Windows desktop app'
      )}
    >
      <SettingsItem
        label={text('\u5f00\u673a\u81ea\u542f', 'Launch at startup')}
        description={text(
          '\u767b\u5f55 Windows \u540e\u81ea\u52a8\u542f\u52a8 Clawalytics',
          'Automatically start Clawalytics after you sign in to Windows'
        )}
      >
        <div className='flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/15 p-4'>
          <div className='space-y-1'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <Power className='size-4 text-muted-foreground' />
              <span>{text('\u542f\u7528\u5f00\u673a\u81ea\u542f', 'Enable launch at startup')}</span>
            </div>
            <p className='text-sm text-muted-foreground'>
              {text(
                '\u5f00\u542f\u540e\uff0cClawalytics \u4f1a\u5728 Windows \u767b\u5f55\u540e\u81ea\u52a8\u8fd0\u884c',
                'When enabled, Clawalytics will start automatically after Windows sign-in'
              )}
            </p>
          </div>
          <Switch
            checked={launchOnStartup}
            disabled={controlsDisabled}
            onCheckedChange={(checked) => {
              void savePreferences(
                { launchOnStartup: checked === true },
                checked === true
                  ? text('\u5df2\u5f00\u542f\u5f00\u673a\u81ea\u542f', 'Launch at startup enabled')
                  : text('\u5df2\u5173\u95ed\u5f00\u673a\u81ea\u542f', 'Launch at startup disabled')
              )
            }}
            aria-label={text('\u5207\u6362\u5f00\u673a\u81ea\u542f', 'Toggle launch at startup')}
          />
        </div>
      </SettingsItem>

      <SettingsItem
        label={text('\u542f\u52a8\u65b9\u5f0f', 'Startup mode')}
        description={text(
          '\u9009\u62e9\u5f00\u673a\u81ea\u542f\u65f6\u76f4\u63a5\u6253\u5f00\u4e3b\u7a97\u53e3\uff0c\u8fd8\u662f\u9759\u9ed8\u542f\u52a8\u5230\u6258\u76d8',
          'Choose whether startup opens the main window or starts quietly in the tray'
        )}
      >
        <div className='rounded-xl border border-border/70 bg-muted/15 p-4'>
          <div className='mb-3 flex items-center gap-2 text-sm font-medium'>
            <Rocket className='size-4 text-muted-foreground' />
            <span>{text('\u81ea\u542f\u540e\u7684\u6253\u5f00\u65b9\u5f0f', 'How the app opens after startup')}</span>
          </div>
          <Select
            value={startupMode}
            disabled={controlsDisabled || !launchOnStartup}
            onValueChange={(value) => {
              void savePreferences(
                { startupMode: value as DesktopStartupMode },
                text('\u5df2\u66f4\u65b0\u542f\u52a8\u65b9\u5f0f', 'Startup mode updated')
              )
            }}
          >
            <SelectTrigger className='w-full bg-background'>
              <SelectValue
                placeholder={text('\u9009\u62e9\u542f\u52a8\u65b9\u5f0f', 'Select startup mode')}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='window'>
                {text('\u663e\u793a\u4e3b\u7a97\u53e3', 'Open main window')}
              </SelectItem>
              <SelectItem value='tray'>
                {text('\u6700\u5c0f\u5316\u5230\u6258\u76d8', 'Start in tray')}
              </SelectItem>
            </SelectContent>
          </Select>

          {!launchOnStartup && (
            <p className='mt-3 text-sm text-muted-foreground'>
              {text(
                '\u5148\u5f00\u542f\u201c\u5f00\u673a\u81ea\u542f\u201d\uff0c\u624d\u80fd\u914d\u7f6e\u542f\u52a8\u65b9\u5f0f',
                'Enable launch at startup first to choose how the app starts'
              )}
            </p>
          )}
        </div>
      </SettingsItem>
    </SettingsCard>
  )
}
