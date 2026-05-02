"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown 预览组件的输入参数。 */
type MarkdownViewerProps = {
  content: string;
};

/** 将技能 Markdown 原文渲染为只读预览内容。 */
export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-slate max-w-none prose-headings:tracking-normal prose-p:text-slate-700 prose-pre:rounded-lg prose-pre:bg-slate-950 prose-pre:text-slate-50">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
