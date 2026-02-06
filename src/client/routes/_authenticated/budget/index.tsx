import { createFileRoute } from '@tanstack/react-router'
import { BudgetPage } from '@/features/budget/budget-page'

export const Route = createFileRoute('/_authenticated/budget/')({
  component: BudgetPage,
})
