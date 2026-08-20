import type { Metadata } from "next";
import { Space_Grotesk, Noto_Serif_TC, Noto_Sans_TC, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const headline = Noto_Serif_TC({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = Noto_Sans_TC({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "NewsHub — 多來源即時新聞聚合",
  description: "中央社、自由時報、公視新聞網即時聚合，AI 主題標籤、多家媒體重複報導自動偵測。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${display.variable} ${headline.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-body">{children}</body>
    </html>
  );
}
