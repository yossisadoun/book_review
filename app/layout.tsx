import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

// Get basePath for favicon (handles GitHub Pages basePath)
const basePath = process.env.NODE_ENV === 'production' ? '/book_review' : '';
const faviconPath = `${basePath}/icon.png`;

export const metadata: Metadata = {
  title: "BOOK - Book Review App",
  description: "A mobile-first book review app powered by Wikipedia",
  icons: {
    icon: [
      { url: faviconPath, sizes: 'any' },
      { url: faviconPath, type: 'image/png' },
    ],
    apple: faviconPath,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
