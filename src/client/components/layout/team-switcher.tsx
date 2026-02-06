import * as React from 'react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

type TeamSwitcherProps = {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}

export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const activeTeam = teams[0]
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  if (isCollapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className='flex w-full items-center justify-center py-1'>
            <img src='/images/logo.png' alt='Clawalytics' className='size-6 object-contain' />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size='lg'>
          <div className='flex size-14 items-center justify-center overflow-hidden rounded-lg'>
            <img src='/images/logo.png' alt='Clawalytics' className='size-14 object-contain' />
          </div>
          <div className='grid flex-1 text-start text-sm leading-tight gap-0'>
            <span className='truncate font-jersey text-3xl'>clawalytics</span>
            <span className='truncate text-xs -mt-1' >{activeTeam.plan}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
