import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import { handleApi } from "@/server/api";

export async function POST() {
  return handleApi(async () => {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    return { success: true };
  });
}
