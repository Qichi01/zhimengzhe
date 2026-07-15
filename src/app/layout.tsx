import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "织梦者 — AI 互动小说阅读器",
  description: "用文字编织梦境",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
