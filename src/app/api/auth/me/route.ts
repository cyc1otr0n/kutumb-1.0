import { handleApi } from "@/server/api";
import { getSessionUser } from "@/server/auth/guard";
import { collections } from "@/server/db/client";
import type { MeDTO } from "@/lib/types";

export async function GET() {
  return handleApi(async (): Promise<MeDTO | { user: null }> => {
    const user = await getSessionUser();
    if (!user) return { user: null };

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
  });
}
