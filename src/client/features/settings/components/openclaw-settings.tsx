import { useCallback, useEffect, useState } from 'react'
import { Check, FolderOpen, Monitor, RefreshCw, Terminal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useLocale } from '@/context/locale-provider'
import {
  getApiErrorMessage,
  getConfig,
  reloadOpenClawData,
  updateConfig,
  type Config,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SettingsCard, SettingsItem } from '../settings-page'

type ValidationStatus = 'idle' | 'valid' | 'invalid'
type DataSourceMode = 'windows' | 'wsl'

const DEFAULT_WSL_OPENCLAW_PATH = '~/.openclaw'
const DEFAULT_WSL_DISTRO = 'Ubuntu'
const WINDOWS_PATH_PLACEHOLDER = 'C:\\Users\\you\\.openclaw'
const WSL_PATH_PLACEHOLDER = '~/.openclaw or /home/you/.openclaw'

function isWslHostPath(value?: string) {
  return /^\\\\wsl(?:\.localhost|\$)?\\/i.test((value || '').trim())
}

function getWindowsOpenClawPath(config: Config) {
  if (config.openClawPath && !isWslHostPath(config.openClawPath)) {
    return config.openClawPath
  }

  if (config.defaultOpenClawPath && !isWslHostPath(config.defaultOpenClawPath)) {
    return config.defaultOpenClawPath
  }

  return ''
}

