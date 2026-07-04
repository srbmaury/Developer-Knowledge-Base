import type { StateCreator } from "zustand";
import { toast } from "sonner";
import { workspaceSync } from "@/lib/workspace-sync";
import type { Category, Question } from "@/types/knowledge";
import {
  buildQuestionIndex,
  canEditCategory,
  collectCategoryIds,
  findCategory,
  firstCategoryId,
  mapCategories,
  reorderCategoriesInTree,
  removeCategoryFromTree,
  setPendingValue,
  temporaryId
} from "../workspace-helpers";
import { runSave, scheduleCategoryNameSave } from "../workspace-save-scheduler";
import type { WorkspaceState } from "../workspace-store";

export type CategorySlice = {
  addCategory: (name: string, parentId?: string | null) => Promise<void>;
  updateCategoryName: (categoryId: string, name: string) => void;
  updateCategoryVisibility: (categoryId: string, isPublic: boolean) => void;
  deleteCategory: (categoryId: string) => void;
  reorderCategories: (parentId: string | null, categoryIds: string[]) => void;
};

export const createCategorySlice: StateCreator<WorkspaceState, [], [], CategorySlice> = (set, get) => ({
  addCategory: async (name, parentId = null) => {
    const { categories } = get();
    if (parentId && !canEditCategory(categories, parentId)) return;
    const pendingKey = parentId ?? "__root__";
    if (get().creatingCategoryKeys.includes(pendingKey)) return;
    const tempId = temporaryId("temp-category");
    const siblingCount = parentId
      ? (findCategory(categories, parentId)?.children.length ?? 0)
      : categories.length;
    const optimisticCategory: Category = {
      id: tempId,
      userId: "",
      name,
      isPublic: false,
      canEdit: true,
      parentId,
      order: siblingCount,
      createdAt: new Date().toISOString(),
      children: [],
      questions: []
    };

    set((state) => ({
      creatingCategoryKeys: setPendingValue(state.creatingCategoryKeys, pendingKey, true),
      categories: parentId
        ? mapCategories(state.categories, (item) =>
            item.id === parentId ? { ...item, children: [...item.children, optimisticCategory] } : item
          )
        : [...state.categories, optimisticCategory],
      selectedCategoryId: tempId,
      expandedCategoryIds: [...state.expandedCategoryIds, tempId, ...(parentId ? [parentId] : [])].filter(
        (id, index, ids) => ids.indexOf(id) === index
      )
    }));

    try {
      const result = await workspaceSync.createCategory(name, parentId, siblingCount);
      if (!result.ok || !("id" in result)) {
        toast.error("message" in result ? result.message : "Failed to create category.");
        set((state) => ({
          categories: removeCategoryFromTree(state.categories, tempId),
          selectedCategoryId: state.selectedCategoryId === tempId ? firstCategoryId(removeCategoryFromTree(state.categories, tempId)) : state.selectedCategoryId
        }));
        return;
      }
      const currentCategory = findCategory(get().categories, tempId);

      set((state) => ({
        categories: mapCategories(state.categories, (item) =>
          item.id === tempId ? { ...item, id: result.id } : item
        ),
        selectedCategoryId: state.selectedCategoryId === tempId ? result.id : state.selectedCategoryId,
        expandedCategoryIds: state.expandedCategoryIds.map((id) => (id === tempId ? result.id : id)).filter(
          (id, index, ids) => ids.indexOf(id) === index
        )
      }));
      if (currentCategory && currentCategory.name !== name) {
        runSave(() => workspaceSync.updateCategory(result.id, currentCategory.name));
      }
    } finally {
      set((state) => ({
        creatingCategoryKeys: setPendingValue(state.creatingCategoryKeys, pendingKey, false)
      }));
    }
  },
  updateCategoryName: (categoryId, name) => {
    if (!canEditCategory(get().categories, categoryId)) return;
    set((state) => ({
      categories: mapCategories(state.categories, (category) =>
        category.id === categoryId ? { ...category, name } : category
      )
    }));
    scheduleCategoryNameSave(categoryId, name);
  },
  updateCategoryVisibility: (categoryId, isPublic) => {
    if (!canEditCategory(get().categories, categoryId)) return;
    set((state) => ({
      categories: mapCategories(state.categories, (category) =>
        category.id === categoryId ? { ...category, isPublic } : category
      )
    }));
    void workspaceSync.updateCategoryVisibility(categoryId, isPublic);
  },
  deleteCategory: (categoryId) => {
    const target = findCategory(get().categories, categoryId);
    if (!target || !target.canEdit) return;

    const deletedCategoryIds = new Set(collectCategoryIds(target));
    void workspaceSync.deleteCategory(categoryId);

    set((state) => {
      const categories = removeCategoryFromTree(state.categories, categoryId);
      const newQuestionById = buildQuestionIndex(categories);
      const selectedQuestionRemoved =
        state.selectedQuestionId !== null && !newQuestionById.has(state.selectedQuestionId);
      const selectedCategoryRemoved =
        state.selectedCategoryId !== null && deletedCategoryIds.has(state.selectedCategoryId);
      const firstRemaining = newQuestionById.values().next().value as Question | undefined;
      const nextQuestion = selectedQuestionRemoved ? (firstRemaining?.id ?? null) : state.selectedQuestionId;
      const nextCategory = selectedCategoryRemoved
        ? ((nextQuestion ? newQuestionById.get(nextQuestion)?.categoryId : null) ?? firstCategoryId(categories))
        : state.selectedCategoryId;
      const nextSolution = selectedQuestionRemoved
        ? (firstRemaining?.solutions[0]?.id ?? null)
        : state.selectedSolutionId;

      return {
        categories,
        questionById: newQuestionById,
        selectedCategoryId: nextCategory,
        selectedQuestionId: nextQuestion,
        selectedSolutionId: nextSolution,
        expandedCategoryIds: state.expandedCategoryIds.filter((id) => !deletedCategoryIds.has(id))
      };
    });
  },
  reorderCategories: (parentId, categoryIds) => {
    set((state) => ({
      categories: reorderCategoriesInTree(state.categories, parentId, categoryIds)
    }));
    void workspaceSync.reorderCategories(parentId, categoryIds);
  }
});
