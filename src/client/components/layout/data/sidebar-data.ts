import { DollarSign } from 'lucide-react'
import { HomeIcon } from '@/components/icons/home-icon'
import { SessionsIcon } from '@/components/icons/sessions-icon'
import { AgentsIcon } from '@/components/icons/agents-icon'
import { ChannelsIcon } from '@/components/icons/channels-icon'
import { SecurityIcon } from '@/components/icons/security-icon'
import { DevicesIcon } from '@/components/icons/devices-icon'
import { AuditIcon } from '@/components/icons/audit-icon'
import { ToolsIcon } from '@/components/icons/tools-icon'
import { HelpIcon } from '@/components/icons/help-icon'
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
          title: 'Agents',
          url: '/agents',
          icon: AgentsIcon,
        },
        {
          title: 'Channels',
          url: '/channels',
          icon: ChannelsIcon,
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          title: 'Overview',
          url: '/security',
          icon: SecurityIcon,
        },
        {
          title: 'Devices',
          url: '/security/devices',
          icon: DevicesIcon,
        },
        {
          title: 'Audit Log',
          url: '/security/audit',
          icon: AuditIcon,
        },
        {
          title: 'Tools',
          url: '/tools',
          icon: ToolsIcon,
        },
      ],
    },
    {
      title: 'Help',
      items: [
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpIcon,
        },
      ],
    },
  ],
}
