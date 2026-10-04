"use client";

import { useState } from "react";
import { AskKutumbBar } from "@/components/AskKutumbBar";

export default function AskPage() {
  const [history, setHistory] = useState<string[]>([]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="space-y-1 text-center md:text-left">
        <h1 className="text-2xl font-bold text-[#27221d] tracking-tight">Ask Kutumb</h1>
        <p className="text-xs text-[#6e655f]">
          Ask questions grounded in your family&apos;s stored plans, or give natural-language commands to add events, tasks, reminders, and updates.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-[#ede7df] shadow-xs space-y-6">
        <AskKutumbBar />
      </div>

      {/* Helpful Guide / Examples */}
      <div className="bg-[#faf3ee]/60 border border-[#f0e3d8] rounded-3xl p-5 space-y-3">
        <h4 className="text-xs font-bold text-[#c2593f] uppercase tracking-wider">
          What you can ask or tell Kutumb:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#27221d]">
          <div className="bg-white p-3 rounded-2xl border border-[#f0e3d8]">
            <p className="font-semibold text-[#c2593f]">Ask factual questions:</p>
            <p className="text-[#6e655f] mt-1">&ldquo;What is happening today?&rdquo;</p>
            <p className="text-[#6e655f]">&ldquo;What is happening this weekend?&rdquo;</p>
            <p className="text-[#6e655f]">&ldquo;Who is handling groceries?&rdquo;</p>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-[#f0e3d8]">
            <p className="font-semibold text-[#c2593f]">Create actions in plain English:</p>
            <p className="text-[#6e655f] mt-1">&ldquo;Add dinner with the family on Sunday at 7.&rdquo;</p>
            <p className="text-[#6e655f]">&ldquo;Create a task to pick up the cake.&rdquo;</p>
            <p className="text-[#6e655f]">&ldquo;Remind everyone tomorrow morning.&rdquo;</p>
          </div>
        </div>
      </div>
    </div>
  );
}
