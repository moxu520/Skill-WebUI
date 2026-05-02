import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skill WebUI",
  description: "本地技能管理工作台",
};

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
