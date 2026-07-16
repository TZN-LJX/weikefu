import type { Explanation } from '../../domain/types'

export function evaluateExplanation(
  explanation: Explanation,
  selectedEvidence: string[],
  conflictingEvidenceIds: string[],
) {
  const conflictingEvidence = selectedEvidence.filter((id) => conflictingEvidenceIds.includes(id))
  const complete = Object.values(explanation).every((value) => value.trim().length > 0)
    && conflictingEvidence.length === 0
  return { complete, conflictingEvidence }
}
