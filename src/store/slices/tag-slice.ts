import type { StateCreator } from "zustand";
import { workspaceSync } from "@/lib/workspace-sync";
import type { Tag, TagColor } from "@/types/knowledge";
import { canEditQuestion, mapCategories, updateQuestionInTree } from "../workspace-helpers";
import type { WorkspaceState } from "../workspace-store";

export type TagSlice = {
  setAllTags: (tags: Tag[]) => void;
  createTag: (name: string, color: TagColor) => Promise<Tag | null>;
  deleteTag: (tagId: string) => void;
  addTagToQuestion: (questionId: string, tagId: string) => void;
  removeTagFromQuestion: (questionId: string, tagId: string) => void;
  toggleTagFilter: (tagId: string) => void;
  clearTagFilter: () => void;
};

export const createTagSlice: StateCreator<WorkspaceState, [], [], TagSlice> = (set, get) => ({
  setAllTags: (tags) => set({ allTags: tags }),
  createTag: async (name, color) => {
    const result = await workspaceSync.createTag(name, color);
    if (!result.ok || !("id" in result)) return null;
    const newTag: Tag = { id: result.id, name, color };
    set((state) => ({ allTags: [...state.allTags, newTag].sort((a, b) => a.name.localeCompare(b.name)) }));
    return newTag;
  },
  deleteTag: (tagId) => {
    void workspaceSync.deleteTag(tagId);
    set((state) => ({
      allTags: state.allTags.filter((t) => t.id !== tagId),
      filterTagIds: state.filterTagIds.filter((id) => id !== tagId),
      categories: mapCategories(state.categories, (cat) => ({
        ...cat,
        questions: cat.questions.map((q) => ({ ...q, tags: q.tags.filter((t) => t.id !== tagId) }))
      }))
    }));
  },
  addTagToQuestion: (questionId, tagId) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    const tag = get().allTags.find((t) => t.id === tagId);
    if (!tag) return;
    set((state) => ({
      categories: updateQuestionInTree(state.categories, questionId, (q) =>
        q.tags.some((t) => t.id === tagId) ? q : { ...q, tags: [...q.tags, tag] }
      )
    }));
    void workspaceSync.addTagToQuestion(questionId, tagId);
  },
  removeTagFromQuestion: (questionId, tagId) => {
    if (!canEditQuestion(get().categories, questionId)) return;
    set((state) => ({
      categories: updateQuestionInTree(state.categories, questionId, (q) => ({
        ...q,
        tags: q.tags.filter((t) => t.id !== tagId)
      }))
    }));
    void workspaceSync.removeTagFromQuestion(questionId, tagId);
  },
  toggleTagFilter: (tagId) =>
    set((state) => ({
      filterTagIds: state.filterTagIds.includes(tagId)
        ? state.filterTagIds.filter((id) => id !== tagId)
        : [...state.filterTagIds, tagId]
    })),
  clearTagFilter: () => set({ filterTagIds: [] })
});
