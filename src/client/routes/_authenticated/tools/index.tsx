import { createFileRoute } from '@tanstack/react-router'
import { ToolsAnalytics } from '@/features/tools'

export const Route = createFileRoute('/_authenticated/tools/')({
  component: ToolsAnalytics,
})
