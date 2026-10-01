import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Positive Mind Care — Attendance",
  description: "Attendance, punch in/out and salary slips",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
