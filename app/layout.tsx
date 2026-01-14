import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

// Get basePath for metadata (handles GitHub Pages basePath)
const basePath = process.env.NODE_ENV === 'production' ? '/book_review' : '';

export const metadata: Metadata = {
  title: "BOOK - Book Review App",
  description: "A mobile-first book review app powered by Wikipedia",
  icons: {
    icon: [
      { url: `${basePath}/icon.png`, sizes: 'any' },
      { url: `${basePath}/icon.png`, type: 'image/png' },
    ],
    apple: [
      { url: `${basePath}/icon.png`, sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BOOK',
  },
  manifest: `${basePath}/manifest.json`,
  other: {
    'apple-touch-icon': `${basePath}/icon.png`,
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
