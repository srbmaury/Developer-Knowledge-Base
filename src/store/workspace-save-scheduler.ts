import { workspaceSync } from "@/lib/workspace-sync";
import { SAVE_DEBOUNCE_MS } from "@/lib/constants";
import type { Difficulty, SolutionLanguage } from "@/types/knowledge";
import type { ReviewResult } from "@/lib/ai-answer";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

const contentSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const categoryNameSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const questionTitleSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const questionDescriptionSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const solutionTitleSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const solutionNotesSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingQuestionPatches = new Map<string, { title?: string; description?: string; difficulty?: Difficulty }>();
const pendingSolutionPatches = new Map<string, { title?: string; language?: SolutionLanguage; content?: string; notes?: string; aiReview?: ReviewResult | null }>();

/**
 * Edits made while a question/solution still has a client-side "temp-" id (i.e. before the
 * create request has resolved) can't be queued into pendingQuestionPatches/pendingSolutionPatches —
 * the server doesn't recognize that id yet. They're stashed here instead and replayed via
 * resolveTempQuestionEdit/resolveTempSolutionEdit once the real id comes back, so they go through
 * the same durable save pipeline as any other edit instead of relying on reading current store
 * state at exactly the right moment (which a concurrent revalidation-triggered setInitialData can
 * wipe out from under it).
 */
const tempQuestionEdits = new Map<string, { title?: string; description?: string; difficulty?: Difficulty }>();
const tempSolutionEdits = new Map<string, { title?: string; language?: SolutionLanguage; content?: string; notes?: string }>();
let bulkSaveTimer: ReturnType<typeof setTimeout> | null = null;
let activeSaveCount = 0;
let savedStatusTimer: ReturnType<typeof setTimeout> | null = null;
let setSaveStatus: ((status: SaveStatus) => void) | null = null;

/** Called once by the store on creation so the scheduler can report save status back into state. */
export function registerSaveStatusSetter(setter: (status: SaveStatus) => void) {
  setSaveStatus ??= setter;
}

/** Cancels a pending debounced content save (e.g. when the solution is being deleted). */
export function cancelPendingSolutionSave(solutionId: string) {
  const pendingSave = contentSaveTimers.get(solutionId);
  if (pendingSave) clearTimeout(pendingSave);
  contentSaveTimers.delete(solutionId);
}

/** Queues a solution patch (e.g. language change) into the next bulk save without its own debounce timer. */
export function queuePendingSolutionPatch(
  solutionId: string,
  patch: { title?: string; language?: SolutionLanguage; content?: string; notes?: string; aiReview?: ReviewResult | null }
) {
  pendingSolutionPatches.set(solutionId, {
    ...pendingSolutionPatches.get(solutionId),
    ...patch
  });
}

/** Stashes an edit made while the question still has a temporary client-side id. */
export function stashTempQuestionEdit(
  tempId: string,
  patch: { title?: string; description?: string; difficulty?: Difficulty }
) {
  tempQuestionEdits.set(tempId, { ...tempQuestionEdits.get(tempId), ...patch });
}

/** Replays any stashed edits for a question once its real id is known, via the normal bulk-save pipeline. */
export function resolveTempQuestionEdit(tempId: string, realId: string) {
  const stashed = tempQuestionEdits.get(tempId);
  tempQuestionEdits.delete(tempId);
  if (!stashed) return;
  markSavePending();
  pendingQuestionPatches.set(realId, { ...pendingQuestionPatches.get(realId), ...stashed });
  scheduleBulkSave();
}

/** Stashes an edit made while the solution still has a temporary client-side id. */
export function stashTempSolutionEdit(
  tempId: string,
  patch: { title?: string; language?: SolutionLanguage; content?: string; notes?: string }
) {
  tempSolutionEdits.set(tempId, { ...tempSolutionEdits.get(tempId), ...patch });
}

/** Replays any stashed edits for a solution once its real id is known, via the normal bulk-save pipeline. */
export function resolveTempSolutionEdit(tempId: string, realId: string) {
  const stashed = tempSolutionEdits.get(tempId);
  tempSolutionEdits.delete(tempId);
  if (!stashed) return;
  markSavePending();
  pendingSolutionPatches.set(realId, { ...pendingSolutionPatches.get(realId), ...stashed });
  scheduleBulkSave();
}

function markSavePending() {
  if (savedStatusTimer) clearTimeout(savedStatusTimer);
  setSaveStatus?.("pending");
}

export function runSave(operation: () => Promise<unknown>) {
  activeSaveCount += 1;
  if (savedStatusTimer) clearTimeout(savedStatusTimer);
  setSaveStatus?.("saving");

  void operation()
    .then(() => {
      activeSaveCount -= 1;
      if (activeSaveCount === 0) {
        setSaveStatus?.("saved");
        savedStatusTimer = setTimeout(() => {
          setSaveStatus?.("idle");
          savedStatusTimer = null;
        }, 1400);
      }
    })
    .catch(() => {
      activeSaveCount = Math.max(0, activeSaveCount - 1);
      setSaveStatus?.("error");
    });
}

