
import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Inter } from 'next/font/google'; // Import Inter
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from '@/contexts/ThemeContext'; // Import ThemeProvider
import { TaskProvider } from '@/contexts/TaskContext'; // Import TaskProvider
import { SettingsProvider } from '@/contexts/SettingsContext'; // Import SettingsProvider

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Configure Inter font
const inter = Inter({
  variable: '--font-inter',
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          defaultTheme="system"
          storageKey="taskzenith-theme"
        >
          <SettingsProvider> {/* Wrap with SettingsProvider */}
            <TaskProvider> {/* Wrap with TaskProvider */}
              <SidebarProvider defaultOpen={true}>
                {children}
              </SidebarProvider>
              <Toaster />
            </TaskProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

