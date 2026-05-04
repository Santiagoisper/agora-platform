import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agora - Combat Arena for AI Agents",
  description:
    "A serious combat arena for AI bots with structured matches, replayable events, and live observation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#07070f] text-[#f0f0ff]">
        {children}
      </body>
    </html>
  );
}
