"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Copy, FileCode2, Loader2, MessageSquare, Plus, Save, Trash2, X } from "lucide-react";
import type { ReviewResult } from "@/lib/ai-answer";
import { toast } from "sonner";
import { DIFFICULTIES, LANGUAGES, difficultyBadgeClass } from "@/lib/constants";
import { TAG_COLOR_CLASSES } from "@/lib/tag-colors";
import { flushSolutionSave } from "@/store/workspace-save-scheduler";
import { cn } from "@/lib/utils";
import { getAllQuestions, getCategoryForQuestion, useWorkspaceStore } from "@/store/workspace-store";
import type { Difficulty, SolutionLanguage, Solution } from "@/types/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownWorkspace, type MarkdownViewMode } from "@/components/markdown-workspace";
import { computeBacklinks, exportQuestionToMarkdown, isNewQuestion } from "@/components/editor/editor-pane-utils";
import { QuestionActionsMenu } from "@/components/editor/question-actions-menu";
import { MoveToCategoryDialog } from "@/components/editor/move-to-category-dialog";
import { ReviewPanel } from "@/components/editor/review-panel";
import { StatusCycleButton } from "@/components/editor/status-cycle-button";
import { TagManagerButton } from "@/components/editor/tag-manager-button";
import { SaveStatusIndicator } from "@/components/editor/save-status-indicator";

