import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/context/locale-provider'

export function LanguageSwitch() {
  const { locale, setLocale } = useLocale()

  return (
    <div className='flex items-center rounded-full border p-1'>
      <Languages className='mx-1 size-4 text-muted-foreground' />
      <Button
        variant={locale === 'zh' ? 'secondary' : 'ghost'}
        size='sm'
        className='h-7 rounded-full px-2 text-xs'
        onClick={() => setLocale('zh')}
      >
        中文
      </Button>
      <Button
        variant={locale === 'en' ? 'secondary' : 'ghost'}
        size='sm'
        className='h-7 rounded-full px-2 text-xs'
        onClick={() => setLocale('en')}
      >
        EN
      </Button>
    </div>
  )
}
