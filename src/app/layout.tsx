import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { getSessionUser } from "@/server/auth/guard";
import { collections } from "@/server/db/client";
import type { MeDTO } from "@/lib/types";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kutumb — Your Family's Shared Memory",
  description: "A shared AI-powered family memory and coordination application. Remember, coordinate, and listen to family updates.",
  icons: {
    icon: [
      { url: "/kutumb-logo.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/kutumb-logo.png", type: "image/png" },
    ],
    shortcut: "/kutumb-logo.png",
  },
};

async function getMe(): Promise<MeDTO | null> {
  try {
    const user = await getSessionUser();
    if (!user) return null;

    let familyData = null;
    if (user.familyId) {
      const { families } = await collections();
      const family = await families.findOne({ _id: user.familyId });
      if (family) {
        familyData = {
          id: family._id.toHexString(),
          name: family.name,
          timezone: family.timezone,
          inviteCode: family.inviteCode,
        };
      }
    }

    return {
      user: {
        id: user._id.toHexString(),
        email: user.email,
        name: user.name,
      },
      family: familyData,
      memberId: user.memberId ? user.memberId.toHexString() : null,
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();

  return (
    <html lang="en" className={`h-full ${jakarta.variable} ${outfit.variable}`}>
      <body className="min-h-full flex flex-col bg-[#faf8f5] text-[#27221d] antialiased">
        <Navbar me={me} />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-[#ede7df] bg-white/60 py-6 text-center text-xs text-[#6e655f]">
          <p>Kutumb — Your family&apos;s shared memory &copy; 2026. Powered by Gemma, Mastra, MongoDB Atlas, Temporal, &amp; Sentry.</p>
        </footer>
      </body>
    </html>
  );
}
