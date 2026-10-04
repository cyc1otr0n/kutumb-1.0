import { NextRequest } from "next/server";
import { handleApi } from "@/server/api";
import { requireFamilyAuth } from "@/server/auth/guard";
import { addFamilyMember, getFamilyMembers } from "@/server/services/family.service";
import type { MemberDTO } from "@/lib/types";

export async function GET() {
  return handleApi(async (): Promise<MemberDTO[]> => {
    const ctx = await requireFamilyAuth();
    const members = await getFamilyMembers(ctx.familyId);
    return members.map((m) => ({
      id: m._id.toHexString(),
      name: m.name,
      relation: m.relation,
      birthday: m.birthday,
      hasAccount: !!m.userId,
      isYou: m.userId ? m.userId.equals(ctx.userId) : false,
      color: m.color,
    }));
  });
}

export async function POST(req: NextRequest) {
  return handleApi(async () => {
    const ctx = await requireFamilyAuth();
    const body = await req.json().catch(() => ({}));
    const member = await addFamilyMember(ctx, {
      name: body.name,
      relation: body.relation,
      birthday: body.birthday,
      color: body.color,
    });
    return {
      member: {
        id: member._id.toHexString(),
        name: member.name,
        relation: member.relation,
        birthday: member.birthday,
        hasAccount: false,
        isYou: false,
        color: member.color,
      },
    };
  });
}
