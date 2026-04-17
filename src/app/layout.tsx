import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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

export const metadata: Metadata = {
  title: "CLB Bóng Bàn Bình Tân — Giải Kỷ niệm 51 năm Thống nhất",
  description:
    "Giải bóng bàn chào mừng kỷ niệm 51 năm ngày thống nhất đất nước (30/4/1975 – 30/4/2026). Nội dung Đồng đội & Đôi. Xem lịch thi đấu, BXH, kết quả trực tiếp.",
  metadataBase: new URL("https://bbbt.playnika.com"),
  openGraph: {
    title: "CLB Bóng Bàn Bình Tân — Giải 51 năm Thống nhất",
    description:
      "Giải bóng bàn chào mừng 51 năm ngày thống nhất đất nước. Lịch thi đấu, BXH, kết quả trực tiếp.",
    url: "https://bbbt.playnika.com",
    siteName: "CLB Bóng Bàn Bình Tân",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CLB Bóng Bàn Bình Tân — Giải 51 năm Thống nhất",
    description:
      "Xem lịch thi đấu, BXH, kết quả trực tiếp giải bóng bàn kỷ niệm 51 năm thống nhất.",
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
