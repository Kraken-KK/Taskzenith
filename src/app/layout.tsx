import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from '@/contexts/ThemeContext'; // Import ThemeProvider
import { TaskProvider } from '@/contexts/TaskContext'; // Import TaskProvider

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TaskZenith',
  description: 'AI Powered Task Tracking App',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning> {/* Add suppressHydrationWarning */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          defaultTheme="system"
          storageKey="taskzenith-theme"
        >
          <TaskProvider> {/* Wrap with TaskProvider */}
            <SidebarProvider defaultOpen={true}>
              {children}
            </SidebarProvider>
            <Toaster />
          </TaskProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}