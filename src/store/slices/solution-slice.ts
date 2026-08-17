import type { StateCreator } from "zustand";
import { toast } from "sonner";
import { workspaceSync } from "@/lib/workspace-sync";
import type { ReviewResult } from "@/lib/ai-answer";
import type { Solution, SolutionLanguage } from "@/types/knowledge";
import {
  buildQuestionIndex,
  canEditQuestion,
  canEditSolution,
  findCategory,
  incrementalIndexUpdate,
  removeSolutionFromTree,
  setPendingValue,
  temporaryId,
  updateQuestionInTree,
  updateSolutionInTree
} from "../workspace-helpers";
import {
  cancelPendingSolutionSave,
  queuePendingSolutionPatch,
  resolveTempSolutionEdit,
  scheduleBulkSave,
  scheduleSolutionNotesSave,
  scheduleSolutionSave,
  scheduleSolutionTitleSave,
  stashTempSolutionEdit
} from "../workspace-save-scheduler";
import type { WorkspaceState } from "../workspace-store";

export type SolutionSlice = {
  addSolution: (questionId: string, title: string) => Promise<void>;
  deleteSolution: (solutionId: string) => Promise<void>;
  updateSolutionTitle: (solutionId: string, title: string) => void;
  updateSolutionLanguage: (solutionId: string, language: SolutionLanguage) => void;
  updateSolutionContent: (solutionId: string, content: string) => void;
  updateSolutionNotes: (solutionId: string, notes: string) => void;
  fetchSolutionContent: (solutionId: string) => Promise<void>;
  updateSolutionAiReview: (solutionId: string, review: ReviewResult | null) => void;
};

