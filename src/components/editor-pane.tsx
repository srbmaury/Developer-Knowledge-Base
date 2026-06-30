"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, Copy, FileCode2, Lightbulb, Loader2, MessageSquare, Pin, Plus, Save, Star, Trash2, X } from "lucide-react";
import type { ReviewResult } from "@/lib/ai-answer";
import { toast } from "sonner";
import { DIFFICULTIES, LANGUAGES } from "@/lib/constants";
import { workspaceSync } from "@/lib/workspace-sync";
import { cn } from "@/lib/utils";
import { getAllQuestions, getCategoryForQuestion, useWorkspaceStore } from "@/store/workspace-store";
import type { Difficulty, SolutionLanguage } from "@/types/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownWorkspace, type MarkdownViewMode } from "@/components/markdown-workspace";
import type { Question, Solution } from "@/types/knowledge";

function isNewQuestion(question: Question, solution: Solution) {
  return question.title.trim() === "" && solution.content.trim() === "";
}

export function EditorPane() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewingSolutionId, setReviewingSolutionId] = useState<string | null>(null);
  const [contentView, setContentView] = useState<MarkdownViewMode>("preview");
  const previousQuestionId = useRef<string | null>(null);
  const {
    categories,
    selectedQuestionId,
    selectedSolutionId,
    selectSolution,
    addSolution,
    deleteSolution,
    updateQuestionTitle,
    updateQuestionDescription,
    updateQuestionDifficulty,
    updateSolutionTitle,
    updateSolutionLanguage,
    updateSolutionContent,
    updateSolutionNotes,
    toggleFavorite,
    toggleImportant,
    creatingSolutionQuestionIds,
    creatingQuestionCategoryIds,
    saveStatus,
    updateSolutionAiReview
  } = useWorkspaceStore();
  const question = getAllQuestions(categories).find((item) => item.id === selectedQuestionId);
  const solution = question?.solutions.find((item) => item.id === selectedSolutionId) ?? question?.solutions[0];
  const selectedCategory = getCategoryForQuestion(categories, question?.id);
  const canEdit = selectedCategory?.canEdit ?? false;
  const questionDescription = question?.description;
  const isCreatingSolution = Boolean(question && creatingSolutionQuestionIds.includes(question.id));
  const isCreatingQuestion = Boolean(selectedQuestionId && selectedQuestionId.startsWith("temp-question"));

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = descriptionRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 72)}px`;
    }
  }, [questionDescription]);

  useEffect(() => {
    if (!question || !solution || !selectedQuestionId) return;

    if (previousQuestionId.current !== selectedQuestionId) {
      previousQuestionId.current = selectedQuestionId;
      setContentView(isNewQuestion(question, solution) ? "editor" : "preview");

      if (isNewQuestion(question, solution)) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            titleRef.current?.focus();
            titleRef.current?.select();
            titleRef.current?.scrollIntoView({ block: "nearest" });
          });
        });
      }
    }
  }, [question, selectedQuestionId, solution]);

  async function generateAnswer() {
    if (!question || !solution) return;

    setIsGenerating(true);
    try {
      const response = await fetch("/api/ai/generate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionTitle: question.title,
          questionDescription: question.description,
          difficulty: question.difficulty,
          language: solution.language,
          defaultLanguage: useWorkspaceStore.getState().defaultLanguage
        })
      });

      const raw = await response.text();
      let data: { content?: string; difficulty?: Difficulty; error?: string } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          throw new Error("Server returned an invalid response.");
        }
      }

      if (!response.ok || !data.content) {
        throw new Error(data.error ?? (raw || "Unable to generate an answer."));
      }

      if (data.difficulty && data.difficulty !== question.difficulty) {
        updateQuestionDifficulty(question.id, data.difficulty);
      }

      updateSolutionContent(solution.id, data.content);
      setContentView("preview");
      toast.success(
        data.difficulty && data.difficulty !== question.difficulty
          ? `Answer generated · difficulty set to ${data.difficulty}`
          : "Markdown answer generated"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate an answer.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function reviewSolution() {
    if (!question || !solution || !solution.content.trim()) return;

    const targetId = solution.id;
    setReviewingSolutionId(targetId);
    try {
      const response = await fetch("/api/ai/review-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionTitle: question.title,
          questionDescription: question.description,
          solutionContent: solution.content,
          solutionLanguage: solution.language
        })
      });

      const raw = await response.text();
      let data: ReviewResult & { error?: string };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to review the answer.");
      }

      updateSolutionAiReview(targetId, data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to review the answer.");
    } finally {
      setReviewingSolutionId(null);
    }
  }

  if (!question || !solution) {
    if (isCreatingQuestion) {
      return (
        <div className="flex min-h-full items-center justify-center p-8">
          <div className="max-w-md rounded-lg border border-dashed bg-card p-8 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Creating question...</h1>
            <p className="mt-2 text-sm text-muted-foreground">Setting up your new note.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-dashed bg-card p-8 text-center">
          <FileCode2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Select a question</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose a note from the sidebar or create a new question to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <article className="min-w-0">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-4 border-b pb-5">
        <div className="flex flex-col gap-3">
          {/* Top Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Input
                ref={titleRef}
                value={question.title}
                onChange={(event) => updateQuestionTitle(question.id, event.target.value)}
                readOnly={!canEdit}
                title={question.title || "Enter a title"}
                className="h-12 w-full border-0 bg-transparent px-0 py-0 text-2xl font-semibold tracking-normal shadow-none focus-visible:ring-0 sm:text-4xl"
                aria-label="Question title"
                placeholder="Enter a title"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <SaveStatusIndicator status={saveStatus} />

              <select
                value={question.difficulty}
                onChange={(event) =>
                  updateQuestionDifficulty(question.id, event.target.value as Difficulty)
                }
                disabled={!canEdit}
                className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Question difficulty"
              >
                {DIFFICULTIES.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>

              {canEdit ? (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleImportant(question.id)}
                    aria-label="Mark important"
                  >
                    <Pin
                      className={cn(
                        "h-4 w-4",
                        question.isPinned && "fill-accent text-accent"
                      )}
                    />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleFavorite(question.id)}
                    aria-label="Toggle favorite"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        question.isFavorite && "fill-amber-400 text-amber-400"
                      )}
                    />
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {/* Description Row */}
          <div className="flex flex-col gap-1">
            <Textarea
              ref={descriptionRef}
              value={question.description}
              onChange={(event) =>
                updateQuestionDescription(question.id, event.target.value)
              }
              readOnly={!canEdit}
              title={question.description || "Add a short description"}
              rows={1}
              className="w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground shadow-none focus-visible:ring-0 min-h-0 max-h-[4.5rem]"
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.currentTarget;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 72)}px`;
              }}
              aria-label="Question description"
              placeholder="Add a short description"
            />
          </div>
        </div>
        </div>

        <Tabs value={solution.id} onValueChange={selectSolution} className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="max-w-full overflow-x-auto">
              {question.solutions.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.title}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={solution.language}
                onChange={(event) => updateSolutionLanguage(solution.id, event.target.value as SolutionLanguage)}
                disabled={!canEdit}
                className="h-9 w-40 rounded-md border bg-background px-3 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Solution language"
              >
                {LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
              {canEdit ? (
                <>
                  <Button
                    variant="secondary"
                    disabled={isCreatingSolution}
                    onClick={() => {
                      void addSolution(question.id, "Untitled approach");
                    }}
                  >
                    {isCreatingSolution ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {isCreatingSolution ? "Adding" : "Solution"}
                  </Button>
              <Button variant="outline" onClick={generateAnswer} disabled={isGenerating}>
                <Bot className="h-4 w-4" />
                {isGenerating ? "Generating…" : "AI answer"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void reviewSolution()}
                disabled={reviewingSolutionId !== null || !solution.content.trim()}
                title={!solution.content.trim() ? "Add some content before reviewing" : undefined}
              >
                {reviewingSolutionId === solution.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <MessageSquare className="h-4 w-4" />}
                {reviewingSolutionId === solution.id ? "Reviewing…" : "Review"}
              </Button>
                </>
              ) : null}
            </div>
          </div>

          {question.solutions.map((item) => (
            <TabsContent key={item.id} value={item.id} className="mt-4">
              <section className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <FileCode2 className="h-4 w-4 shrink-0 text-accent" />
                    <Input
                      value={item.title}
                      onChange={(event) => updateSolutionTitle(item.id, event.target.value)}
                      readOnly={!canEdit}
                      title={item.title || "Untitled approach"}
                      className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 font-medium shadow-none focus-visible:ring-0"
                      aria-label="Approach title"
                      placeholder="Untitled approach"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(item.content);
                        toast.success("Copied markdown");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                    {canEdit ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await workspaceSync.updateSolution(item.id, {
                              title: item.title,
                              language: item.language,
                              content: item.content,
                              notes: item.notes
                            });
                            toast.success("Saved");
                          }}
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={question.solutions.length <= 1}
                          title={
                            question.solutions.length <= 1
                              ? "Each question must keep at least one approach"
                              : "Delete approach"
                          }
                          onClick={() => {
                            if (question.solutions.length <= 1) return;
                            if (window.confirm(`Delete "${item.title}"?`)) {
                              void deleteSolution(item.id);
                            }
                          }}
                          aria-label="Delete approach"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <MarkdownWorkspace
                  content={item.content}
                  onChange={(content) => updateSolutionContent(item.id, content)}
                  language={item.language}
                  viewMode={contentView}
                  onViewModeChange={setContentView}
                  readOnly={!canEdit}
                />

                {(canEdit || item.notes) ? (
                  <div className="border-t px-4 py-3">
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                    <Textarea
                      value={item.notes}
                      onChange={(e) => updateSolutionNotes(item.id, e.target.value)}
                      readOnly={!canEdit}
                      placeholder="Edge cases, time complexity, personal observations…"
                      className="min-h-[72px] resize-y border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                    />
                  </div>
                ) : null}
                {reviewingSolutionId === item.id ? (
                  <div className="border-t px-4 py-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>AI is reviewing your solution…</span>
                  </div>
                ) : item.aiReview ? (
                  <ReviewPanel
                    review={item.aiReview}
                    onDismiss={() => updateSolutionAiReview(item.id, null)}
                  />
                ) : null}
              </section>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </article>
  );
}

const RATING_STYLES: Record<ReviewResult["rating"], string> = {
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  "needs-work": "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  poor: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
};

const RATING_LABEL: Record<ReviewResult["rating"], string> = {
  good: "Good",
  "needs-work": "Needs work",
  poor: "Poor"
};

function ReviewPanel({ review, onDismiss }: { review: ReviewResult; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  return (
    <div ref={ref} className="border-t px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI Review</p>
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", RATING_STYLES[review.rating])}>
            {RATING_LABEL[review.rating]}
          </span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={onDismiss} aria-label="Dismiss review">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{review.summary}</p>
      {review.feedback.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {review.feedback.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              {item.type === "strength" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : item.type === "issue" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              )}
              <span className="leading-snug">{item.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SaveStatusIndicator({ status }: { status: "idle" | "pending" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;

  const content = {
    pending: { label: "Unsaved changes", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    saving: { label: "Saving", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    saved: { label: "Saved", icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> },
    error: { label: "Save failed", icon: <AlertCircle className="h-3.5 w-3.5 text-destructive" /> }
  }[status];

  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs text-muted-foreground shadow-sm">
      {content.icon}
      {content.label}
    </span>
  );
}
