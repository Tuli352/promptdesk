import fs from "fs";
import path from "path";

// Simple JSON file storage so you can run this on your own machine or server.
// Serverless hosts (for example Vercel) do not keep files between requests.
// Swap these functions for a real database (Postgres, MongoDB, Supabase) before deploying there.
const FILE = path.join(process.cwd(), "data", "store.json");

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { prompts: [], withdrawals: [] };
  }
}

function write(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function addPrompt(p) {
  const db = read();
  db.prompts.unshift({ ...p, status: "pending", at: Date.now() });
  write(db);
}

export function updatePrompt(checkoutRequestId, patch) {
  const db = read();
  const item = db.prompts.find((x) => x.checkoutRequestId === checkoutRequestId);
  if (item) Object.assign(item, patch);
  write(db);
}

export function addWithdrawal(w) {
  const db = read();
  db.withdrawals.unshift({ ...w, status: "pending", at: Date.now() });
  write(db);
}

export function updateWithdrawal(originatorId, patch) {
  const db = read();
  const item = db.withdrawals.find((x) => x.originatorId === originatorId);
  if (item) Object.assign(item, patch);
  write(db);
}

export function getSummary() {
  const db = read();
  const sum = (list) => list.reduce((t, x) => t + x.amount, 0);
  const totalPrompted = sum(db.prompts);
  const totalPaid = sum(db.prompts.filter((p) => p.status === "paid"));
  const totalWithdrawn = sum(db.withdrawals.filter((w) => w.status !== "failed"));
  const activity = [
    ...db.prompts.map((p) => ({ type: "prompt", ...p })),
    ...db.withdrawals.map((w) => ({ type: "withdraw", ...w })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 10);
  return {
    totalPrompted,
    totalPaid,
    totalWithdrawn,
    available: totalPaid - totalWithdrawn,
    activity,
  };
}
