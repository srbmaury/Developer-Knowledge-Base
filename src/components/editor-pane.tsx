"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, Copy, FileCode2, Lightbulb, Loader2, MessageSquare, Pin, Plus, Save, Star, Trash2, X } from "lucide-react";
import type { ReviewResult } from "@/lib/ai-answer";
import { toast } from "sonner";
import { DIFFICULTIES, LANGUAGES, difficultyBadgeClass } from "@/lib/constants";
import { TAG_COLOR_CLASSES, TAG_COLORS, TAG_DOT_CLASSES } from "@/lib/tag-colors";
import { CheckCircle, Circle, Clock } from "lucide-react";
import { workspaceSync } from "@/lib/workspace-sync";
import { cn } from "@/lib/utils";
import { getAllQuestions, getCategoryForQuestion, useWorkspaceStore } from "@/store/workspace-store";
import type { Difficulty, QuestionStatus, SolutionLanguage, Tag, TagColor } from "@/types/knowledge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  const [justReviewedSolutionId, setJustReviewedSolutionId] = useState<string | null>(null);
  const [reviewedSolutionIds, setReviewedSolutionIds] = useState(new Set<string>());
  const [solutionToDelete, setSolutionToDelete] = useState<Solution | null>(null);
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
    saveStatus,
    updateSolutionAiReview,
    updateQuestionStatus,
    allTags,
    addTagToQuestion,
    removeTagFromQuestion,
    createTag
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
      setJustReviewedSolutionId(null);
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
      setJustReviewedSolutionId(targetId);
      setReviewedSolutionIds((prev) => new Set([...prev, targetId]));
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
                {reviewingSolutionId === solution.id
                  ? "Reviewing…"
                  : reviewedSolutionIds.has(solution.id)
                  ? "Re-review"
                  : "Review"}
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
                            setSolutionToDelete(item);
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

      <Dialog open={solutionToDelete !== null} onOpenChange={(open) => { if (!open) setSolutionToDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-base font-semibold">Delete approach?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">&ldquo;{solutionToDelete?.title}&rdquo;</span> and all its content will be permanently removed.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSolutionToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (solutionToDelete) void deleteSolution(solutionToDelete.id);
                setSolutionToDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

function ReviewPanel({ review, autoScroll, onDismiss }: { review: ReviewResult; autoScroll: boolean; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // autoScroll is intentionally read only at mount time
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

const STATUS_CONFIG: Record<QuestionStatus, { label: string; icon: React.ReactNode; className: string }> = {
  NOT_STARTED: {
    label: "Not started",
    icon: <Circle className="h-3 w-3" />,
    className: "text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/60"
  },
  IN_PROGRESS: {
    label: "In progress",
    icon: <Clock className="h-3 w-3 text-amber-500" />,
    className: "text-amber-600 border-amber-400/50 hover:border-amber-500 dark:text-amber-400"
  },
  SOLVED: {
    label: "Solved",
    icon: <CheckCircle className="h-3 w-3 text-emerald-500" />,
    className: "text-emerald-600 border-emerald-400/50 hover:border-emerald-500 dark:text-emerald-400"
  }
};

const STATUS_CYCLE: QuestionStatus[] = ["NOT_STARTED", "IN_PROGRESS", "SOLVED"];

function StatusCycleButton({ status, onChange }: { status: QuestionStatus; onChange: (s: QuestionStatus) => void }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["NOT_STARTED"];
  const safeStatus: QuestionStatus = STATUS_CONFIG[status] ? status : "NOT_STARTED";
  function next() {
    const idx = STATUS_CYCLE.indexOf(safeStatus);
    onChange(STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
  }
  return (
    <button
      onClick={next}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors", config.className)}
      title={`Status: ${config.label} — click to change`}
    >
      {config.icon}
      {config.label}
    </button>
  );
}

function TagManagerButton({
  questionId,
  questionTags,
  allTags,
  onCreate,
  onAdd
}: {
  questionId: string;
  questionTags: Tag[];
  allTags: Tag[];
  onCreate: (name: string, color: TagColor) => Promise<Tag | null>;
  onAdd: (questionId: string, tagId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColor>("blue");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const assignedIds = new Set(questionTags.map((t) => t.id));
  const available = allTags.filter(
    (t) => !assignedIds.has(t.id) && t.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const tag = await onCreate(newName.trim(), newColor);
    if (tag) {
      onAdd(questionId, tag.id);
      setNewName("");
      setNewColor("blue");
      setOpen(false);
    }
    setCreating(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Tag
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-card p-2 shadow-lg">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags…"
            className="mb-2 h-7 text-xs"
            autoFocus
          />
          {available.length > 0 ? (
            <div className="mb-2 max-h-40 space-y-0.5 overflow-y-auto">
              {available.map((tag) => (
                <button
                  key={tag.id}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                  onClick={() => {
                    onAdd(questionId, tag.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", TAG_DOT_CLASSES[tag.color])} />
                  {tag.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-2 px-2 text-xs text-muted-foreground">
              {search ? "No matching tags" : assignedIds.size === allTags.length ? "All tags applied" : null}
            </p>
          )}
          <div className="border-t pt-2">
            <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">New tag</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tag name"
              className="mb-2 h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
            />
            <div className="mb-2 flex flex-wrap gap-1.5 px-1">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "h-4 w-4 rounded-full transition-transform hover:scale-110",
                    TAG_DOT_CLASSES[color],
                    newColor === color && "ring-2 ring-primary ring-offset-1"
                  )}
                  onClick={() => setNewColor(color)}
                  title={color}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="h-7 w-full text-xs"
              disabled={!newName.trim() || creating}
              onClick={() => void handleCreate()}
            >
              {creating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Create & add
            </Button>
          </div>
        </div>
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
