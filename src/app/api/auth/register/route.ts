import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { collections } from "@/server/db/client";
import { hashPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/server/auth/session";
import { handleApi } from "@/server/api";
import { invalid } from "@/server/errors";
import type { UserDoc } from "@/server/db/types";

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "").trim();
    const password = body.password || "";

    if (!email || !email.includes("@")) throw invalid("Valid email address is required");
    if (!name) throw invalid("Name is required");
    if (password.length < 6) throw invalid("Password must be at least 6 characters");

    const { users } = await collections();
    const existing = await users.findOne({ email });
    if (existing) throw invalid("An account with this email already exists");

    const passwordHash = await hashPassword(password);
    const userId = new ObjectId();
    const userDoc: UserDoc = {
      _id: userId,
      email,
      name,
      passwordHash,
      familyId: null,
      memberId: null,
      createdAt: new Date(),
    };

    await users.insertOne(userDoc);

    const token = createSessionToken(userId.toHexString());
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });

    return {
      user: {
        id: userId.toHexString(),
        email: userDoc.email,
        name: userDoc.name,
      },
    };
  });
}
