import {
  LayoutDashboard,
  History,
  Settings,
  DollarSign,
  HelpCircle,
  Palette,
  Bell,
  Wrench,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Local User',
    email: 'clawalytics@local',
    avatar: '',
  },
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
          icon: LayoutDashboard,
        },
        {
          title: 'Sessions',
          url: '/sessions',
          icon: History,
        },
      ],
    },
    {
      title: 'Configuration',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'General',
              url: '/settings',
              icon: Wrench,
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Alerts',
              url: '/settings/notifications',
              icon: Bell,
            },
          ],
        },
        {
          title: 'Help',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
