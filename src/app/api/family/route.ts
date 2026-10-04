import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireAuth } from "@/server/auth/guard";
import { createFamily, joinFamilyByCode } from "@/server/services/family.service";
import { invalid } from "@/server/errors";

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const action = body.action; // "create" | "join"

    if (action === "create") {
      const name = body.name || `${user.name}'s Family`;
      const timezone = body.timezone || "Asia/Kolkata";
      const { family, member } = await createFamily(user, name, timezone);
      return {
        family: {
          id: family._id.toHexString(),
          name: family.name,
          timezone: family.timezone,
          inviteCode: family.inviteCode,
        },
        memberId: member._id.toHexString(),
      };
    } else if (action === "join") {
      const inviteCode = body.inviteCode;
      if (!inviteCode) throw invalid("Invite code is required");
      const { family, member } = await joinFamilyByCode(user, inviteCode, body.relation);
      return {
        family: {
          id: family._id.toHexString(),
          name: family.name,
          timezone: family.timezone,
          inviteCode: family.inviteCode,
        },
        memberId: member._id.toHexString(),
      };
    }

    throw invalid("Action must be 'create' or 'join'");
  });
}
