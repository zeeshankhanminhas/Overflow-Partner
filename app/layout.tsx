import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overflow Partner",
  description: "Engineering overflow capacity, delivered with control.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
