import { DatabaseZap } from 'lucide-react'
import { useAnalyticsSource } from '@/context/analytics-source-provider'
import { useLocale } from '@/context/locale-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function AnalyticsSourceSwitcher() {
  const { source, setSource } = useAnalyticsSource()
  const { text } = useLocale()

  return (
    <div className='rounded-lg border border-sidebar-border/80 bg-sidebar-accent/35 p-2 group-data-[collapsible=icon]:hidden'>
      <div className='mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium tracking-wide text-sidebar-foreground/60'>
        <DatabaseZap className='size-3.5' aria-hidden='true' />
        <span>{text('统计来源', 'Analytics source')}</span>
      </div>
      <Select
        value={source}
        onValueChange={(value) =>
          setSource(value as 'all' | 'openclaw' | 'hermes')
        }
      >
        <SelectTrigger className='h-8 border-sidebar-border bg-sidebar text-xs'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>{text('全部来源', 'All sources')}</SelectItem>
          <SelectItem value='openclaw'>OpenClaw</SelectItem>
          <SelectItem value='hermes'>Hermes</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
