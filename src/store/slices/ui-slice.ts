import type { StateCreator } from "zustand";
import { buildSearchIndex } from "@/lib/search-index";
import type { Category, Question, QuestionStatus, Solution } from "@/types/knowledge";
import {
  buildQuestionIndex,
  buildQuestionLocationIndex,
  buildSolutionLocationIndex,
  findCategory,
  mapCategories
} from "../workspace-helpers";
import { hasPendingQuestionPatch, hasPendingSolutionPatch } from "../workspace-save-scheduler";
import type { WorkspaceState } from "../workspace-store";

/**
 * The server always returns solutions "slim" (content/notes/aiReview blanked, contentLoaded:
 * false) — real content only ever arrives via fetchSolutionContent. So whenever the client already
 * has a solution's content loaded, keep it instead of accepting the incoming blank placeholder.
 * Also keep any field with a save still in flight/debouncing so an unrelated revalidation elsewhere
 * can't revert an edit the user just made before it reaches the server.
 */
function mergeIncomingSolution(incoming: Solution, local: Solution | undefined): Solution {
  if (!local) return incoming;
  const keepContent = local.contentLoaded && !incoming.contentLoaded;
  const pending = hasPendingSolutionPatch(incoming.id);
  return {
    ...incoming,
    title: pending ? local.title : incoming.title,
    language: pending ? local.language : incoming.language,
    content: keepContent || pending ? local.content : incoming.content,
    notes: keepContent || pending ? local.notes : incoming.notes,
    aiReview: keepContent ? local.aiReview : incoming.aiReview,
    contentLoaded: keepContent ? true : incoming.contentLoaded
  };
}

function mergeIncomingQuestion(incoming: Question, local: Question | undefined): Question {
  const pending = local && hasPendingQuestionPatch(incoming.id);
  return {
    ...incoming,
    title: pending ? local!.title : incoming.title,
    description: pending ? local!.description : incoming.description,
    difficulty: pending ? local!.difficulty : incoming.difficulty,
    srDue: !incoming.srDue && local?.srDue ? local.srDue : incoming.srDue,
    solutions: incoming.solutions.map((s) =>
      mergeIncomingSolution(s, local?.solutions.find((ls) => ls.id === s.id))
    )
  };
}

export type UiSlice = {
  setInitialData: (categories: Category[]) => void;
  selectCategory: (categoryId: string) => void;
  selectQuestion: (questionId: string) => void;
  selectSolution: (solutionId: string) => void;
  toggleCategory: (categoryId: string) => void;
  setQuery: (query: string) => void;
  setCommandOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  rebuildSearchIndex: () => void;
  setStatusFilter: (status: QuestionStatus | null) => void;
};

export const createUiSlice: StateCreator<WorkspaceState, [], [], UiSlice> = (set, get) => ({
  setInitialData: (incomingCategories) => {
    // Reconcile with local state instead of blindly overwriting: keep already-loaded solution
    // content and any edits that haven't been saved to the server yet (see mergeIncomingQuestion).
    const localQuestionById = get().questionById;
    const categories = mapCategories(incomingCategories, (cat) => ({
      ...cat,
      questions: cat.questions.map((q) => mergeIncomingQuestion(q, localQuestionById.get(q.id)))
    }));

    const questionById = buildQuestionIndex(categories);
    const questionIdToCategoryId = buildQuestionLocationIndex(categories);
    const solutionIdToLocation = buildSolutionLocationIndex(categories);
    const state = get();
    const firstCategory = categories[0];
    const firstQuestion = questionById.values().next().value as Question | undefined;
    const selectedCategoryStillExists =
      state.selectedCategoryId !== null && findCategory(categories, state.selectedCategoryId);
    const selectedQuestionStillExists =
      state.selectedQuestionId !== null && questionById.has(state.selectedQuestionId);

    // Respect persisted expandedCategoryIds even when it's an empty array.
    let persistedExpanded: string[] | undefined = undefined;
    try {
      const raw = localStorage.getItem("developer-knowledge-base-workspace");
      if (raw) {
        const parsed = JSON.parse(raw);
        const maybeState = parsed?.state ?? parsed;
        if (maybeState && Array.isArray(maybeState.expandedCategoryIds)) persistedExpanded = maybeState.expandedCategoryIds;
      }
    } catch {
      // ignore
    }

    set({
      categories,
      searchIndex: buildSearchIndex(categories),
      questionById,
      questionIdToCategoryId,
      solutionIdToLocation,
      selectedCategoryId: selectedCategoryStillExists
        ? state.selectedCategoryId
        : (firstCategory?.id ?? null),
      selectedQuestionId: selectedQuestionStillExists
        ? state.selectedQuestionId
        : (firstQuestion?.id ?? null),
      selectedSolutionId: selectedQuestionStillExists
        ? state.selectedSolutionId
        : (firstQuestion?.solutions[0]?.id ?? null),
      expandedCategoryIds: persistedExpanded !== undefined
        ? persistedExpanded
        : (state.expandedCategoryIds.length > 0 ? state.expandedCategoryIds : categories.map((category) => category.id))
    });

    // Kick off content fetch for the initially visible question
    const newState = get();
    const initialQuestion = newState.selectedQuestionId
      ? newState.questionById.get(newState.selectedQuestionId)
      : null;
    if (initialQuestion) {
      for (const solution of initialQuestion.solutions) {
        if (solution.contentLoaded === false) {
          void newState.fetchSolutionContent(solution.id);
        }
      }
    }
  },
  selectCategory: (categoryId) => set({ selectedCategoryId: categoryId }),
  selectQuestion: (questionId) => {
    const state = get();
    const question = state.questionById.get(questionId);
    const categoryId = question?.categoryId ?? state.questionIdToCategoryId.get(questionId) ?? state.selectedCategoryId;
    set({
      selectedQuestionId: questionId,
      selectedCategoryId: categoryId,
      selectedSolutionId: question?.solutions[0]?.id ?? null
    });

    // Fetch content for any solution that hasn't been loaded yet
    if (question) {
      const { fetchSolutionContent } = get();
      for (const solution of question.solutions) {
        if (solution.contentLoaded === false) {
          void fetchSolutionContent(solution.id);
        }
      }
    }
  },
  selectSolution: (solutionId) => set({ selectedSolutionId: solutionId }),
  toggleCategory: (categoryId) =>
    set((state) => ({
      expandedCategoryIds: state.expandedCategoryIds.includes(categoryId)
        ? state.expandedCategoryIds.filter((id) => id !== categoryId)
        : [...state.expandedCategoryIds, categoryId]
    })),
  setQuery: (query) => set({ query }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  rebuildSearchIndex: () => {
    set((state) => ({ searchIndex: buildSearchIndex(state.categories) }));
  },
  setStatusFilter: (status) => set({ filterStatus: status })
});
