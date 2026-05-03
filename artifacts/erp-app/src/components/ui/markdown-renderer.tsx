import React from "react";
import { cn } from "@/lib/utils";

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={i} className="font-semibold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**") && part.length > 2) {
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code key={i} className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[0.8em] font-mono">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

function processLines(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.startsWith("#### ")) {
      elements.push(<h4 key={i} className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-3 mb-0.5">{parseInline(line.slice(5))}</h4>);
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-sm font-bold text-gray-800 dark:text-gray-100 mt-3 mb-1 uppercase tracking-wide">{parseInline(line.slice(4))}</h3>);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-semibold text-gray-900 dark:text-white mt-4 mb-1.5 pb-1 border-b border-gray-100 dark:border-gray-800">
          {parseInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-lg font-bold text-gray-900 dark:text-white mt-2 mb-1">{parseInline(line.slice(2))}</h1>);
      i++;
      continue;
    }

    if (line.match(/^[-*]{3,}$/) || line.match(/^_{3,}$/)) {
      elements.push(<hr key={i} className="border-gray-200 dark:border-gray-700 my-3" />);
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre key={`code-${i}`} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2 text-gray-800 dark:text-gray-200">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-[3px] border-indigo-400 pl-3 my-2 text-gray-600 dark:text-gray-400 italic text-sm">
          {quoteLines.map((l, j) => (
            <React.Fragment key={j}>{parseInline(l)}{j < quoteLines.length - 1 ? <br /> : null}</React.Fragment>
          ))}
        </blockquote>
      );
      continue;
    }

    if (line.match(/^[-*•] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*•] /)) {
        items.push(lines[i].replace(/^[-*•] /, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1.5 my-2">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="mt-[0.4rem] h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              <span className="leading-relaxed">{parseInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      let num = 0;
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        const m = lines[i].match(/^\d+\. (.*)/);
        if (m) { items.push(m[1]); num++; }
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-1.5 my-2">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-indigo-500 min-w-[1.4rem] text-xs mt-0.5 flex-shrink-0">{j + 1}.</span>
              <span className="leading-relaxed">{parseInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].match(/^[-*•] /) &&
      !lines[i].match(/^\d+\. /) &&
      !lines[i].startsWith("> ") &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^[-*]{3,}$/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      elements.push(
        <p key={`p-${i}`} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-1.5">
          {paraLines.map((l, j) => (
            <React.Fragment key={j}>
              {parseInline(l)}
              {j < paraLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  return elements;
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const elements = processLines(content);
  return (
    <div className={cn("markdown-body", className)}>
      {elements}
    </div>
  );
}
