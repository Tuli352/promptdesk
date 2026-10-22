import { NextResponse } from "next/server";
import { updatePrompt } from "@/lib/store";

// Safaricom calls this after the customer accepts, cancels or times out.
export async function POST(request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CALLBACK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const cb = body?.Body?.stkCallback;
  if (cb) {
    updatePrompt(cb.CheckoutRequestID, {
      status: cb.ResultCode === 0 ? "paid" : "failed",
      resultDesc: cb.ResultDesc,
    });
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
