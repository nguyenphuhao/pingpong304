import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TOURNAMENT } from "@/lib/tournament";
import { BottomNav } from "./_BottomNav";
import { OnboardingDialog } from "./_OnboardingDialog";
import { Providers } from "./_Providers";
import { PreferencesScript } from "./_preferences-script";
import { FloatingChatBubble } from "@/components/chat/floating-chat-bubble";
import "./globals.css";

const fontSans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const SITE_URL = "https://bbbt.playnika.com";
const TITLE = `${TOURNAMENT.club} — ${TOURNAMENT.shortName}`;
const DESCRIPTION = `${TOURNAMENT.name}. Nội dung ${TOURNAMENT.event}, ${TOURNAMENT.dateLabel} tại ${TOURNAMENT.venue}. Xem lịch thi đấu, sơ đồ loại trực tiếp và bảng xếp hạng.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: TOURNAMENT.club,
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    // Ảnh chia sẻ là 1200×630 ngang; "summary" sẽ cắt về ô vuông nhỏ.
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${fontSans.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <PreferencesScript />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          {children}
          <BottomNav />
          <Toaster position="top-center" richColors />
          <OnboardingDialog />
          {process.env.NEXT_PUBLIC_CHAT_ENABLED === "true" ? (
            <FloatingChatBubble />
          ) : null}
        </Providers>
      </body>
    </html>
  );
}
