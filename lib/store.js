import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

// Storage with two backends:
// - Upstash Redis when its keys are set (use this on Vercel, where files cannot be written).
// - A JSON file at data/store.json when no keys are set (local development only).
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const FILE = path.join(process.cwd(), "data", "store.json");

function needStore() {
  if (!redis && process.env.VERCEL) {
    throw new Error(
      "No database connected. Add an Upstash Redis store to this Vercel project (Storage tab) and redeploy."
    );
  }
}

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { prompts: {}, withdrawals: {} };
  }
}

function writeFile(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

// kind is "prompts" or "withdrawals". Each record is stored under its own id.
async function put(kind, id, record) {
  needStore();
  if (redis) return redis.hset(kind, { [id]: record });
  const db = readFile();
  db[kind][id] = record;
  writeFile(db);
}

async function patch(kind, id, changes) {
  needStore();
  if (redis) {
    const current = await redis.hget(kind, id);
    if (current) await redis.hset(kind, { [id]: { ...current, ...changes } });
    return;
  }
  const db = readFile();
  if (db[kind][id]) Object.assign(db[kind][id], changes);
  writeFile(db);
}

async function all(kind) {
  needStore();
  if (redis) return Object.values((await redis.hgetall(kind)) || {});
  return Object.values(readFile()[kind] || {});
}

export const addPrompt = (p) => put("prompts", p.checkoutRequestId, { ...p, status: "pending", at: Date.now() });
export const updatePrompt = (id, changes) => patch("prompts", id, changes);
export const addWithdrawal = (w) => put("withdrawals", w.originatorId, { ...w, status: "pending", at: Date.now() });
export const updateWithdrawal = (id, changes) => patch("withdrawals", id, changes);

export async function getSummary() {
  const prompts = await all("prompts");
  const withdrawals = await all("withdrawals");
  const sum = (list) => list.reduce((t, x) => t + x.amount, 0);

  const totalPrompted = sum(prompts);
  const totalPaid = sum(prompts.filter((p) => p.status === "paid"));
  const totalWithdrawn = sum(withdrawals.filter((w) => w.status !== "failed"));
  const activity = [
    ...prompts.map((p) => ({ type: "prompt", ...p })),
    ...withdrawals.map((w) => ({ type: "withdraw", ...w })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 10);

  return { totalPrompted, totalPaid, totalWithdrawn, available: totalPaid - totalWithdrawn, activity };
}