export const createSolutionSlice: StateCreator<WorkspaceState, [], [], SolutionSlice> = (set, get) => ({
  addSolution: async (questionId, title) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    if (get().creatingSolutionQuestionIds.includes(questionId)) return;
    const tempSolutionId = temporaryId("temp-solution");
    const question = get().questionById.get(questionId);
    const order = question?.solutions.length ?? 0;
    const selectedSolution = question?.solutions.find((solution) => solution.id === get().selectedSolutionId);
    const language = selectedSolution?.language ?? question?.solutions.at(-1)?.language ?? get().defaultLanguage;
    const optimisticSolution: Solution = {
      id: tempSolutionId,
      questionId,
      title,
      language,
      content: "",
      notes: "",
      aiReview: null,
      contentLoaded: true,
      order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    set((state) => ({
      creatingSolutionQuestionIds: setPendingValue(state.creatingSolutionQuestionIds, questionId, true),
      categories: updateQuestionInTree(state.categories, questionId, (item) => ({
        ...item,
        solutions: [...item.solutions, optimisticSolution]
      })),
      selectedSolutionId: tempSolutionId
    }));

    try {
      const result = await workspaceSync.createSolution(questionId, title, language);
      if (!result.ok || !("id" in result)) {
        toast.error("Failed to create solution.");
        set((state) => ({
          categories: removeSolutionFromTree(state.categories, tempSolutionId),
          selectedSolutionId: state.selectedSolutionId === tempSolutionId ? question?.solutions[0]?.id ?? null : state.selectedSolutionId
        }));
        return;
      }
      set((state) => ({
        categories: updateSolutionInTree(state.categories, tempSolutionId, (solution) => ({
          ...solution,
          id: result.id
        })),
        selectedSolutionId: state.selectedSolutionId === tempSolutionId ? result.id : state.selectedSolutionId
      }));
      resolveTempSolutionEdit(tempSolutionId, result.id);
    } finally {
      set((state) => ({
        creatingSolutionQuestionIds: setPendingValue(state.creatingSolutionQuestionIds, questionId, false)
      }));
    }
  },
  deleteSolution: async (solutionId) => {
    if (!canEditSolution(get().categories, solutionId)) return;
    const loc = get().solutionIdToLocation.get(solutionId);
    const ownerCat = loc ? findCategory(get().categories, loc.categoryId) : null;
    const question = ownerCat?.questions.find((q) => q.id === loc?.questionId)
      ?? get().questionById.get(loc?.questionId ?? "");
    if (!question) return;

    if (question.solutions.length <= 1) {
      toast.error("A question must have at least one approach.");
      return;
    }

    const result = await workspaceSync.deleteSolution(solutionId);
    if (!result.ok) {
      toast.error("message" in result ? result.message : "Failed to delete approach.");
      return;
    }

    cancelPendingSolutionSave(solutionId);

    set((state) => {
      const categories = removeSolutionFromTree(state.categories, solutionId);
      const updatedCat = loc ? findCategory(categories, loc.categoryId) : null;
      const updatedQuestion = updatedCat?.questions.find((q) => q.id === question?.id);
      const nextSolutionId =
        state.selectedSolutionId === solutionId
          ? (updatedQuestion?.solutions[0]?.id ?? null)
          : state.selectedSolutionId;

      return {
        categories,
        questionById: buildQuestionIndex(categories),
        selectedSolutionId: nextSolutionId
      };
    });

    toast.success("Approach deleted");
  },
  updateSolutionTitle: (solutionId, title) => {
    if (!canEditSolution(get().categories, solutionId)) return;
    set((state) => {
      const categories = updateSolutionInTree(state.categories, solutionId, (solution) => ({ ...solution, title }));
      return {
        categories,
        questionById: buildQuestionIndex(categories)
      };
    });
    scheduleSolutionTitleSave(solutionId, title);
  },
  updateSolutionLanguage: (solutionId, language) => {
    if (!canEditSolution(get().categories, solutionId)) return;
    set((state) => {
      const categories = updateSolutionInTree(state.categories, solutionId, (solution) => ({ ...solution, language }));
      return {
        categories,
        questionById: buildQuestionIndex(categories),
        ...(language !== "none" ? { defaultLanguage: language } : {})
      };
    });
    if (solutionId.startsWith("temp-")) {
      stashTempSolutionEdit(solutionId, { language });
    } else {
      queuePendingSolutionPatch(solutionId, { language });
      scheduleBulkSave();
    }
  },
  updateSolutionContent: (solutionId, content) => {
    if (!canEditSolution(get().categories, solutionId)) return;
    set((state) => {
      const loc = state.solutionIdToLocation.get(solutionId);
      const categories = updateSolutionInTree(state.categories, solutionId, (solution) => ({
        ...solution,
        content,
        contentLoaded: true
      }));
      if (loc && state.searchIndex) {
        const cat = findCategory(categories, loc.categoryId);
        const q = cat?.questions.find((item) => item.id === loc.questionId);
        if (q) incrementalIndexUpdate(state.searchIndex, q);
      }
      return {
        categories,
        questionById: buildQuestionIndex(categories)
      };
    });
    scheduleSolutionSave(solutionId, content);
  },
  updateSolutionNotes: (solutionId, notes) => {
    if (!canEditSolution(get().categories, solutionId)) return;
    set((state) => {
      const loc = state.solutionIdToLocation.get(solutionId);
      const categories = updateSolutionInTree(state.categories, solutionId, (solution) => ({
        ...solution,
        notes,
        contentLoaded: true
      }));
      if (loc && state.searchIndex) {
        const cat = findCategory(categories, loc.categoryId);
        const q = cat?.questions.find((item) => item.id === loc.questionId);
        if (q) incrementalIndexUpdate(state.searchIndex, q);
      }
      return {
        categories,
        questionById: buildQuestionIndex(categories)
      };
    });
    scheduleSolutionNotesSave(solutionId, notes);
  },
  fetchSolutionContent: async (solutionId) => {
    const result = await workspaceSync.getSolutionContent(solutionId);
    if (!result.ok) {
      set((state) => ({
        failedSolutionContentIds: setPendingValue(state.failedSolutionContentIds, solutionId, true)
      }));
      return;
    }
    set((state) => {
      const loc = state.solutionIdToLocation.get(solutionId);
      const categories = updateSolutionInTree(state.categories, solutionId, (solution) => ({
        ...solution,
        content: result.content,
        notes: result.notes,
        aiReview: result.aiReview,
        contentLoaded: true
      }), { touchUpdatedAt: false });
      if (loc && state.searchIndex) {
        const cat = findCategory(categories, loc.categoryId);
        const q = cat?.questions.find((item) => item.id === loc.questionId);
        if (q) incrementalIndexUpdate(state.searchIndex, q);
      }
      return {
        categories,
        questionById: buildQuestionIndex(categories),
        failedSolutionContentIds: setPendingValue(state.failedSolutionContentIds, solutionId, false)
      };
    });
  },
  updateSolutionAiReview: (solutionId, review) => {
    if (!canEditSolution(get().categories, solutionId)) return;
    set((state) => {
      const categories = updateSolutionInTree(state.categories, solutionId, (solution) => ({ ...solution, aiReview: review }));
      return {
        categories,
        questionById: buildQuestionIndex(categories)
      };
    });
    void workspaceSync.updateSolution(solutionId, { aiReview: review });
  }
});
