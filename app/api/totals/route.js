import { NextResponse } from "next/server";
import { getSummary } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSummary());
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
