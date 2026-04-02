import { useEffect, useState } from 'react'
import { Check, FolderOpen, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLocale } from '@/context/locale-provider'
import {
  getApiErrorMessage,
  getConfig,
  reloadOpenClawData,
  updateConfig,
} from '@/lib/api'
import { toast } from 'sonner'
import { SettingsCard, SettingsItem } from '../settings-page'

type ValidationStatus = 'idle' | 'valid' | 'invalid'

export function OpenClawSettings() {
  const { text } = useLocale()
  const [openClawPath, setOpenClawPath] = useState('')
  const [defaultOpenClawPath, setDefaultOpenClawPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')

  useEffect(() => {
    void loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setIsLoading(true)
      const config = await getConfig()
      setOpenClawPath(config.openClawPath || '')
      setDefaultOpenClawPath(config.defaultOpenClawPath || config.openClawPath || '')
    } catch (error) {
      console.error('Failed to load config:', error)
      toast.error(
        getApiErrorMessage(
          error,
          text('加载配置失败', 'Failed to load config')
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const resetValidationStatus = () => {
    setValidationStatus('idle')
  }

  const updatePathLocally = (value: string) => {
    setOpenClawPath(value)
    resetValidationStatus()
  }

  const persistOpenClawPath = async () => {
    const nextPath = openClawPath.trim()
    if (!nextPath) {
      throw new Error(text('请输入 OpenClaw 目录路径', 'Please enter an OpenClaw directory path'))
    }

    const config = await updateConfig({ openClawPath: nextPath })
    const resolvedPath = config.openClawPath || nextPath

    setOpenClawPath(resolvedPath)
    if (config.defaultOpenClawPath) {
      setDefaultOpenClawPath(config.defaultOpenClawPath)
    }

    return resolvedPath
  }

  const handleSavePath = async () => {
    try {
      setIsValidating(true)
      resetValidationStatus()

      await persistOpenClawPath()

      setValidationStatus('valid')
      toast.success(text('OpenClaw 目录已保存', 'OpenClaw directory saved'))

      window.setTimeout(() => {
        setValidationStatus('idle')
      }, 3000)
    } catch (error) {
      console.error('Failed to save config:', error)
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
      const result = await reloadOpenClawData({ openClawPath: resolvedPath })

      setOpenClawPath(result.openClawPath || resolvedPath)
      setValidationStatus('valid')

      toast.success(
        text(
          `已成功接入 OpenClaw 数据，共解析 ${result.sessionCount || 0} 个会话`,
          `Successfully connected OpenClaw data. Parsed ${result.sessionCount || 0} sessions`
        )
      )
    } catch (error) {
      console.error('Failed to connect OpenClaw data:', error)
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
    if (!defaultOpenClawPath) {
      return
    }

    updatePathLocally(defaultOpenClawPath)
  }

  const handleSelectFolder = async () => {
    if (!window.electronAPI) {
      toast.error(
        text(
          '文件夹选择器仅在桌面应用中可用',
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

  return (
    <SettingsCard
      title={text('OpenClaw 数据源', 'OpenClaw Data Source')}
      description={text(
        '配置 OpenClaw 数据目录，用来同步词元消耗和会话数据',
        'Configure the OpenClaw data directory to sync token usage and session data'
      )}
    >
      <SettingsItem
        label={text('OpenClaw 目录', 'OpenClaw Directory')}
        description={text(
          '支持直接选择 .openclaw 根目录，也支持误选到 agents 或 sessions 子目录时自动纠正',
          'You can select the .openclaw root directly. If you pick an agents or sessions subdirectory by mistake, it will be corrected automatically'
        )}
      >
        <div className='flex flex-col gap-3'>
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <Input
                value={openClawPath}
                onChange={(event) => {
                  updatePathLocally(event.target.value)
                }}
                placeholder={text(
                  '输入 OpenClaw 目录路径',
                  'Enter the OpenClaw directory path'
                )}
                disabled={isLoading}
                className='pr-10'
              />
              {validationStatus !== 'idle' && (
                <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                  {validationStatus === 'valid' ? (
                    <Check className='h-4 w-4 text-success' />
                  ) : (
                    <X className='h-4 w-4 text-destructive' />
                  )}
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

          <div className='flex gap-2'>
            <Button
              onClick={() => {
                void handleSavePath()
              }}
              disabled={isLoading || isValidating || !openClawPath.trim()}
            >
              {text('保存路径', 'Save Path')}
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                void handleConnectData()
              }}
              disabled={isLoading || isValidating || !openClawPath.trim()}
            >
              {isValidating ? (
                <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <RefreshCw className='mr-2 h-4 w-4' />
              )}
              {text('接入数据', 'Connect Data')}
            </Button>
          </div>

          <p className='text-xs text-muted-foreground'>
            {defaultOpenClawPath
              ? text(
                  `当前检测到的默认目录: ${defaultOpenClawPath}`,
                  `Detected default directory: ${defaultOpenClawPath}`
                )
              : text(
                  '请指向 OpenClaw 的 .openclaw 根目录',
                  'Point this to the OpenClaw .openclaw root directory'
                )}
          </p>
        </div>
      </SettingsItem>
    </SettingsCard>
  )
}
