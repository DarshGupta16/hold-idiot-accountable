import type { Metadata } from "next";
import { Montserrat, Lora } from "next/font/google"; // Import standard fonts
import { ThemeProvider } from "@/components/theme-provider";
import { PreferencesProvider } from "@/components/preferences-provider";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora", // Add Lora for "document" feel
  subsets: ["latin"],
});

export const viewport = {
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  title: "HIA",
  description: "Hold Idiot Accountable",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HIA",
  },
};

import { ConnectivityAlert } from "@/components/ui/ConnectivityAlert";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${lora.variable} antialiased bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-50 overflow-x-hidden font-sans`}
      >
        <ConnectivityAlert />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PreferencesProvider>{children}</PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
