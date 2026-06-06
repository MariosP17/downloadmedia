"use client";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import { Toaster } from "react-hot-toast";
import { useState } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <title>Server Downloader</title>
        <meta name="description" content="A media downloader built with Next.js and Stremio's Cinemeta API." />
      </head>
      <body className="min-h-full flex flex-col">
        <TopBar onToggleSidebar={() => setSidebarOpen((s) => !s)} />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {children}
        <Toaster position="bottom-right" reverseOrder={false} />
      </body>
    </html>
  );
}
