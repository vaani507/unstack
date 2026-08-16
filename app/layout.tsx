import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SensoryModeProvider } from "@/lib/sensory-mode";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unstack",
  description: "Break the freeze. One tiny step at a time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SensoryModeProvider>{children}</SensoryModeProvider>
      </body>
    </html>
  );
}
