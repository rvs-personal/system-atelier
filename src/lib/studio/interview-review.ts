export type ReasoningReview = {
  passed: number[];
  followUp: string;
  rationale: string;
  model: string;
  phase?: number;
};
export function validReview(value: unknown): value is ReasoningReview {
  if (!value || typeof value !== 'object') return false;
  const v = value as ReasoningReview;
  return (
    Array.isArray(v.passed) &&
    v.passed.length <= 3 &&
    v.passed.every((i) => Number.isInteger(i) && i >= 0 && i < 3) &&
    typeof v.followUp === 'string' &&
    v.followUp.length >= 20 &&
    v.followUp.length <= 1800 &&
    typeof v.rationale === 'string' &&
    v.rationale.length >= 10 &&
    v.rationale.length <= 2000 &&
    typeof v.model === 'string' &&
    /^(claude-(?:sonnet|opus)-[\w.-]+|grok-[\w.-]+|composer-2\.5)$/.test(
      v.model,
    )
  );
}
export function needsReasoningReview(text: string) {
  return (
    text.trim().split(/\s+/).length >= 30 &&
    !/^(how many|what are|could you|tell me|help me|hint)\b/i.test(text)
  );
}
export function shouldReview(
  session: {
    phase: number;
    extensions?: number;
    audit?: { phase: number; extension: number; model?: string }[];
  },
  text: string,
) {
  if (!needsReasoningReview(text) || session.phase < 3 || session.phase > 4)
    return false;
  const round = (session.audit ?? []).filter(
    (a) =>
      a.phase === session.phase && a.extension === (session.extensions ?? 0),
  );
  if (
    round.some(
      (a) =>
        a.model?.startsWith('claude-opus-') || a.model?.startsWith('grok-'),
    )
  )
    return false; // at most one model judgment per critical round
  const critical =
    /double.?charg|oversell|split.?brain|lost (write|payment)|acknowledged.*lost|concurrent.*(payment|seat|inventory)|payment.*timeout/i.test(
      text,
    );
  return critical || round.length >= 2;
}

/** The evidence gate, rather than a second model verdict, owns progression. */
export function reviewedPhase(current: number, passed: number[]) {
  const complete = [0, 1, 2].every((i) => passed.includes(i));
  return complete ? Math.min(5, current + 1) : current;
}
