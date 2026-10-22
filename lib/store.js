
import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

/**
 * Storage:
 * - Vercel: Redis is required.
 * - Local development: data/store.json.
 *
 * Supported Vercel environment variables:
 * KV_REST_API_URL + KV_REST_API_TOKEN
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */

const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

const isVercel =
  process.env.VERCEL === "1" ||
  Boolean(process.env.VERCEL);

const FILE = path.join(
  process.cwd(),
  "data",
  "store.json"
);

function needStore() {
  if (isVercel && !redis) {
    throw new Error(
      "Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN in Vercel Environment Variables, then redeploy."
    );
  }
}

function readFile() {
  try {
    return JSON.parse(
      fs.readFileSync(FILE, "utf8")
    );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }

    return {
      prompts: {},
      withdrawals: {},
    };
  }
}

function writeFile(db) {
  if (isVercel) {
    throw new Error(
      "File storage is disabled on Vercel. Configure Redis."
    );
  }

  fs.mkdirSync(path.dirname(FILE), {
    recursive: true,
  });

  fs.writeFileSync(
    FILE,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}

// Store one record in Redis or the local JSON file.
async function put(kind, id, record) {
  needStore();

  if (redis) {
    await redis.hset(kind, {
      [id]: record,
    });
    return;
  }

  const db = readFile();

  db[kind] ??= {};
  db[kind][id] = record;

  writeFile(db);
}

// Update an existing record.
async function patch(kind, id, changes) {
  needStore();

  if (redis) {
    const current = await redis.hget(kind, id);

    if (current) {
      await redis.hset(kind, {
        [id]: {
          ...current,
          ...changes,
        },
      });
    }

    return;
  }

  const db = readFile();

  db[kind] ??= {};

  if (db[kind][id]) {
    Object.assign(db[kind][id], changes);
    writeFile(db);
  }
}

// Retrieve all records of a particular type.
async function all(kind) {
  needStore();

  if (redis) {
    const records = await redis.hgetall(kind);
    return Object.values(records || {});
  }

  return Object.values(readFile()[kind] || {});
}

// M-Pesa payment prompts.
export const addPrompt = (p) =>
  put("prompts", p.checkoutRequestId, {
    ...p,
    status: "pending",
    at: Date.now(),
  });

export const updatePrompt = (id, changes) =>
  patch("prompts", id, changes);

// M-Pesa withdrawals.
export const addWithdrawal = (w) =>
  put("withdrawals", w.originatorId, {
    ...w,
    status: "pending",
    at: Date.now(),
  });

export const updateWithdrawal = (id, changes) =>
  patch("withdrawals", id, changes);

// Dashboard totals and recent activity.
export async function getSummary() {
  const prompts = await all("prompts");
  const withdrawals = await all("withdrawals");

  const sum = (list) =>
    list.reduce(
      (total, item) =>
        total + Number(item.amount || 0),
      0
    );

  const totalPrompted = sum(prompts);

  const totalPaid = sum(
    prompts.filter((p) => p.status === "paid")
  );

  const totalWithdrawn = sum(
    withdrawals.filter((w) => w.status !== "failed")
  );

  const activity = [
    ...prompts.map((p) => ({
      type: "prompt",
      ...p,
    })),
    ...withdrawals.map((w) => ({
      type: "withdraw",
      ...w,
    })),
  ]
    .sort(
      (a, b) => Number(b.at || 0) - Number(a.at || 0)
    )
    .slice(0, 10);

  return {
    totalPrompted,
    totalPaid,
    totalWithdrawn,
    available: totalPaid - totalWithdrawn,
    activity,
  };
}
