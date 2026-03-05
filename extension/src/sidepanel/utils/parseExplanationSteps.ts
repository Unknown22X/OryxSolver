export function parseExplanationSteps(explanation: string): string[] {
  const lines = explanation
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return lines;

  const cleaned = lines
    .map((line) =>
      line
        .replace(/^(\d+[).\s-]+|[-*]\s+)/, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .trim(),
    )
    .filter((line) => {
      const normalized = line.toLowerCase().replace(/[:.]/g, '').trim();
      if (!normalized) return false;
      if (normalized === 'brief explanation steps') return false;
      if (normalized === 'explanation') return false;
      if (normalized === 'final answer') return false;
      return true;
    });

  const unique = cleaned.filter((line, idx) => line && cleaned.indexOf(line) === idx);
  return unique.length > 0 ? unique : cleaned;
}