export function scheduleCategoryNameSave(categoryId: string, name: string) {
  if (categoryId.startsWith("temp-")) return;
  const existing = categoryNameSaveTimers.get(categoryId);
  if (existing) clearTimeout(existing);
  markSavePending();

  categoryNameSaveTimers.set(
    categoryId,
    setTimeout(() => {
      runSave(() => workspaceSync.updateCategory(categoryId, name));
      categoryNameSaveTimers.delete(categoryId);
    }, SAVE_DEBOUNCE_MS)
  );
}

export function scheduleQuestionTitleSave(questionId: string, title: string) {
  if (questionId.startsWith("temp-")) { stashTempQuestionEdit(questionId, { title }); return; }
  const existing = questionTitleSaveTimers.get(questionId);
  if (existing) clearTimeout(existing);
  markSavePending();

  pendingQuestionPatches.set(questionId, {
    ...pendingQuestionPatches.get(questionId),
    title
  });

  questionTitleSaveTimers.set(
    questionId,
    setTimeout(() => {
      scheduleBulkSave();
      questionTitleSaveTimers.delete(questionId);
    }, SAVE_DEBOUNCE_MS)
  );
}

export function scheduleQuestionDescriptionSave(questionId: string, description: string) {
  if (questionId.startsWith("temp-")) { stashTempQuestionEdit(questionId, { description }); return; }
  const existing = questionDescriptionSaveTimers.get(questionId);
  if (existing) clearTimeout(existing);
  markSavePending();

  pendingQuestionPatches.set(questionId, {
    ...pendingQuestionPatches.get(questionId),
    description
  });

  questionDescriptionSaveTimers.set(
    questionId,
    setTimeout(() => {
      scheduleBulkSave();
      questionDescriptionSaveTimers.delete(questionId);
    }, SAVE_DEBOUNCE_MS)
  );
}

export function scheduleQuestionDifficultySave(questionId: string, difficulty: Difficulty) {
  if (questionId.startsWith("temp-")) { stashTempQuestionEdit(questionId, { difficulty }); return; }
  markSavePending();

  pendingQuestionPatches.set(questionId, {
    ...pendingQuestionPatches.get(questionId),
    difficulty
  });

  if (bulkSaveTimer) clearTimeout(bulkSaveTimer);
  bulkSaveTimer = setTimeout(() => {
    scheduleBulkSave();
  }, SAVE_DEBOUNCE_MS);
}

export function scheduleSolutionTitleSave(solutionId: string, title: string) {
  if (solutionId.startsWith("temp-")) { stashTempSolutionEdit(solutionId, { title }); return; }
  const existing = solutionTitleSaveTimers.get(solutionId);
  if (existing) clearTimeout(existing);
  markSavePending();

  pendingSolutionPatches.set(solutionId, {
    ...pendingSolutionPatches.get(solutionId),
    title
  });

  solutionTitleSaveTimers.set(
    solutionId,
    setTimeout(() => {
      scheduleBulkSave();
      solutionTitleSaveTimers.delete(solutionId);
    }, SAVE_DEBOUNCE_MS)
  );
}

export function scheduleSolutionSave(solutionId: string, content: string) {
  if (solutionId.startsWith("temp-")) { stashTempSolutionEdit(solutionId, { content }); return; }
  const existing = contentSaveTimers.get(solutionId);
  if (existing) clearTimeout(existing);
  markSavePending();

  pendingSolutionPatches.set(solutionId, {
    ...pendingSolutionPatches.get(solutionId),
    content
  });

  contentSaveTimers.set(
    solutionId,
    setTimeout(() => {
      scheduleBulkSave();
      contentSaveTimers.delete(solutionId);
    }, SAVE_DEBOUNCE_MS)
  );
}

export function scheduleBulkSave() {
  if (bulkSaveTimer) clearTimeout(bulkSaveTimer);
  bulkSaveTimer = setTimeout(() => {
    const questions = [...pendingQuestionPatches.entries()].map(([questionId, patch]) => ({ questionId, ...patch }));
    const solutions = [...pendingSolutionPatches.entries()].map(([solutionId, patch]) => ({ solutionId, ...patch }));
    pendingQuestionPatches.clear();
    pendingSolutionPatches.clear();
    bulkSaveTimer = null;
    if (questions.length === 0 && solutions.length === 0) return;
    runSave(() => workspaceSync.bulkSave(questions.length > 0 ? questions : undefined, solutions.length > 0 ? solutions : undefined));
  }, SAVE_DEBOUNCE_MS);
}

export function scheduleSolutionNotesSave(solutionId: string, notes: string) {
  if (solutionId.startsWith("temp-")) { stashTempSolutionEdit(solutionId, { notes }); return; }
  const existing = solutionNotesSaveTimers.get(solutionId);
  if (existing) clearTimeout(existing);
  markSavePending();

  solutionNotesSaveTimers.set(
    solutionId,
    setTimeout(() => {
      runSave(() => workspaceSync.updateSolution(solutionId, { notes }));
      solutionNotesSaveTimers.delete(solutionId);
    }, SAVE_DEBOUNCE_MS)
  );
}
