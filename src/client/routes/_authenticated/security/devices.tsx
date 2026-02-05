import { createFileRoute } from '@tanstack/react-router'
import { SecurityDevices } from '@/features/security/devices'

export const Route = createFileRoute('/_authenticated/security/devices')({
  component: SecurityDevices,
})
