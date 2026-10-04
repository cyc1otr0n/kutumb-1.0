"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Registration failed");

      router.push("/onboarding");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="bg-white rounded-3xl p-8 border border-[#ede7df] shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <span className="w-12 h-12 rounded-2xl bg-[#faf3ee] text-[#c2593f] inline-flex items-center justify-center font-bold text-xl shadow-2xs">
            कु
          </span>
          <h2 className="text-2xl font-bold text-[#27221d]">Join Kutumb</h2>
          <p className="text-xs text-[#6e655f]">One place that remembers what your family keeps forgetting</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#27221d] mb-1">Your Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Papa, Aarav, Mom"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] focus:ring-2 focus:ring-[#c2593f]/10 outline-hidden transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#27221d] mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@family.com"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] focus:ring-2 focus:ring-[#c2593f]/10 outline-hidden transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#27221d] mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#ede7df] focus:border-[#c2593f] focus:ring-2 focus:ring-[#c2593f]/10 outline-hidden transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#c2593f] text-white font-semibold text-sm hover:bg-[#aa4a32] shadow-sm transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="text-center text-xs text-[#6e655f] pt-2 border-t border-[#ede7df]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#c2593f] font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
