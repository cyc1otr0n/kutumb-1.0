import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { collections } from "@/server/db/client";
import { verifyPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/server/auth/session";
import { handleApi } from "@/server/api";
import { invalid } from "@/server/errors";

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) throw invalid("Email and password are required");

    const { users } = await collections();
    const user = await users.findOne({ email });
    if (!user) throw invalid("Incorrect email or password");

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw invalid("Incorrect email or password");

    const token = createSessionToken(user._id.toHexString());
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
        id: user._id.toHexString(),
        email: user.email,
        name: user.name,
      },
    };
  });
}
