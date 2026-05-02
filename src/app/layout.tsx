import type { Metadata } from "next";
import "./globals.css";

/** 应用级元信息，用于浏览器标题和页面描述。 */
export const metadata: Metadata = {
  title: "Skill WebUI",
  description: "本地技能管理工作台",
};

/** 应用根布局，负责挂载全局样式和基础文档属性。 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full bg-slate-50 antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans text-slate-950">{children}</body>
    </html>
  );
}
