import type { Metadata } from "next";
import { Playfair_Display, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RMS · Restaurant Management Suite",
  description:
    "Immersive restaurant management platform for admins, managers, kitchen, waiters and customers.",
};

const THEME_INIT = `(function(){try{var t=localStorage.getItem("rms-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="light")d=false;if(t==="system")d=window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;if(d)r.classList.add("dark");else r.classList.remove("dark");r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--surface-strong)",
                border: "1px solid var(--card-border)",
                color: "var(--foreground)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
