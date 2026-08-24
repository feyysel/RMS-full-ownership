import type { Metadata } from "next";
import { Playfair_Display, Manrope } from "next/font/google";
import { Toaster } from "sonner";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#18181b",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fafafa",
            },
          }}
        />
      </body>
    </html>
  );
}
