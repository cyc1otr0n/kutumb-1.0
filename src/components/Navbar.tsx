"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { MeDTO } from "@/lib/types";

export function Navbar({ me }: { me: MeDTO | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const navItems = [
    { label: "Home", href: "/" },
    { label: "Ask Kutumb", href: "/ask" },
    { label: "Events", href: "/events" },
    { label: "Tasks", href: "/tasks" },
    { label: "Updates", href: "/updates" },
    { label: "Memories", href: "/memories" },
    { label: "Timeline", href: "/timeline" },
    { label: "Family", href: "/family" },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function copyInviteCode() {
    if (me?.family?.inviteCode) {
      navigator.clipboard.writeText(me.family.inviteCode);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  }

  if (!me?.user) {
    return (
      <header className="border-b border-[#ede7df] bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#c2593f] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              कु
            </span>
            <div>
              <span className="font-bold text-lg tracking-tight text-[#27221d]">Kutumb</span>
              <span className="hidden sm:inline text-xs text-[#6e655f] ml-2 font-normal">Your family&apos;s shared memory</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 text-[#27221d] hover:text-[#c2593f] transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium px-4 py-2 rounded-xl bg-[#c2593f] text-white hover:bg-[#aa4a32] shadow-sm transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-[#ede7df] bg-white/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#c2593f] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              कु
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight tracking-tight text-[#27221d]">Kutumb</span>
              {me.family && (
                <span className="text-[11px] text-[#6e655f] font-medium leading-none">
                  {me.family.name}
                </span>
              )}
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-[#faf3ee] text-[#c2593f]"
                      : "text-[#6e655f] hover:text-[#27221d] hover:bg-[#f6f2ec]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side info & actions */}
        <div className="hidden md:flex items-center gap-3">
          {me.family && (
            <button
              onClick={copyInviteCode}
              title="Click to copy family invite code"
              className="px-2.5 py-1 rounded-lg bg-[#faf3ee] border border-[#f0e3d8] text-xs font-medium text-[#c2593f] hover:bg-[#f5e7db] transition flex items-center gap-1.5"
            >
              <span>Code:</span>
              <span className="font-mono font-semibold">{me.family.inviteCode}</span>
              {copiedInvite ? (
                <span className="text-[10px] text-emerald-600 font-bold">✓ Copied</span>
              ) : (
                <svg className="w-3 h-3 text-[#c2593f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-[#ede7df]">
            <div className="w-8 h-8 rounded-full bg-[#f3eae4] border border-[#e5d8cf] text-[#c2593f] font-semibold text-xs flex items-center justify-center">
              {me.user.name.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-medium text-[#6e655f] hover:text-red-600 transition"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-[#6e655f] hover:bg-[#f6f2ec]"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#ede7df] bg-white px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  active ? "bg-[#faf3ee] text-[#c2593f]" : "text-[#6e655f]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="pt-3 border-t border-[#ede7df] flex items-center justify-between text-sm">
            <span className="text-[#6e655f]">{me.user.name}</span>
            <button
              onClick={handleLogout}
              className="text-xs font-medium text-red-600 py-1 px-2 rounded hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
