import { NextResponse } from "next/server";
import { b2cWithdraw, normalizePhone } from "@/lib/mpesa";
import { addWithdrawal, getSummary } from "@/lib/store";

export async function POST(request) {
  const { phone, amount } = await request.json();
  const msisdn = normalizePhone(phone);
  const amt = Number(amount);

  if (!msisdn) return NextResponse.json({ error: "Enter your own M-Pesa number." }, { status: 400 });
  if (!Number.isInteger(amt) || amt < 1 || amt > 250000) {
    return NextResponse.json({ error: "Amount must be a whole number from 1 to 250,000." }, { status: 400 });
  }

  const { available } = getSummary();
  if (amt > available) {
    return NextResponse.json(
      { error: `You can withdraw at most KES ${available.toLocaleString("en-KE")} right now.` },
      { status: 400 }
    );
  }

  try {
    const { originatorId } = await b2cWithdraw({ phone: msisdn, amount: amt });
    addWithdrawal({ originatorId, phone: msisdn, amount: amt });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
