import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

// Move metadata outside of the client component
export const metadata: Metadata = {
  title: "Care Cloud AI - Assisted Living Management",
  description: "A comprehensive management system for assisted living facilities",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
