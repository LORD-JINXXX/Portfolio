export { ActionFeedback, feedbackAutoDismissDelay, useActionFeedback as useStudioFeedback } from '@platform/ui'
export type { ActionFeedbackMessage as StudioFeedbackMessage, ActionFeedbackTone as StudioFeedbackTone } from '@platform/ui'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function validationIssueMessages(value: unknown): string[] {
  const root = asRecord(value)
  const data = asRecord(root?.data)
  const validation = asRecord(root?.validation) || asRecord(data?.validation)
  const candidates = Array.isArray(validation?.issues) ? validation.issues : Array.isArray(validation?.errors) ? validation.errors : []
  return [...new Set(candidates.map((entry) => asRecord(entry)?.message).filter((message): message is string => typeof message === 'string' && Boolean(message.trim())))]
}
