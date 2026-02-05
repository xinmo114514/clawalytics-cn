import { createFileRoute } from '@tanstack/react-router'
import { AgentDetail } from '@/features/agents/agent-detail'

export const Route = createFileRoute('/_authenticated/agents/$agentId')({
  component: AgentDetailPage,
})

function AgentDetailPage() {
  const { agentId } = Route.useParams()
  return <AgentDetail agentId={agentId} />
}
