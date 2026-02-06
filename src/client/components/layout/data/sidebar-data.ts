import { DollarSign, HelpCircle, Wallet } from 'lucide-react'
import { HomeIcon } from '@/components/icons/home-icon'
import { SessionsIcon } from '@/components/icons/sessions-icon'
import { SecurityIcon } from '@/components/icons/security-icon'
import { ToolsIcon } from '@/components/icons/tools-icon'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  teams: [
    {
      name: 'Clawalytics',
      logo: DollarSign,
      plan: 'OpenClaw Analytics',
    },
  ],
  navGroups: [
    {
      title: 'Analytics',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: HomeIcon,
        },
        {
          title: 'Sessions',
          url: '/sessions',
          icon: SessionsIcon,
        },
        {
          title: 'Tools',
          url: '/tools',
          icon: ToolsIcon,
        },
        {
          title: 'Budget',
          url: '/budget',
          icon: Wallet,
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          title: 'Security',
          url: '/security',
          icon: SecurityIcon,
        },
      ],
    },
    {
      title: 'Help',
      items: [
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
