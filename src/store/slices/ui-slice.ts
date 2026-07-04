import type { StateCreator } from "zustand";
import { buildSearchIndex } from "@/lib/search-index";
import type { Category, Question, QuestionStatus } from "@/types/knowledge";
import {
  buildQuestionIndex,
  buildQuestionLocationIndex,
  buildSolutionLocationIndex,
  findCategory,
  mapCategories
} from "../workspace-helpers";
import type { WorkspaceState } from "../workspace-store";

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
    // Preserve any optimistic SR state the client set that the server doesn't know about yet
    const localSrDue = new Map(
      [...get().questionById.values()]
        .filter((q) => q.srDue !== null)
        .map((q) => [q.id, q.srDue!])
    );
    const categories = localSrDue.size === 0
      ? incomingCategories
      : mapCategories(incomingCategories, (cat) => ({
          ...cat,
          questions: cat.questions.map((q) =>
            !q.srDue && localSrDue.has(q.id) ? { ...q, srDue: localSrDue.get(q.id)! } : q
          )
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
