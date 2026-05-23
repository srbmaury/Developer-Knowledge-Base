/** Matches UI sort: pinned first, then `order` ascending within each group. */
export function compareQuestionsByPinAndOrder(
  a: { isPinned: boolean; order: number },
  b: { isPinned: boolean; order: number }
) {
  return Number(b.isPinned) - Number(a.isPinned) || a.order - b.order;
}

/** Ensures pinned ids come before unpinned ids (drag is only allowed within each group). */
export function normalizeQuestionIdsForReorder(
  questionIds: string[],
  byId: Map<string, { id: string; isPinned: boolean }>
) {
  const pinned: string[] = [];
  const unpinned: string[] = [];

  for (const id of questionIds) {
    const question = byId.get(id);
    if (!question) continue;
    if (question.isPinned) pinned.push(id);
    else unpinned.push(id);
  }

  return [...pinned, ...unpinned];
}

/** Assigns separate 0..n order values for pinned and unpinned questions. */
export function assignOrdersByPinGroups(
  questionIds: string[],
  byId: Map<string, { id: string; isPinned: boolean }>
) {
  let pinnedOrder = 0;
  let unpinnedOrder = 0;

  return normalizeQuestionIdsForReorder(questionIds, byId)
    .map((id) => byId.get(id))
    .filter((question): question is { id: string; isPinned: boolean } => question !== undefined)
    .map((question) => ({
      id: question.id,
      order: question.isPinned ? pinnedOrder++ : unpinnedOrder++
    }));
}
