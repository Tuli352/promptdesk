import { NextResponse } from "next/server";
import { stkPush, normalizePhone } from "@/lib/mpesa";
import { addPrompt } from "@/lib/store";

export async function POST(request) {
  const { phone, amount } = await request.json();
  const msisdn = normalizePhone(phone);
  const amt = Number(amount);

  if (!msisdn) return NextResponse.json({ error: "Enter a valid Safaricom number." }, { status: 400 });
  if (!Number.isInteger(amt) || amt < 1 || amt > 250000) {
    return NextResponse.json({ error: "Amount must be a whole number from 1 to 250,000." }, { status: 400 });
  }

  try {
    const { checkoutRequestId } = await stkPush({ phone: msisdn, amount: amt });
    addPrompt({ checkoutRequestId, phone: msisdn, amount: amt });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
