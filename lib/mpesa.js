import fs from "fs";
import path from "path";
import crypto from "crypto";

const BASE =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

export function normalizePhone(raw) {
  const d = String(raw || "").replace(/[\s\-()+]/g, "");
  if (/^0[71]\d{8}$/.test(d)) return "254" + d.slice(1);
  if (/^254[71]\d{8}$/.test(d)) return d;
  return null;
}

async function getToken() {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");
  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not get M-Pesa token (${res.status})`);
  const json = await res.json();
  return json.access_token;
}

async function post(pathname, body) {
  const token = await getToken();
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

function timestamp() {
  return new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14); // YYYYMMDDHHmmss
}

// Sends the "Enter your M-Pesa PIN" prompt to the customer's phone.
export async function stkPush({ phone, amount }) {
  const ts = timestamp();
  const shortcode = process.env.MPESA_SHORTCODE;
  const password = Buffer.from(shortcode + process.env.MPESA_PASSKEY + ts).toString("base64");
  const { ok, json } = await post("/mpesa/stkpush/v1/processrequest", {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline", // use "CustomerBuyGoodsOnline" for a Till number
    Amount: amount,
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: `${process.env.APP_BASE_URL}/api/callback/stk?secret=${process.env.CALLBACK_SECRET}`,
    AccountReference: "PromptDesk",
    TransactionDesc: "Payment",
  });
  if (!ok || json.ResponseCode !== "0") {
    throw new Error(json.errorMessage || json.ResponseDescription || "M-Pesa rejected the prompt");
  }
  return { checkoutRequestId: json.CheckoutRequestID };
}

function securityCredential() {
  // Use the ready-made credential from the portal when provided.
  if (process.env.MPESA_SECURITY_CREDENTIAL) return process.env.MPESA_SECURITY_CREDENTIAL;
  const cert = fs.readFileSync(path.resolve(process.cwd(), process.env.MPESA_CERT_PATH));
  const encrypted = crypto.publicEncrypt(
    { key: cert, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(process.env.MPESA_INITIATOR_PASSWORD)
  );
  return encrypted.toString("base64");
}

// Pays money from your business shortcode to your own M-Pesa number.
export async function b2cWithdraw({ phone, amount }) {
  const originatorId = crypto.randomUUID();
  const base = `${process.env.APP_BASE_URL}/api/callback/b2c?secret=${process.env.CALLBACK_SECRET}`;
  const { ok, json } = await post("/mpesa/b2c/v1/paymentrequest", {
    OriginatorConversationID: originatorId,
    InitiatorName: process.env.MPESA_INITIATOR_NAME,
    SecurityCredential: securityCredential(),
    CommandID: "BusinessPayment",
    Amount: amount,
    PartyA: process.env.MPESA_B2C_SHORTCODE,
    PartyB: phone,
    Remarks: "Withdrawal",
    QueueTimeOutURL: base,
    ResultURL: base,
    Occassion: "Withdrawal", // Safaricom spells this field this way
  });
  if (!ok || json.ResponseCode !== "0") {
    throw new Error(json.errorMessage || json.ResponseDescription || "M-Pesa rejected the withdrawal");
  }
  return { originatorId };
}
