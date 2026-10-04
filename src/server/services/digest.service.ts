import { ObjectId } from "mongodb";
import { collections } from "../db/client";
import type { DailyDigestDoc, DigestSection } from "../db/types";
import type { AuthContext } from "../context";
import { getTodaySchedule, getUpcomingEvents } from "./events.service";
import { getTasks } from "./tasks.service";
import { getFamilyUpdates } from "./updates.service";
import { formatDateTime, greetingFor } from "@/lib/time";
import { env } from "../env";
import { captureError, traceSpan } from "../observability";
import type { DigestDTO } from "@/lib/types";

export function toDigestDTO(doc: DailyDigestDoc): DigestDTO {
  return {
    id: doc._id.toHexString(),
    period: doc.period,
    headline: doc.headline,
    sections: doc.sections,
    generatedBy: doc.generatedBy,
    createdAt: doc.createdAt.toISOString(),
    spokenText: doc.spokenText || doc.headline,
  };
}

export async function getLatestDigest(familyId: ObjectId): Promise<DailyDigestDoc | null> {
  const { digests } = await collections();
  return digests.findOne({ familyId }, { sort: { createdAt: -1 } });
}

export async function generateDailyDigest(ctx: AuthContext): Promise<DailyDigestDoc> {
  return traceSpan({ name: "digest.generate", op: "ai.digest" }, async (span) => {
    const today = new Date();
    const dateKey = today.toLocaleDateString("en-CA", { timeZone: ctx.timezone });

    const [todayEvents, upcomingEvents, tasks, updates] = await Promise.all([
      getTodaySchedule(ctx.familyId, ctx.timezone, today),
      getUpcomingEvents(ctx.familyId, 5, today),
      getTasks(ctx.familyId, "open"),
      getFamilyUpdates(ctx.familyId, 10),
    ]);

    // Build context summary
    const todayEventsSummary = todayEvents.map((e) => `• ${e.title} at ${formatDateTime(e.startsAt, ctx.timezone, { allDay: e.allDay })}`).join("\n");
    const upcomingSummary = upcomingEvents.filter((e) => !todayEvents.some((te) => te._id.equals(e._id))).slice(0, 3).map((e) => `• ${e.title} (${formatDateTime(e.startsAt, ctx.timezone)})`).join("\n");
    const tasksSummary = tasks.slice(0, 5).map((t) => `• ${t.title}${t.dueAt ? ` (due ${formatDateTime(t.dueAt, ctx.timezone)})` : ""}`).join("\n");
    const updatesSummary = updates.slice(0, 5).map((u) => `• ${u.authorName}: ${u.content}`).join("\n");

    const signature = `${dateKey}-${todayEvents.length}-${upcomingEvents.length}-${tasks.length}-${updates.length}-${updates[0]?._id.toHexString() || "0"}`;

    const { digests } = await collections();
    const existing = await digests.findOne({ familyId: ctx.familyId, dateKey, sourceSignature: signature });
    if (existing) {
      return existing;
    }

    let headline = `Family update for ${today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: ctx.timezone })}`;
    const sections: DigestSection[] = [];
    let spokenText = "";
    let generatedBy: "gemma" | "fallback" = "fallback";

    // Attempt AI generation with Gemma via Google API if key is set
    const apiKey = env.googleApiKey();
    if (apiKey) {
      try {
        const prompt = `You are Kutumb, a shared family assistant. Generate a warm, concise family digest based strictly on this information:

Today's Schedule:
${todayEventsSummary || "None"}

Upcoming Events:
${upcomingSummary || "None"}

Pending Tasks:
${tasksSummary || "None"}

Recent Family Updates:
${updatesSummary || "None"}

Format your response as valid JSON with this exact structure:
{
  "headline": "A short 1-sentence friendly overview",
  "sections": [
    { "title": "Today's Focus", "items": ["item 1", "item 2"] },
    { "title": "Pending Tasks", "items": ["task 1"] },
    { "title": "Recent Updates", "items": ["update 1"] }
  ],
  "spokenText": "A warm, natural 2-4 sentence script suitable for text-to-speech that family members can listen to."
}

Do NOT invent any facts not present above. If a category has no items, omit that section.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.gemmaModel()}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const resData = await res.json();
          const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed.headline && Array.isArray(parsed.sections)) {
              headline = parsed.headline;
              sections.push(...parsed.sections);
              spokenText = parsed.spokenText || parsed.headline;
              generatedBy = "gemma";
            }
          }
        }
      } catch (err) {
        captureError(err, { area: "digest_gemma_generation" });
      }
    }

    // Reliable fallback if AI was unavailable, failed, or sections were empty
    if (sections.length === 0) {
      if (todayEvents.length > 0) {
        sections.push({
          title: "Today's Schedule",
          items: todayEvents.map((e) => `${e.title} at ${formatDateTime(e.startsAt, ctx.timezone, { allDay: e.allDay })}`),
        });
      }
      if (tasks.length > 0) {
        sections.push({
          title: "Tasks to Handle",
          items: tasks.slice(0, 5).map((t) => t.title),
        });
      }
      if (updates.length > 0) {
        sections.push({
          title: "Recent Notes",
          items: updates.slice(0, 3).map((u) => `${u.authorName}: ${u.content}`),
        });
      }
      if (upcomingEvents.length > 0) {
        sections.push({
          title: "Coming Up",
          items: upcomingEvents.slice(0, 3).map((e) => `${e.title} on ${formatDateTime(e.startsAt, ctx.timezone)}`),
        });
      }
    }

    // If spokenText is missing or a bare count summary, generate the rich natural spoken script
    if (!spokenText || spokenText.includes("Today you have") || spokenText === headline) {
      spokenText = buildNaturalSpokenScript(sections, greetingFor(today, ctx.timezone));
    }

    const digestDoc: DailyDigestDoc = {
      _id: new ObjectId(),
      familyId: ctx.familyId,
      period: "daily",
      dateKey,
      headline,
      sections,
      spokenText,
      generatedBy,
      model: generatedBy === "gemma" ? env.gemmaModel() : null,
      sourceSignature: signature,
      audio: null,
      audioMimeType: null,
      createdAt: new Date(),
    };

    await digests.insertOne(digestDoc);
    span.setAttributes({ "digest.sections": sections.length, "digest.generated_by": generatedBy });
    return digestDoc;
  });
}

export function buildNaturalSpokenScript(
  sections: DigestSection[],
  greeting = "Good day!"
): string {
  const parts: string[] = [];
  parts.push(`${greeting} Here is today's family digest.`);

  for (const section of sections) {
    if (!section.items || section.items.length === 0) continue;
    const titleLower = section.title.toLowerCase();

    // Natural item join: "A, B, and C"
    let formattedItems = "";
    if (section.items.length === 1) {
      formattedItems = section.items[0];
    } else if (section.items.length === 2) {
      formattedItems = `${section.items[0]} and ${section.items[1]}`;
    } else {
      const allExceptLast = section.items.slice(0, -1).join(", ");
      formattedItems = `${allExceptLast}, and ${section.items[section.items.length - 1]}`;
    }

    if (titleLower.includes("schedule") || titleLower.includes("focus") || titleLower.includes("today")) {
      parts.push(`Today's schedule: ${formattedItems}.`);
    } else if (titleLower.includes("task")) {
      parts.push(`Tasks to handle: ${formattedItems}.`);
    } else if (titleLower.includes("note") || titleLower.includes("update")) {
      parts.push(`Recent notes: ${formattedItems}.`);
    } else if (titleLower.includes("coming") || titleLower.includes("upcoming")) {
      parts.push(`Coming up: ${formattedItems}.`);
    } else {
      parts.push(`${section.title}: ${formattedItems}.`);
    }
  }

  if (sections.length === 0) {
    parts.push("You have no events, tasks, or updates recorded for today. Everything is clear!");
  } else {
    parts.push("Have a wonderful day!");
  }

  return parts.join(" ");
}

