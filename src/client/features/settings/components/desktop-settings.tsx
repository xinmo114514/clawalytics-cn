import { useEffect, useState } from 'react'
import { Bell, Clock3, Power, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { isWindowsDesktopShell } from '@/components/layout/desktop-window-chrome'
import { Input } from '@/components/ui/input'
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
  type DesktopNotificationTrigger,
  updateDesktopPreferences,
  type DesktopPreferences,
  type DesktopStartupMode,
} from '@/lib/api'
import { SettingsCard, SettingsItem } from '../settings-page'

const DEFAULT_STARTUP_MODE: DesktopStartupMode = 'window'
const DEFAULT_NOTIFICATIONS_ENABLED = true
const DEFAULT_NOTIFICATION_TRIGGER: DesktopNotificationTrigger = 'activity'
const DEFAULT_NOTIFICATION_DELAY_SECONDS = 30
const MIN_NOTIFICATION_DELAY_SECONDS = 5
const MAX_NOTIFICATION_DELAY_SECONDS = 3600

function normalizeNotificationDelaySeconds(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? ''), 10)

  if (!Number.isFinite(parsed)) {
    return DEFAULT_NOTIFICATION_DELAY_SECONDS
  }

  return Math.min(
    MAX_NOTIFICATION_DELAY_SECONDS,
    Math.max(MIN_NOTIFICATION_DELAY_SECONDS, Math.round(parsed))
  )
}

