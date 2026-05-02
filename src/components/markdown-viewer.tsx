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
    <div className="min-w-0 w-full overflow-hidden">
      <div className="prose prose-slate max-w-none min-w-0 overflow-hidden break-words prose-headings:break-words prose-headings:tracking-normal prose-p:break-words prose-p:text-slate-700 prose-li:break-words prose-a:break-all prose-code:break-all prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:rounded-lg prose-pre:bg-slate-950 prose-pre:text-slate-50 prose-table:block prose-table:w-full prose-table:max-w-full prose-table:overflow-x-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
