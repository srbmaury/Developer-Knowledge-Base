"use client";

import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote
} from "lucide-react";
import type { MarkdownInsertAction } from "@/lib/markdown-insert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MarkdownToolbarProps = {
  onAction: (action: MarkdownInsertAction) => void;
  className?: string;
};

const TOOLBAR_ITEMS: Array<{ action: MarkdownInsertAction; label: string; icon: React.ReactNode }> = [
  { action: "h1", label: "Heading 1", icon: <Heading1 className="h-4 w-4" /> },
  { action: "h2", label: "Heading 2", icon: <Heading2 className="h-4 w-4" /> },
  { action: "h3", label: "Heading 3", icon: <Heading3 className="h-4 w-4" /> },
  { action: "bullet", label: "Bullet list", icon: <List className="h-4 w-4" /> },
  { action: "ordered", label: "Numbered list", icon: <ListOrdered className="h-4 w-4" /> },
  { action: "bold", label: "Bold", icon: <Bold className="h-4 w-4" /> },
  { action: "italic", label: "Italic", icon: <Italic className="h-4 w-4" /> },
  { action: "code", label: "Inline code", icon: <Code className="h-4 w-4" /> },
  { action: "codeBlock", label: "Code block", icon: <Code2 className="h-4 w-4" /> },
  { action: "quote", label: "Quote", icon: <Quote className="h-4 w-4" /> },
  { action: "link", label: "Link", icon: <Link className="h-4 w-4" /> },
  { action: "hr", label: "Divider", icon: <Minus className="h-4 w-4" /> }
];

export function MarkdownToolbar({ onAction, className }: MarkdownToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5",
        className
      )}
      role="toolbar"
      aria-label="Markdown formatting"
    >
      {TOOLBAR_ITEMS.map((item) => (
        <Tooltip key={item.action}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 shrink-0 px-0"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onAction(item.action)}
              aria-label={item.label}
            >
              {item.icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{item.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
