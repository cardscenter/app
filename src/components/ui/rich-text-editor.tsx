"use client";

import { useRef, useCallback, useEffect } from "react";
import { Bold, Italic, Underline, List } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, rows = 4, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Only set innerHTML on first mount, never on re-renders (prevents cursor reset)
  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = value;
      initializedRef.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  const isActive = useCallback((command: string) => {
    return document.queryCommandState(command);
  }, []);

  const ToolbarButton = ({ command, icon: Icon, label }: { command: string; icon: typeof Bold; label: string }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        exec(command);
      }}
      className={`rounded-md p-1.5 transition-colors hover:bg-white/60 dark:hover:bg-white/10 ${
        isActive(command) ? "bg-white/40 dark:bg-white/15 text-foreground" : "text-muted-foreground"
      }`}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="mt-1 glass-input overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border/30 px-2 py-1.5">
        <ToolbarButton command="bold" icon={Bold} label="Vet" />
        <ToolbarButton command="italic" icon={Italic} label="Cursief" />
        <ToolbarButton command="underline" icon={Underline} label="Onderstreept" />
        <div className="mx-1 h-4 w-px bg-border/30" />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("insertUnorderedList");
          }}
          className="rounded-md p-1.5 transition-colors hover:bg-white/60 dark:hover:bg-white/10 text-muted-foreground"
          title="Opsommingslijst"
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="min-h-[calc(theme(spacing.10)*var(--rows))] px-3 py-2.5 text-foreground outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground/50 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        style={{ "--rows": rows } as React.CSSProperties}
      />
    </div>
  );
}
