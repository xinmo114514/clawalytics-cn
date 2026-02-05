import { createFileRoute } from '@tanstack/react-router'
import { SecurityDashboard } from '@/features/security'

export const Route = createFileRoute('/_authenticated/security/')({
  component: SecurityDashboard,
})
