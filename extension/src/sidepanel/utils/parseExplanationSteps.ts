export function parseExplanationSteps(explanation: string): string[] {
  const lines = explanation
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return lines;

  const cleaned = lines.map((line) =>
    line.replace(/^(\d+[).\s-]+|[-*]\s+)/, '').trim(),
  );

  const unique = cleaned.filter((line, idx) => line && cleaned.indexOf(line) === idx);
  return unique.length > 0 ? unique : cleaned;
}
