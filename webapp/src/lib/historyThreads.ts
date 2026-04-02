import type { HistoryEntry } from './historyApi';

export type ThreadedHistoryEntry = HistoryEntry & {
  threadId: string;
  rootQuestion: string;
  latestPreview: string;
  latestAt: string;
};

export function groupHistoryEntries(entries: HistoryEntry[]): ThreadedHistoryEntry[] {
  const groupedThreads = new Map<string, ThreadedHistoryEntry>();
  const standaloneEntries: ThreadedHistoryEntry[] = [];

  for (const entry of entries) {
    const conversationId = entry.conversation_id?.trim();

    if (!conversationId) {
      standaloneEntries.push({
        ...entry,
        threadId: entry.id,
        rootQuestion: entry.question,
        latestPreview: entry.question,
        latestAt: entry.created_at,
      });
      continue;
    }

    const existing = groupedThreads.get(conversationId);
    if (!existing) {
      groupedThreads.set(conversationId, {
        ...entry,
        threadId: conversationId,
        conversation_id: conversationId,
        rootQuestion: entry.question,
        latestPreview: entry.question,
        latestAt: entry.created_at,
      });
      continue;
    }

    existing.rootQuestion = entry.question;
    existing.created_at = entry.created_at;
    if (!existing.style_mode && entry.style_mode) {
      existing.style_mode = entry.style_mode;
    }
  }

  return [...Array.from(groupedThreads.values()), ...standaloneEntries].sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );
}
