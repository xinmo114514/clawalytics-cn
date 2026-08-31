import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Database,
  FolderOpen,
  Monitor,
  RefreshCw,
  Terminal,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getApiErrorMessage,
  getConfig,
  reloadHermesData,
  reloadOpenClawData,
  type Config,
  type DataSourceConfig,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { useLocale } from '@/context/locale-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { SettingsCard, SettingsItem } from '../settings-page'

type ValidationStatus = 'idle' | 'valid' | 'invalid'
type SourceKey = 'openclaw' | 'hermes'

const DEFAULT_WSL_DISTRO = 'Ubuntu-24.04'
const EMPTY_SOURCES: Config['dataSources'] = {
  openclaw: { enabled: true, environment: 'local', path: '' },
  hermes: { enabled: false, environment: 'local', path: '' },
}

function sourceFallback(config: Config): Config['dataSources'] {
  if (config.dataSources) return config.dataSources
  return {
    ...EMPTY_SOURCES,
    openclaw: {
      enabled: true,
      environment: config.wsl?.enabled ? 'wsl' : 'local',
      path: config.openClawPath || config.wsl?.openClawPath || '',
    },
  }
}

function SourcePanel({
  sourceKey,
  value,
  distro,
  status,
  message,
  busy,
  onChange,
  onConnect,
}: {
  sourceKey: SourceKey
  value: DataSourceConfig
  distro: string
  status: ValidationStatus
  message: string
  busy: boolean
  onChange: (value: DataSourceConfig) => void
  onConnect: () => void
}) {
  const { text } = useLocale()
  const isHermes = sourceKey === 'hermes'
  const label = isHermes ? 'Hermes' : 'OpenClaw'
  const defaultPath = isHermes ? '~/.hermes' : '~/.openclaw'
  const windowsPlaceholder = isHermes
    ? 'C:\\Users\\you\\.hermes'
    : 'C:\\Users\\you\\.openclaw'
  const description = isHermes
    ? text(
        '只读连接 state.db；不会读取消息正文或请求转储。',
        'Read-only state.db connection; message bodies and request dumps are never read.'
      )
    : text(
        '读取 OpenClaw 的会话 JSONL 和每 Agent SQLite。',
        'Reads OpenClaw session JSONL and per-agent SQLite stores.'
      )

  const selectFolder = async () => {
    const selected = await window.electronAPI?.selectFolder()
    if (selected) onChange({ ...value, path: selected })
  }

  return (
    <section
      className={cn(
        'rounded-xl border bg-muted/10 p-4 shadow-sm',
        isHermes
          ? 'border-l-2 border-l-violet-500/80'
          : 'border-l-2 border-l-cyan-500/80'
      )}
    >
      <div className='flex items-start gap-3'>
        <div
          className={cn(
            'mt-0.5 rounded-md border p-2',
            isHermes
              ? 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300'
              : 'border-cyan-500/25 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
          )}
        >
          {isHermes ? (
            <Database className='size-4' />
          ) : (
            <Terminal className='size-4' />
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='font-semibold'>{label}</h3>
            <Badge variant={value.enabled ? 'secondary' : 'outline'}>
              {value.enabled
                ? text('已启用', 'Enabled')
                : text('未启用', 'Disabled')}
            </Badge>
          </div>
          <p className='mt-1 text-sm leading-5 text-muted-foreground'>
            {description}
          </p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          aria-label={text(`启用 ${label}`, `Enable ${label}`)}
        />
      </div>

      <div className='mt-4 space-y-4'>
        <RadioGroup
          value={value.environment}
          onValueChange={(environment) =>
            onChange({
              ...value,
              environment: environment as 'local' | 'wsl',
              path: value.path || (environment === 'wsl' ? defaultPath : ''),
            })
          }
          className='grid grid-cols-2 gap-2'
          disabled={busy || !value.enabled}
        >
          <label className='flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm'>
            <RadioGroupItem value='local' />
            <Monitor className='size-4 text-muted-foreground' />
            Windows
          </label>
          <label className='flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm'>
            <RadioGroupItem value='wsl' />
            <Terminal className='size-4 text-muted-foreground' />
            WSL2
          </label>
        </RadioGroup>

        <div className='flex gap-2'>
          <Input
            value={value.path}
            onChange={(event) =>
              onChange({ ...value, path: event.target.value })
            }
            placeholder={
              value.environment === 'wsl' ? defaultPath : windowsPlaceholder
            }
            disabled={busy || !value.enabled}
            aria-label={text(`${label} 数据目录`, `${label} data directory`)}
          />
          {value.environment === 'local' && (
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={() => void selectFolder()}
              disabled={busy || !value.enabled}
              aria-label={text('选择目录', 'Choose folder')}
            >
              <FolderOpen className='size-4' />
            </Button>
          )}
        </div>

        {value.environment === 'wsl' && value.path && (
          <p className='rounded-md bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground'>
            {/^\\\\wsl(?:\.localhost|\$)?\\/i.test(value.path)
              ? value.path
              : `${distro}: ${value.path}`}
          </p>
        )}

        <div className='flex flex-wrap items-center gap-3'>
          <Button
            type='button'
            onClick={onConnect}
            disabled={busy || (value.enabled && !value.path.trim())}
          >
            <RefreshCw className={cn('me-2 size-4', busy && 'animate-spin')} />
            {value.enabled
              ? text('验证并连接', 'Validate and connect')
              : text('保存为停用', 'Save as disabled')}
          </Button>
          {status !== 'idle' && (
            <div
              className={cn(
                'flex min-w-0 items-center gap-2 text-sm',
                status === 'valid' ? 'text-success' : 'text-destructive'
              )}
            >
              {status === 'valid' ? (
                <Check className='size-4' />
              ) : (
                <X className='size-4' />
              )}
              <span className='break-words'>{message}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function OpenClawSettings() {
  const { text } = useLocale()
  const [sources, setSources] = useState(EMPTY_SOURCES)
  const [distro, setDistro] = useState(DEFAULT_WSL_DISTRO)
  const [config, setConfig] = useState<Config | null>(null)
  const [busySource, setBusySource] = useState<SourceKey | null>(null)
  const [statuses, setStatuses] = useState<Record<SourceKey, ValidationStatus>>(
    { openclaw: 'idle', hermes: 'idle' }
  )
  const [messages, setMessages] = useState<Record<SourceKey, string>>({
    openclaw: '',
    hermes: '',
  })

  const load = useCallback(async () => {
    try {
      const next = await getConfig()
      setConfig(next)
      setSources(sourceFallback(next))
      setDistro(next.wsl?.distro || DEFAULT_WSL_DISTRO)
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, text('加载配置失败', 'Failed to load config'))
      )
    }
  }, [text])

  useEffect(() => {
    void load()
  }, [load])

  const updateSource = (sourceKey: SourceKey, value: DataSourceConfig) => {
    setSources((current) => ({ ...current, [sourceKey]: value }))
    setStatuses((current) => ({ ...current, [sourceKey]: 'idle' }))
  }

  const connect = async (sourceKey: SourceKey) => {
    if (!config) return
    setBusySource(sourceKey)
    try {
      const source = sources[sourceKey]
      const wsl = {
        enabled: sources.openclaw.environment === 'wsl',
        distro: distro.trim() || DEFAULT_WSL_DISTRO,
        openClawPath: sources.openclaw.path,
      }
      if (sourceKey === 'openclaw') {
        if (!source.enabled) {
          await reloadOpenClawData({
            dataSources: { ...sources, openclaw: source },
            wsl,
          })
          setMessages((current) => ({
            ...current,
            openclaw: text('OpenClaw 已停用。', 'OpenClaw disabled.'),
          }))
        } else {
          const result = await reloadOpenClawData({
            openClawPath: source.path,
            dataSources: { ...sources, openclaw: source },
            wsl: {
              ...wsl,
              enabled: source.environment === 'wsl',
              openClawPath: source.path,
            },
          })
          setMessages((current) => ({
            ...current,
            openclaw: text(
              `已解析 ${result.sessionCount} 个会话。`,
              `Parsed ${result.sessionCount} sessions.`
            ),
          }))
        }
      } else {
        const result = await reloadHermesData({
          dataSources: { ...sources, hermes: source },
          wsl,
        })
        setMessages((current) => ({
          ...current,
          hermes: source.enabled
            ? text(
                `已解析 ${result.sessionCount} 个会话、${result.details?.usageRecordCount ?? 0} 条聚合记录。`,
                `Parsed ${result.sessionCount} sessions and ${result.details?.usageRecordCount ?? 0} aggregate records.`
              )
            : text('Hermes 已停用。', 'Hermes disabled.'),
        }))
        for (const warning of result.details?.warnings ?? []) {
          toast.warning(warning)
        }
      }
      setStatuses((current) => ({ ...current, [sourceKey]: 'valid' }))
      const sourceName = sourceKey === 'hermes' ? 'Hermes' : 'OpenClaw'
      toast.success(
        text(`${sourceName} 数据源已更新`, `${sourceName} source updated`)
      )
      await load()
    } catch (error) {
      setStatuses((current) => ({ ...current, [sourceKey]: 'invalid' }))
      const message = getApiErrorMessage(
        error,
        text('连接数据源失败', 'Failed to connect data source')
      )
      setMessages((current) => ({ ...current, [sourceKey]: message }))
      toast.error(message)
    } finally {
      setBusySource(null)
    }
  }

  return (
    <SettingsCard
      title={text('AI 数据源', 'AI data sources')}
      description={text(
        '共享一个 WSL 运行环境，分别验证和连接 OpenClaw 与 Hermes。',
        'Share one WSL runtime while validating OpenClaw and Hermes independently.'
      )}
    >
      <SettingsItem
        label={text('公共 WSL 发行版', 'Shared WSL distribution')}
        description={text(
          '仅用于解析选择了 WSL2 的数据源路径。',
          'Used only to resolve data sources configured for WSL2.'
        )}
      >
        <Input
          value={distro}
          onChange={(event) => setDistro(event.target.value)}
          placeholder={DEFAULT_WSL_DISTRO}
          className='max-w-md'
        />
      </SettingsItem>

      <div className='grid gap-4 xl:grid-cols-2'>
        {(['openclaw', 'hermes'] as const).map((sourceKey) => (
          <SourcePanel
            key={sourceKey}
            sourceKey={sourceKey}
            value={sources[sourceKey]}
            distro={distro}
            status={statuses[sourceKey]}
            message={messages[sourceKey]}
            busy={busySource === sourceKey}
            onChange={(value) => updateSource(sourceKey, value)}
            onConnect={() => void connect(sourceKey)}
          />
        ))}
      </div>
    </SettingsCard>
  )
}
