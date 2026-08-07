/**
 * Shared Cambridge tutor response shape for HeuristicAIProvider
 * (and future LLM post-processing). Compatible with CoachMarkdown:
 * bold section labels + fenced pseudocode — no ATX headings.
 */

export type TutorCard = {
  readonly directAnswer: string;
  readonly explanation: string;
  /** Cambridge Pseudocode; include OUTPUT in the snippet when helpful. */
  readonly example: string;
  readonly commonMistake: string;
  readonly examTip?: string;
};

/**
 * Render a fixed educational structure for Cambridge theory answers.
 */
export function formatTutorResponse(card: TutorCard): string {
  const parts: string[] = [
    '**Direct answer**',
    card.directAnswer.trim(),
    '',
    '**Explanation**',
    card.explanation.trim(),
    '',
    '**Example**',
    '```pseudocode',
    card.example.replace(/^\n+|\n+$/g, ''),
    '```',
    '',
    '**Common mistake**',
    card.commonMistake.trim(),
  ];
  if (card.examTip?.trim()) {
    parts.push('', '**Exam tip**', card.examTip.trim());
  }
  return parts.join('\n');
}