function buildWslHostPathPreview(distro: string, linuxPath: string) {
  const normalizedDistro = distro.trim() || DEFAULT_WSL_DISTRO
  const normalizedLinuxPath = (linuxPath.trim() || DEFAULT_WSL_OPENCLAW_PATH)
    .replace(/^~(?=\/|$)/, '/home/<user>')
    .replace(/^\/+/, '')
    .replace(/\//g, '\\')

  return `\\\\wsl.localhost\\${normalizedDistro}\\${normalizedLinuxPath}`
}

export function OpenClawSettings() {
  const { text } = useLocale()
  const [openClawPath, setOpenClawPath] = useState('')
  const [defaultOpenClawPath, setDefaultOpenClawPath] = useState('')
  const [wslEnabled, setWslEnabled] = useState(false)
  const [wslDistro, setWslDistro] = useState(DEFAULT_WSL_DISTRO)
  const [wslOpenClawPath, setWslOpenClawPath] = useState('')
  const [lastValidationMessage, setLastValidationMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true)
      const config = await getConfig()
      const nextWslEnabled = Boolean(config.wsl?.enabled)
      const nextWindowsPath = getWindowsOpenClawPath(config)

      setOpenClawPath(nextWindowsPath)
      setDefaultOpenClawPath(nextWindowsPath)
      setWslEnabled(nextWslEnabled)
      setWslDistro(config.wsl?.distro || DEFAULT_WSL_DISTRO)
      setWslOpenClawPath(
        nextWslEnabled ? config.wsl?.openClawPath || DEFAULT_WSL_OPENCLAW_PATH : ''
      )
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          text('加载配置失败', 'Failed to load config')
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [text])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const resetValidationStatus = () => {
    setValidationStatus('idle')
    setLastValidationMessage('')
  }

  const updatePathLocally = (value: string) => {
    setOpenClawPath(value)
    resetValidationStatus()
  }

  const updateWslConfigLocally = (
    updater: (current: {
      enabled: boolean
      distro: string
      openClawPath: string
    }) => { enabled: boolean; distro: string; openClawPath: string }
  ) => {
    const next = updater({
      enabled: wslEnabled,
      distro: wslDistro,
      openClawPath: wslOpenClawPath,
    })

    setWslEnabled(next.enabled)
    setWslDistro(next.distro || DEFAULT_WSL_DISTRO)
    setWslOpenClawPath(next.openClawPath)
    resetValidationStatus()
  }

  const updateSourceMode = (mode: DataSourceMode) => {
    updateWslConfigLocally((current) => ({
      ...current,
      enabled: mode === 'wsl',
    }))
  }

  const buildWslPayload = (): NonNullable<Config['wsl']> => ({
    enabled: wslEnabled,
    distro: wslDistro.trim() || DEFAULT_WSL_DISTRO,
    openClawPath: wslOpenClawPath.trim() || DEFAULT_WSL_OPENCLAW_PATH,
  })

  const persistOpenClawPath = async () => {
    const nextPath = openClawPath.trim()
    const nextWsl = buildWslPayload()

    if (!nextWsl.enabled && !nextPath) {
      throw new Error(
        text(
          '请输入 OpenClaw 目录路径',
          'Please enter an OpenClaw directory path'
        )
      )
    }

    const config = await updateConfig({
      ...(!nextWsl.enabled ? { openClawPath: nextPath } : {}),
      wsl: nextWsl,
    })
    const resolvedPath = config.openClawPath || (nextWsl.enabled ? nextWsl.openClawPath : nextPath)

    if (!nextWsl.enabled) {
      setOpenClawPath(resolvedPath)
    }
    setWslEnabled(Boolean(config.wsl?.enabled))
    setWslDistro(config.wsl?.distro || DEFAULT_WSL_DISTRO)
    setWslOpenClawPath(
      config.wsl?.enabled
        ? config.wsl?.openClawPath || DEFAULT_WSL_OPENCLAW_PATH
        : ''
    )
    const nextWindowsPath = getWindowsOpenClawPath(config)
    if (nextWindowsPath) {
      setDefaultOpenClawPath(nextWindowsPath)
    }

    return resolvedPath
  }

  const handleSavePath = async () => {
    try {
      setIsValidating(true)
      resetValidationStatus()

      await persistOpenClawPath()

      setValidationStatus('valid')
      setLastValidationMessage(text('OpenClaw 数据路径已保存', 'OpenClaw data path saved'))
      toast.success(text('OpenClaw 数据路径已保存', 'OpenClaw data path saved'))

      window.setTimeout(() => {
        setValidationStatus('idle')
      }, 3000)
    } catch (error) {
      setValidationStatus('invalid')
      toast.error(
        getApiErrorMessage(
          error,
          text('保存配置失败', 'Failed to save config')
        )
      )
    } finally {
      setIsValidating(false)
    }
  }

  const handleConnectData = async () => {
    try {
      setIsValidating(true)
      resetValidationStatus()

      const resolvedPath = await persistOpenClawPath()
      const wsl = buildWslPayload()
      const result = await reloadOpenClawData({
        ...(!wsl.enabled ? { openClawPath: resolvedPath } : {}),
        wsl,
      })

      if (!wsl.enabled) {
        setOpenClawPath(result.openClawPath || resolvedPath)
      }
      setValidationStatus('valid')

      const source = result.details?.source || 'OpenClaw'
      const parsedUsageEntries = result.details?.parsedUsageEntries ?? 0
      const sessionFilesFound = result.details?.sessionFilesFound ?? 0
      const message = text(
        `${source} 数据已验证，已解析 ${result.sessionCount || 0} 个会话和 ${parsedUsageEntries} 条用量记录。`,
        `${source} data verified. Parsed ${result.sessionCount || 0} sessions and ${parsedUsageEntries} usage records.`
      )

      setLastValidationMessage(
        `${message} ${text('会话文件：', 'Session files:')} ${sessionFilesFound}`
      )
      toast.success(message)

      for (const warning of result.details?.warnings ?? []) {
        toast.warning(warning)
      }
    } catch (error) {
      setValidationStatus('invalid')
      toast.error(
        getApiErrorMessage(
          error,
          text('接入 OpenClaw 数据失败', 'Failed to connect OpenClaw data')
        )
      )
    } finally {
      setIsValidating(false)
    }
  }

  const handleResetToDefault = () => {
    if (wslEnabled) {
      updateWslConfigLocally(() => ({
        enabled: true,
        distro: DEFAULT_WSL_DISTRO,
        openClawPath: '',
      }))
      return
    }

    if (!defaultOpenClawPath) {
      return
    }

    updatePathLocally(defaultOpenClawPath)
  }

  const handleSelectFolder = async () => {
    if (!window.electronAPI) {
      toast.error(
        text(
          '文件夹选择仅在桌面应用中可用',
          'Folder selection is only available in the desktop app'
        )
      )
      return
    }

    const selectedPath = await window.electronAPI.selectFolder()
    if (selectedPath) {
      updatePathLocally(selectedPath)
    }
  }

  const canSubmit = wslEnabled
    ? Boolean(wslDistro.trim())
    : Boolean(openClawPath.trim())
  const sourceMode: DataSourceMode = wslEnabled ? 'wsl' : 'windows'
  const wslHostPathPreview = buildWslHostPathPreview(wslDistro, wslOpenClawPath)

  const statusIcon = validationStatus === 'idle'
    ? null
    : validationStatus === 'valid'
      ? <Check className='h-4 w-4 text-success' />
      : <X className='h-4 w-4 text-destructive' />

  return (
    <SettingsCard
      title={text('OpenClaw 数据接口', 'OpenClaw Data Source')}
      description={text(
        '选择 OpenClaw 运行在 Windows 还是 WSL2，再连接对应的数据目录。',
        'Choose whether OpenClaw runs on Windows or WSL2, then connect the matching data directory.'
      )}
    >
      <SettingsItem
        label={text('运行环境', 'Runtime environment')}
        description={text(
          '先选择 OpenClaw 数据实际所在的位置，下面只显示对应的路径设置。',
          'Choose where the OpenClaw data lives first; the matching path fields appear below.'
        )}
      >
        <RadioGroup
          value={sourceMode}
          onValueChange={(value) => {
            updateSourceMode(value as DataSourceMode)
          }}
          className='grid gap-3 md:grid-cols-2'
        >
          <label
            className={cn(
              'flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors',
              sourceMode === 'windows'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-muted/10 hover:bg-muted/20'
            )}
          >
            <RadioGroupItem value='windows' className='mt-1' disabled={isLoading} />
            <div className='space-y-1'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <Monitor className='size-4 text-muted-foreground' />
                <span>{text('Windows', 'Windows')}</span>
              </div>
              <p className='text-xs leading-5 text-muted-foreground'>
                {text(
                  'OpenClaw 数据目录在 Windows 文件系统里。',
                  'The OpenClaw data directory is on the Windows filesystem.'
                )}
              </p>
            </div>
          </label>

          <label
            className={cn(
              'flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors',
              sourceMode === 'wsl'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-muted/10 hover:bg-muted/20'
            )}
          >
            <RadioGroupItem value='wsl' className='mt-1' disabled={isLoading} />
            <div className='space-y-1'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <Terminal className='size-4 text-muted-foreground' />
                <span>{text('WSL2', 'WSL2')}</span>
              </div>
              <p className='text-xs leading-5 text-muted-foreground'>
                {text(
                  'OpenClaw 跑在 Linux 子系统里，路径按 Linux 方式填写。',
                  'OpenClaw runs inside Linux, so enter a Linux-style path.'
                )}
              </p>
            </div>
          </label>
        </RadioGroup>
      </SettingsItem>

      <SettingsItem
        label={
          sourceMode === 'wsl'
            ? text('WSL2 数据路径', 'WSL2 data path')
            : text('Windows 数据路径', 'Windows data path')
        }
        description={
          sourceMode === 'wsl'
            ? text(
                '填写 WSL2 发行版名和 Linux 内的 .openclaw 路径。',
                'Enter the WSL2 distribution name and the Linux .openclaw path.'
              )
            : text(
                '选择或填写 Windows 中的 .openclaw 根目录。',
                'Choose or enter the .openclaw root directory on Windows.'
              )
        }
      >
        <div className='flex flex-col gap-3'>
          {sourceMode === 'windows' ? (
            <>
              <div className='flex flex-col gap-2 md:flex-row'>
                <div className='relative flex-1'>
                  <Input
                    value={openClawPath}
                    onChange={(event) => {
                      updatePathLocally(event.target.value)
                    }}
                    placeholder={WINDOWS_PATH_PLACEHOLDER}
                    disabled={isLoading}
                    className='pr-10'
                  />
                  {statusIcon && (
                    <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                      {statusIcon}
                    </div>
                  )}
                </div>
                <Button
                  variant='outline'
                  onClick={() => {
                    void handleSelectFolder()
                  }}
                  disabled={isLoading}
                >
                  <FolderOpen className='mr-2 h-4 w-4' />
                  {text('浏览', 'Browse')}
                </Button>
                <Button
                  variant='outline'
                  onClick={handleResetToDefault}
                  disabled={isLoading || !defaultOpenClawPath}
                >
                  {text('默认', 'Default')}
                </Button>
              </div>
              <p className='text-xs text-muted-foreground'>
                {defaultOpenClawPath
                  ? text(
                      `检测到的默认目录：${defaultOpenClawPath}`,
                      `Detected default directory: ${defaultOpenClawPath}`
                    )
                  : text(
                      '指向 OpenClaw 的 .openclaw 根目录。',
                      'Point this to the OpenClaw .openclaw root directory.'
                    )}
              </p>
            </>
          ) : (
            <div className='grid gap-3 md:grid-cols-2'>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>
                  {text('发行版', 'Distribution')}
                </p>
                <Input
                  value={wslDistro}
                  onChange={(event) => {
                    updateWslConfigLocally((current) => ({
                      ...current,
                      distro: event.target.value,
                    }))
                  }}
                  placeholder='Ubuntu'
                  disabled={isLoading}
                />
              </div>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>
                  {text('Linux 内的 OpenClaw 路径', 'OpenClaw path inside Linux')}
                </p>
                <div className='relative'>
                  <Input
                    value={wslOpenClawPath}
                    onChange={(event) => {
                      updateWslConfigLocally((current) => ({
                        ...current,
                        openClawPath: event.target.value,
                      }))
                    }}
                    placeholder={WSL_PATH_PLACEHOLDER}
                    disabled={isLoading}
                    className='pr-10'
                  />
                  {statusIcon && (
                    <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                      {statusIcon}
                    </div>
                  )}
                </div>
              </div>

              <div className='md:col-span-2'>
                <div className='rounded-md border border-dashed border-border bg-muted/15 px-3 py-2 text-xs text-muted-foreground'>
                  <div className='mb-1 font-medium text-foreground'>
                    {text('Windows 将通过这个路径读取：', 'Windows will read through:')}
                  </div>
                  <code className='break-all font-mono'>{wslHostPathPreview}</code>
                </div>
              </div>
            </div>
          )}
        </div>
      </SettingsItem>

      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap gap-2'>
          <Button
            onClick={() => {
              void handleSavePath()
            }}
            disabled={isLoading || isValidating || !canSubmit}
          >
            {text('保存路径', 'Save Path')}
          </Button>
          <Button
            variant='outline'
            onClick={() => {
              void handleConnectData()
            }}
            disabled={isLoading || isValidating || !canSubmit}
          >
            {isValidating ? (
              <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <RefreshCw className='mr-2 h-4 w-4' />
            )}
            {text('接入数据', 'Connect Data')}
          </Button>
        </div>

        {lastValidationMessage && (
          <p className='text-xs text-muted-foreground'>{lastValidationMessage}</p>
        )}
      </div>
    </SettingsCard>
  )
}