export function DesktopSettings() {
  const { text } = useLocale()
  const [preferences, setPreferences] = useState<DesktopPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notificationDelayInput, setNotificationDelayInput] = useState(
    String(DEFAULT_NOTIFICATION_DELAY_SECONDS)
  )

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
              text('加载桌面设置失败', 'Failed to load desktop settings')
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

  useEffect(() => {
    if (preferences?.notificationDelaySeconds !== undefined) {
      setNotificationDelayInput(String(preferences.notificationDelaySeconds))
    }
  }, [preferences?.notificationDelaySeconds])

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
          text('保存桌面设置失败', 'Failed to save desktop settings')
        )
      )
    } finally {
      setIsSaving(false)
    }
  }

  const launchOnStartup = preferences?.launchOnStartup ?? false
  const startupMode = preferences?.startupMode ?? DEFAULT_STARTUP_MODE
  const notificationsEnabled = preferences?.notificationsEnabled ?? DEFAULT_NOTIFICATIONS_ENABLED
  const notificationTrigger = preferences?.notificationTrigger ?? DEFAULT_NOTIFICATION_TRIGGER
  const notificationDelaySeconds =
    preferences?.notificationDelaySeconds ?? DEFAULT_NOTIFICATION_DELAY_SECONDS
  const controlsDisabled = isLoading || isSaving || !preferences

  async function saveNotificationDelay(value: string) {
    const normalized = normalizeNotificationDelaySeconds(value)
    setNotificationDelayInput(String(normalized))

    if (normalized === notificationDelaySeconds) {
      return
    }

    await savePreferences(
      { notificationDelaySeconds: normalized },
      text('已更新通知延迟时间', 'Notification delay updated')
    )
  }

  return (
    <>
      <SettingsCard
        title={text('桌面启动', 'Desktop Startup')}
        description={text(
          '配置 Windows 桌面版的开机自启和启动方式',
          'Configure launch-at-startup behavior for the Windows desktop app'
        )}
      >
        <SettingsItem
          label={text('开机自启', 'Launch at startup')}
          description={text(
            '登录 Windows 后自动启动 Clawalytics',
            'Automatically start Clawalytics after you sign in to Windows'
          )}
        >
          <div className='flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/15 p-4'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <Power className='size-4 text-muted-foreground' />
                <span>{text('启用开机自启', 'Enable launch at startup')}</span>
              </div>
              <p className='text-sm text-muted-foreground'>
                {text(
                  '开启后，Clawalytics 会在 Windows 登录后自动运行',
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
                    ? text('已开启开机自启', 'Launch at startup enabled')
                    : text('已关闭开机自启', 'Launch at startup disabled')
                )
              }}
              aria-label={text('切换开机自启', 'Toggle launch at startup')}
            />
          </div>
        </SettingsItem>

        <SettingsItem
          label={text('启动方式', 'Startup mode')}
          description={text(
            '选择开机自启时直接打开主窗口，还是静默启动到托盘',
            'Choose whether startup opens the main window or starts quietly in the tray'
          )}
        >
          <div className='rounded-xl border border-border/70 bg-muted/15 p-4'>
            <div className='mb-3 flex items-center gap-2 text-sm font-medium'>
              <Rocket className='size-4 text-muted-foreground' />
              <span>{text('自启后的打开方式', 'How the app opens after startup')}</span>
            </div>
            <Select
              value={startupMode}
              disabled={controlsDisabled || !launchOnStartup}
              onValueChange={(value) => {
                void savePreferences(
                  { startupMode: value as DesktopStartupMode },
                  text('已更新启动方式', 'Startup mode updated')
                )
              }}
            >
              <SelectTrigger className='w-full bg-background'>
                <SelectValue placeholder={text('选择启动方式', 'Select startup mode')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='window'>
                  {text('显示主窗口', 'Open main window')}
                </SelectItem>
                <SelectItem value='tray'>
                  {text('最小化到托盘', 'Start in tray')}
                </SelectItem>
              </SelectContent>
            </Select>

            {!launchOnStartup && (
              <p className='mt-3 text-sm text-muted-foreground'>
                {text(
                  '先开启“开机自启”，才能配置启动方式',
                  'Enable launch at startup first to choose how the app starts'
                )}
              </p>
            )}
          </div>
        </SettingsItem>
      </SettingsCard>

      <SettingsCard
        title={text('桌面通知', 'Desktop Notifications')}
        description={text(
          '配置 Clawalytics 原生系统通知的触发方式和提醒节奏',
          'Choose when Clawalytics sends native desktop notifications'
        )}
      >
        <SettingsItem
          label={text('通知开关', 'Notifications')}
          description={text(
            '在检测到新的 OpenClaw 用量变化时显示系统通知',
            'Show native notifications when Clawalytics detects new OpenClaw usage'
          )}
        >
          <div className='flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/15 p-4'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <Bell className='size-4 text-muted-foreground' />
                <span>{text('启用桌面通知', 'Enable desktop notifications')}</span>
              </div>
              <p className='text-sm text-muted-foreground'>
                {text(
                  '开启后，Clawalytics 会在后台汇总新的用量变化并推送原生通知',
                  'When enabled, Clawalytics will summarize new usage activity and send native notifications'
                )}
              </p>
            </div>
            <Switch
              checked={notificationsEnabled}
              disabled={controlsDisabled}
              onCheckedChange={(checked) => {
                void savePreferences(
                  { notificationsEnabled: checked === true },
                  checked === true
                    ? text('已开启桌面通知', 'Desktop notifications enabled')
                    : text('已关闭桌面通知', 'Desktop notifications disabled')
                )
              }}
              aria-label={text('切换桌面通知', 'Toggle desktop notifications')}
            />
          </div>
        </SettingsItem>

        <SettingsItem
          label={text('通知触发条件', 'Notification trigger')}
          description={text(
            '选择哪些类型的新增用量会触发桌面通知',
            'Choose which kinds of new usage changes should trigger a notification'
          )}
        >
          <div className='rounded-xl border border-border/70 bg-muted/15 p-4'>
            <div className='mb-3 flex items-center gap-2 text-sm font-medium'>
              <Bell className='size-4 text-muted-foreground' />
              <span>{text('触发方式', 'Trigger condition')}</span>
            </div>
            <Select
              value={notificationTrigger}
              disabled={controlsDisabled || !notificationsEnabled}
              onValueChange={(value) => {
                void savePreferences(
                  { notificationTrigger: value as DesktopNotificationTrigger },
                  text('已更新通知触发条件', 'Notification trigger updated')
                )
              }}
            >
              <SelectTrigger className='w-full bg-background'>
                <SelectValue
                  placeholder={text('选择通知触发条件', 'Select a notification trigger')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='activity'>
                  {text('任意新增用量', 'Any usage change')}
                </SelectItem>
                <SelectItem value='cost'>
                  {text('仅新增成本', 'Cost changes only')}
                </SelectItem>
                <SelectItem value='tokens'>
                  {text('仅新增 Token', 'Token changes only')}
                </SelectItem>
                <SelectItem value='both'>
                  {text('成本和 Token 同时变化', 'Cost and tokens both change')}
                </SelectItem>
              </SelectContent>
            </Select>

            {!notificationsEnabled && (
              <p className='mt-3 text-sm text-muted-foreground'>
                {text(
                  '先开启桌面通知，才能继续配置触发条件',
                  'Enable desktop notifications first to configure the trigger'
                )}
              </p>
            )}
          </div>
        </SettingsItem>

        <SettingsItem
          label={text('通知延迟（秒）', 'Notification delay (seconds)')}
          description={text(
            '检测到新用量后等待多少秒再汇总推送一条通知',
            'Wait this many seconds after new usage is detected before sending one summarized notification'
          )}
        >
          <div className='rounded-xl border border-border/70 bg-muted/15 p-4'>
            <div className='mb-3 flex items-center gap-2 text-sm font-medium'>
              <Clock3 className='size-4 text-muted-foreground' />
              <span>{text('通知节奏', 'Notification timing')}</span>
            </div>
            <Input
              type='number'
              min={MIN_NOTIFICATION_DELAY_SECONDS}
              max={MAX_NOTIFICATION_DELAY_SECONDS}
              step={5}
              value={notificationDelayInput}
              disabled={controlsDisabled || !notificationsEnabled}
              className='bg-background'
              onChange={(event) => {
                setNotificationDelayInput(event.target.value)
              }}
              onBlur={() => {
                void saveNotificationDelay(notificationDelayInput)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') {
                  return
                }

                event.preventDefault()
                void saveNotificationDelay(notificationDelayInput)
              }}
              aria-label={text('设置通知延迟秒数', 'Set notification delay in seconds')}
            />
            <p className='mt-3 text-sm text-muted-foreground'>
              {text(
                `支持 ${MIN_NOTIFICATION_DELAY_SECONDS}-${MAX_NOTIFICATION_DELAY_SECONDS} 秒，推荐 30 秒左右`,
                `Supported range: ${MIN_NOTIFICATION_DELAY_SECONDS}-${MAX_NOTIFICATION_DELAY_SECONDS} seconds; 30 seconds is a good default`
              )}
            </p>
          </div>
        </SettingsItem>
      </SettingsCard>
    </>
  )
}
