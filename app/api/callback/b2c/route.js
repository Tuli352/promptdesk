import { NextResponse } from "next/server";
import { updateWithdrawal } from "@/lib/store";

// Safaricom calls this with the result of a withdrawal (ResultURL and QueueTimeOutURL).
export async function POST(request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CALLBACK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const result = body?.Result;
  if (result) {
    await updateWithdrawal(result.OriginatorConversationID, {
      status: result.ResultCode === 0 ? "sent" : "failed",
      resultDesc: result.ResultDesc,
    });
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
