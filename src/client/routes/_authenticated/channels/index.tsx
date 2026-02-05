import { createFileRoute } from '@tanstack/react-router'
import { Channels } from '@/features/channels'

export const Route = createFileRoute('/_authenticated/channels/')({
  component: Channels,
})
