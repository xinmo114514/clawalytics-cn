import { useState, useEffect } from 'react'
import { FolderOpen, RefreshCw, Check, X } from 'lucide-react'
import { useLocale } from '@/context/locale-provider'
import { SettingsCard, SettingsItem } from '../settings-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getConfig, updateConfig } from '@/lib/api'
import { toast } from 'sonner'

export function OpenClawSettings() {
  const { text } = useLocale()
  const [openClawPath, setOpenClawPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setIsLoading(true)
      const config = await getConfig()
      setOpenClawPath(config.openClawPath || '')
    } catch (error) {
      console.error('Failed to load config:', error)
      toast.error(text('加载配置失败', 'Failed to load config'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePath = async () => {
    if (!openClawPath.trim()) {
      toast.error(text('请输入 OpenClaw 目录路径', 'Please enter OpenClaw directory path'))
      return
    }

    try {
      setIsValidating(true)
      setValidationStatus('idle')

      await updateConfig({ openClawPath })

      setValidationStatus('valid')
      toast.success(text('OpenClaw 目录已保存', 'OpenClaw directory saved'))

      setTimeout(() => {
        setValidationStatus('idle')
      }, 3000)
    } catch (error) {
      console.error('Failed to save config:', error)
      setValidationStatus('invalid')
      toast.error(text('保存配置失败', 'Failed to save config'))
    } finally {
      setIsValidating(false)
    }
  }

  const handleConnectData = async () => {
    try {
      setIsValidating(true)

      const response = await fetch('/api/config/openclaw/reload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to reload OpenClaw data')
      }

      const result = await response.json()

      toast.success(
        text(
          `成功接入 OpenClaw 数据，共 ${result.sessionCount || 0} 个会话`,
          `Successfully connected to OpenClaw data, ${result.sessionCount || 0} sessions`
        )
      )
    } catch (error) {
      console.error('Failed to connect OpenClaw data:', error)
      toast.error(text('接入 OpenClaw 数据失败', 'Failed to connect OpenClaw data'))
    } finally {
      setIsValidating(false)
    }
  }

  const handleResetToDefault = async () => {
    const defaultPath = getDefaultOpenClawPath()
    setOpenClawPath(defaultPath)
  }

  const getDefaultOpenClawPath = () => {
    const platform = navigator.platform.toLowerCase()
    const home = getHomeDirectory()

    if (platform.includes('win')) {
      return `${home}\\AppData\\Roaming\\openclaw`
    } else if (platform.includes('mac')) {
      return `${home}/.openclaw`
    } else {
      return `${home}/.openclaw`
    }
  }

  const getHomeDirectory = () => {
    const platform = navigator.platform.toLowerCase()
    if (platform.includes('win')) {
      return 'C:\\Users\\' + (navigator.userAgent.split('Windows NT ')[1]?.split(';')[0] || 'User')
    }
    return '~'
  }

  return (
    <SettingsCard
      title={text('OpenClaw 数据源', 'OpenClaw Data Source')}
      description={text(
        '配置 OpenClaw 数据目录以监控词元花销',
        'Configure OpenClaw data directory to monitor token spending'
      )}
    >
      <SettingsItem
        label={text('OpenClaw 目录', 'OpenClaw Directory')}
        description={text(
          'OpenClaw 配置和数据存储的目录路径',
          'Directory path where OpenClaw config and data are stored'
        )}
      >
        <div className='flex flex-col gap-3'>
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <Input
                value={openClawPath}
                onChange={(e) => {
                  setOpenClawPath(e.target.value)
                  setValidationStatus('idle')
                }}
                placeholder={text(
                  '输入 OpenClaw 目录路径',
                  'Enter OpenClaw directory path'
                )}
                disabled={isLoading}
                className='pr-10'
              />
              {validationStatus !== 'idle' && (
                <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                  {validationStatus === 'valid' ? (
                    <Check className='h-4 w-4 text-green-500' />
                  ) : (
                    <X className='h-4 w-4 text-red-500' />
                  )}
                </div>
              )}
            </div>
            <Button
              variant='outline'
              onClick={handleResetToDefault}
              disabled={isLoading}
            >
              <FolderOpen className='mr-2 h-4 w-4' />
              {text('默认', 'Default')}
            </Button>
          </div>

          <div className='flex gap-2'>
            <Button
              onClick={handleSavePath}
              disabled={isLoading || isValidating || !openClawPath.trim()}
            >
              {text('保存路径', 'Save Path')}
            </Button>
            <Button
              variant='outline'
              onClick={handleConnectData}
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
            {text(
              '默认目录: C:\\Users\\用户名\\AppData\\Roaming\\openclaw (Windows) 或 ~/.openclaw (macOS/Linux)',
              'Default: C:\\Users\\Username\\AppData\\Roaming\\openclaw (Windows) or ~/.openclaw (macOS/Linux)'
            )}
          </p>
        </div>
      </SettingsItem>
    </SettingsCard>
  )
}