export function EditorPane() {
  const [generatingSolutionIds, setGeneratingSolutionIds] = useState(new Set<string>());
  const [reviewingSolutionIds, setReviewingSolutionIds] = useState(new Set<string>());
  const [justReviewedSolutionId, setJustReviewedSolutionId] = useState<string | null>(null);
  const [reviewedSolutionIds, setReviewedSolutionIds] = useState(new Set<string>());
  const [pendingDeleteSolutionIds, setPendingDeleteSolutionIds] = useState(new Set<string>());
  const [contentView, setContentView] = useState<MarkdownViewMode>("preview");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const previousQuestionId = useRef<string | null>(null);
  const deleteSolutionTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = deleteSolutionTimers.current;
    return () => { timers.forEach(clearTimeout); };
  }, []);
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
    failedSolutionContentIds,
    fetchSolutionContent,
    saveStatus,
    updateSolutionAiReview,
    updateQuestionStatus,
    enrollInReview,
    unenrollFromReview,
    moveQuestion,
    allTags,
    addTagToQuestion,
    removeTagFromQuestion,
    createTag
  } = useWorkspaceStore();
  const question = getAllQuestions(categories).find((item) => item.id === selectedQuestionId);
  const backlinks = useMemo(
    () => (question ? computeBacklinks(categories, question.id) : []),
    [categories, question]
  );
  const visibleSolutions = useMemo(
    () => question?.solutions.filter((item) => !pendingDeleteSolutionIds.has(item.id)) ?? [],
    [question, pendingDeleteSolutionIds]
  );
  const solution = visibleSolutions.find((item) => item.id === selectedSolutionId) ?? visibleSolutions[0];
  const selectedCategory = getCategoryForQuestion(categories, question?.id);
  const canEdit = selectedCategory?.canEdit ?? false;
  const questionDescription = question?.description;
  const isCreatingSolution = Boolean(question && creatingSolutionQuestionIds.includes(question.id));
  const isCreatingQuestion = Boolean(selectedQuestionId && selectedQuestionId.startsWith("temp-question"));

  const articleRef = useRef<HTMLElement>(null);
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
      setJustReviewedSolutionId(null);
      // Scroll the editor pane back to the top when the selected question changes
      const scrollEl = articleRef.current?.closest('[data-scroll="editor"]') as HTMLElement | null;
      if (scrollEl) scrollEl.scrollTop = 0;
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
    const targetQuestion = question;
    const targetSolution = solution;
    const previousContent = targetSolution.content;

    setGeneratingSolutionIds((prev) => new Set(prev).add(targetSolution.id));
    try {
      const response = await fetch("/api/ai/generate-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionTitle: targetQuestion.title,
          questionDescription: targetQuestion.description,
          difficulty: targetQuestion.difficulty,
          language: targetSolution.language,
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

      if (data.difficulty && data.difficulty !== targetQuestion.difficulty) {
        updateQuestionDifficulty(targetQuestion.id, data.difficulty);
      }

      updateSolutionContent(targetSolution.id, data.content);
      // Only steal the view into "preview" if the user is still looking at this solution —
      // otherwise a generation finishing for a question the user has since navigated away from
      // would yank whatever question they're currently on into preview mode.
      if (useWorkspaceStore.getState().selectedSolutionId === targetSolution.id) {
        setContentView("preview");
      }
      const successMessage =
        data.difficulty && data.difficulty !== targetQuestion.difficulty
          ? `Answer generated · difficulty set to ${data.difficulty}`
          : "Markdown answer generated";

      if (previousContent.trim()) {
        // Generation overwrites whatever was there — give an explicit way back since there's
        // no confirm-before-overwrite step (AI answers can take a few seconds; blocking on a
        // dialog first would add friction for the common case of an empty/placeholder solution).
        toast(successMessage, {
          description: "Replaced existing content.",
          action: {
            label: "Undo",
            onClick: () => updateSolutionContent(targetSolution.id, previousContent)
          },
          duration: 8000
        });
      } else {
        toast.success(successMessage);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate an answer.");
    } finally {
      setGeneratingSolutionIds((prev) => {
        const next = new Set(prev);
        next.delete(targetSolution.id);
        return next;
      });
    }
  }

  async function reviewSolution() {
    if (!question || !solution || !solution.content.trim()) return;

    const targetId = solution.id;
    setReviewingSolutionIds((prev) => new Set(prev).add(targetId));
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
      setJustReviewedSolutionId(targetId);
      setReviewedSolutionIds((prev) => new Set([...prev, targetId]));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to review the answer.");
    } finally {
      setReviewingSolutionIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  }

  function handleDeleteSolutionRequest(item: Solution) {
    setPendingDeleteSolutionIds((prev) => new Set(prev).add(item.id));
    const timer = setTimeout(() => {
      void deleteSolution(item.id);
      setPendingDeleteSolutionIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      deleteSolutionTimers.current.delete(item.id);
    }, 5000);
    deleteSolutionTimers.current.set(item.id, timer);
    toast(`"${item.title || "Untitled approach"}" deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(deleteSolutionTimers.current.get(item.id));
          deleteSolutionTimers.current.delete(item.id);
          setPendingDeleteSolutionIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }
      },
      duration: 5000
    });
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
    <article ref={articleRef} className="min-w-0">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 border-b pb-5">
        <div className="flex flex-col gap-3">
          {/* Top Row */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
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

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <SaveStatusIndicator status={saveStatus} />

              <div
                className="flex overflow-hidden rounded-md border shadow-sm"
                role="group"
                aria-label="Question difficulty"
              >
                {DIFFICULTIES.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => updateQuestionDifficulty(question.id, level.value as Difficulty)}
                    className={cn(
                      "border-r px-3 py-1.5 text-xs font-medium last:border-r-0 transition-colors disabled:cursor-default",
                      question.difficulty === level.value
                        ? difficultyBadgeClass(level.value)
                        : "bg-background text-muted-foreground enabled:hover:bg-muted"
                    )}
                  >
                    {level.label}
                  </button>
                ))}
              </div>

              <QuestionActionsMenu
                question={question}
                canEdit={canEdit}
                onExport={() => exportQuestionToMarkdown(question)}
                onMove={() => setMoveDialogOpen(true)}
                onPin={() => toggleImportant(question.id)}
                onStar={() => toggleFavorite(question.id)}
                onReview={() => question.srDue ? unenrollFromReview(question.id) : enrollInReview(question.id)}
              />
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

          {/* Status + Tags Row */}
          {(canEdit || question.tags.length > 0) ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {canEdit ? (
                <StatusCycleButton
                  status={question.status}
                  onChange={(s) => updateQuestionStatus(question.id, s)}
                />
              ) : null}
              {question.tags.map((tag) => (
                <span key={tag.id} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", TAG_COLOR_CLASSES[tag.color])}>
                  {tag.name}
                  {canEdit ? (
                    <button
                      onClick={() => removeTagFromQuestion(question.id, tag.id)}
                      className="ml-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                      aria-label={`Remove tag ${tag.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </span>
              ))}
              {canEdit ? (
                <TagManagerButton
                  questionId={question.id}
                  questionTags={question.tags}
                  allTags={allTags}
                  onCreate={createTag}
                  onAdd={addTagToQuestion}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        </div>

        <Tabs value={solution.id} onValueChange={selectSolution} className="mt-5">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <TabsList className="max-w-full justify-start overflow-x-auto">
              {visibleSolutions.map((item) => (
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
              <Button variant="outline" onClick={generateAnswer} disabled={generatingSolutionIds.has(solution.id)}>
                <Bot className="h-4 w-4" />
                {generatingSolutionIds.has(solution.id) ? "Generating…" : "AI answer"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void reviewSolution()}
                disabled={reviewingSolutionIds.has(solution.id) || !solution.content.trim()}
                title={!solution.content.trim() ? "Add some content before reviewing" : undefined}
              >
                {reviewingSolutionIds.has(solution.id)
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <MessageSquare className="h-4 w-4" />}
                {reviewingSolutionIds.has(solution.id)
                  ? "Reviewing…"
                  : reviewedSolutionIds.has(solution.id)
                  ? "Re-review"
                  : "Review"}
              </Button>
                </>
              ) : null}
            </div>
          </div>

          {visibleSolutions.map((item) => (
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
                  <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
                            await flushSolutionSave(item.id, {
                              title: item.title,
                              language: item.language,
                              content: item.content,
                              notes: item.notes
                            });
                            if (useWorkspaceStore.getState().saveStatus === "error") {
                              toast.error("Failed to save. Please try again.");
                            } else {
                              toast.success("Saved");
                            }
                          }}
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={visibleSolutions.length <= 1}
                          title={
                            visibleSolutions.length <= 1
                              ? "Each question must keep at least one approach"
                              : "Delete approach"
                          }
                          onClick={() => {
                            if (visibleSolutions.length <= 1) return;
                            handleDeleteSolutionRequest(item);
                          }}
                          aria-label={`Delete ${item.title || "approach"}`}
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
                  loading={!item.contentLoaded && !failedSolutionContentIds.includes(item.id)}
                  error={failedSolutionContentIds.includes(item.id)}
                  onRetry={() => void fetchSolutionContent(item.id)}
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
                {reviewingSolutionIds.has(item.id) ? (
                  <div className="border-t px-4 py-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>AI is reviewing your solution…</span>
                  </div>
                ) : item.aiReview ? (
                  <ReviewPanel
                    review={item.aiReview}
                    autoScroll={justReviewedSolutionId === item.id}
                    onDismiss={() => {
                      if (justReviewedSolutionId === item.id) setJustReviewedSolutionId(null);
                      updateSolutionAiReview(item.id, null);
                    }}
                  />
                ) : null}
              </section>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {backlinks.length > 0 ? (
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-8">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="text-base leading-none">↩</span>
              Referenced by {backlinks.length} {backlinks.length === 1 ? "note" : "notes"}
            </p>
            <div className="space-y-2">
              {backlinks.map((bq) => (
                <button
                  key={bq.id}
                  type="button"
                  onClick={() => useWorkspaceStore.getState().selectQuestion(bq.id)}
                  className="block w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-background"
                >
                  <p className="text-sm font-medium text-foreground">{bq.title || "Untitled"}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <MoveToCategoryDialog
        open={moveDialogOpen}
        currentCategoryId={selectedCategory?.id}
        categories={categories}
        onSelect={(targetId) => { if (question) moveQuestion(question.id, targetId); }}
        onClose={() => setMoveDialogOpen(false)}
      />

    </article>
  );
}
