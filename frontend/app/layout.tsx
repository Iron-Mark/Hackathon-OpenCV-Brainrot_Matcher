import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "brainrot-matcher",
  description:
    "Match a photo or webcam to Italian and Indonesian brainrot characters with OpenCV, a percentage score, and replayable chants.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
