"use client";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import SavedBar from "./components/SavedBar"; // Assuming you have a SavedBar component

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
  const [savedBarOpen, setSavedBar] = useState(false);

  function ToggleSidebar() {
    if (savedBarOpen) setSavedBar(false);
    setSidebarOpen((s) => !s);
  }
  function ToggleSavedBar() {
    if (sidebarOpen) setSidebarOpen(false);
    setSavedBar((s) => !s);
  }

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
        <TopBar onToggleSidebar={() => ToggleSidebar()} onToggleSaved={() => ToggleSavedBar()} />
          
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <SavedBar open={savedBarOpen} onClose={() => setSavedBar(false)} />
        {children}
        <Toaster position="bottom-right" reverseOrder={false} />
      </body>
    </html>
  );
}
