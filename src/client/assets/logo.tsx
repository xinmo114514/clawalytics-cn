import { type ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Logo({ className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src='/images/logo.png'
      alt='Clawalytics'
      className={cn('size-10 object-contain', className)}
      {...props}
    />
  )
}
