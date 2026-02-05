import { createFileRoute } from '@tanstack/react-router'
import { SecurityAudit } from '@/features/security/audit'

export const Route = createFileRoute('/_authenticated/security/audit')({
  component: SecurityAudit,
})
