// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DriveMapz",
    template: "%s — DriveMapz",
  },
  description: "DriveMapz — Trips, stops, fuel & tracking.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  applicationName: "DriveMapz",
  metadataBase: new URL("https://drivemapz.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-white text-black">
        {children}
      </body>
    </html>
  );
}
