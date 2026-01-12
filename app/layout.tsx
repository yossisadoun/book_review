import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wiki Shelf - Book Review App",
  description: "A mobile-first book review app powered by Wikipedia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
