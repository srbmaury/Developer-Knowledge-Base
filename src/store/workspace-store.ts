"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import MiniSearch from "minisearch";
import type { Category, Question, QuestionStatus, SolutionLanguage, Tag } from "@/types/knowledge";
import {
  flattenQuestions,
  findCategory,
  findCategoryForQuestion,
  sortQuestions,
  type SolutionLocation
} from "./workspace-helpers";
import { registerSaveStatusSetter, type SaveStatus } from "./workspace-save-scheduler";
import { createUiSlice, type UiSlice } from "./slices/ui-slice";
import { createCategorySlice, type CategorySlice } from "./slices/category-slice";
import { createQuestionSlice, type QuestionSlice } from "./slices/question-slice";
import { createSolutionSlice, type SolutionSlice } from "./slices/solution-slice";
import { createTagSlice, type TagSlice } from "./slices/tag-slice";

export type { SaveStatus };

type WorkspaceData = {
  defaultLanguage: SolutionLanguage;
  categories: Category[];
  selectedCategoryId: string | null;
  selectedQuestionId: string | null;
  selectedSolutionId: string | null;
  expandedCategoryIds: string[];
  creatingCategoryKeys: string[];
  creatingQuestionCategoryIds: string[];
  creatingSolutionQuestionIds: string[];
  saveStatus: SaveStatus;
  query: string;
  commandOpen: boolean;
  shortcutsOpen: boolean;

  /** Derived indexes for faster lookups (not persisted) */
  questionById: Map<string, Question>;
  questionIdToCategoryId: Map<string, string>;
  solutionIdToLocation: Map<string, SolutionLocation>;

  searchIndex: MiniSearch | null;
  filterStatus: QuestionStatus | null;
  allTags: Tag[];
  filterTagIds: string[];
};

export type WorkspaceState = WorkspaceData & UiSlice & CategorySlice & QuestionSlice & SolutionSlice & TagSlice;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get, api) => {
      registerSaveStatusSetter((status) => set({ saveStatus: status }));

      return {
        defaultLanguage: "typescript",
        searchIndex: null,
        categories: [],
        selectedCategoryId: null,
        selectedQuestionId: null,
        selectedSolutionId: null,
        expandedCategoryIds: [],
        creatingCategoryKeys: [],
        creatingQuestionCategoryIds: [],
        creatingSolutionQuestionIds: [],
        saveStatus: "idle",
        query: "",
        commandOpen: false,
        shortcutsOpen: false,
        questionById: new Map(),
        questionIdToCategoryId: new Map(),
        solutionIdToLocation: new Map(),
        filterStatus: null,
        allTags: [],
        filterTagIds: [],

        ...createUiSlice(set, get, api),
        ...createCategorySlice(set, get, api),
        ...createQuestionSlice(set, get, api),
        ...createSolutionSlice(set, get, api),
        ...createTagSlice(set, get, api)
      };
    },
    {
      name: "developer-knowledge-base-workspace",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        defaultLanguage: state.defaultLanguage,
        selectedCategoryId: state.selectedCategoryId,
        selectedQuestionId: state.selectedQuestionId,
        selectedSolutionId: state.selectedSolutionId,
        expandedCategoryIds: state.expandedCategoryIds,
        filterTagIds: state.filterTagIds
      })
    }
  )
);

export function getAllQuestions(categories: Category[]) {
  return flattenQuestions(categories);
}

export function sortQuestionsForDisplay(questions: Question[]) {
  return sortQuestions(questions);
}

export function getCategoryForQuestion(categories: Category[], questionId: string | null | undefined) {
  return questionId ? findCategoryForQuestion(categories, questionId) : null;
}

export function getCategoryById(categories: Category[], categoryId: string | null | undefined) {
  return categoryId ? findCategory(categories, categoryId) : null;
}
