"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Copy, FileCode2, Pin, Plus, Save, Star, Trash2 } from "lucide-react";
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
  const [contentView, setContentView] = useState<MarkdownViewMode>("preview");
  const previousQuestionId = useRef<string | null>(null);
  const {
    categories,
    selectedQuestionId,
    selectedSolutionId,
    selectSolution,
    addSolution,
    deleteSolution,
    deleteQuestion,
    updateQuestionTitle,
    updateQuestionDescription,
    updateQuestionDifficulty,
    updateSolutionTitle,
    updateSolutionLanguage,
    updateSolutionContent,
    toggleFavorite,
    toggleImportant
  } = useWorkspaceStore();
  const question = getAllQuestions(categories).find((item) => item.id === selectedQuestionId);
  const solution = question?.solutions.find((item) => item.id === selectedSolutionId) ?? question?.solutions[0];
  const selectedCategory = getCategoryForQuestion(categories, question?.id);
  const canEdit = selectedCategory?.canEdit ?? false;
  const questionDescription = question?.description;

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
          language: solution.language
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

  if (!question || !solution) {
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
    <article>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-4 border-b pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Input
                ref={titleRef}
                value={question.title}
                onChange={(event) => updateQuestionTitle(question.id, event.target.value)}
                readOnly={!canEdit}
                className="h-12 truncate border-0 bg-transparent px-0 py-0 text-2xl font-semibold tracking-normal shadow-none focus-visible:ring-0 sm:text-4xl"
                aria-label="Question title"
                placeholder="Enter a title"
              />

              <Textarea
                ref={descriptionRef}
                value={question.description}
                onChange={(event) => updateQuestionDescription(question.id, event.target.value)}
                readOnly={!canEdit}
                rows={1}
                className="mt-3 max-w-2xl resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground shadow-none focus-visible:ring-0 min-h-0 max-h-[4.5rem]"
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
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={question.difficulty}
                onChange={(event) => updateQuestionDifficulty(question.id, event.target.value as Difficulty)}
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
                  <Button variant="outline" size="icon" onClick={() => toggleImportant(question.id)} aria-label="Mark important">
                    <Pin className={cn("h-4 w-4", question.isPinned && "fill-accent text-accent")} />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => toggleFavorite(question.id)} aria-label="Toggle favorite">
                    <Star className={cn("h-4 w-4", question.isFavorite && "fill-amber-400 text-amber-400")} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (window.confirm(`Delete "${question.title}"?`)) deleteQuestion(question.id);
                    }}
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              ) : null}
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
                onClick={() => {
                  void addSolution(question.id, "Untitled approach");
                }}
              >
                <Plus className="h-4 w-4" />
                Solution
              </Button>
              <Button variant="outline" onClick={generateAnswer} disabled={isGenerating}>
                <Bot className="h-4 w-4" />
                {isGenerating ? "Generating…" : "AI answer"}
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
              </section>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </article>
  );
}
