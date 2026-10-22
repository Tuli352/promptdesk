"use client";

import { useCallback, useEffect, useState } from "react";
import WithdrawModal from "./WithdrawModal";

const kes = (n) => new Intl.NumberFormat("en-KE").format(n);
const pretty = (n) => `0${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;

export default function Home() {
  const [summary, setSummary] = useState({
    totalPrompted: 0,
    totalPaid: 0,
    totalWithdrawn: 0,
    available: 0,
    activity: [],
  });
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: "", kind: "" });
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/totals", { cache: "no-store" });
      setSummary(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000); // picks up payments confirmed by Safaricom
    return () => clearInterval(id);
  }, [refresh]);

  async function onPrompt(e) {
    e.preventDefault();
    setBusy(true);
    setStatus({ text: "", kind: "" });
    try {
      const res = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customer, amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setStatus({ text: "Prompt sent. Ask the customer to enter their M-Pesa PIN.", kind: "ok" });
      refresh();
    } catch (err) {
      setStatus({ text: err.message, kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="top">
        <div>
          <h1>Prompt Desk</h1>
          <p className="sub">Request payments, then cash out to your own M-Pesa.</p>
        </div>
        <button type="button" className="amber withdraw-btn" onClick={() => setWithdrawOpen(true)}>
          Withdraw to my M-Pesa
        </button>
      </header>

      <section className="totals" aria-label="Totals">
        <div className="total prompted">
          <div className="label">Total prompted</div>
          <div className="value"><small>KES</small>{kes(summary.totalPrompted)}</div>
        </div>
        <div className="total withdrawn">
          <div className="label">Total withdrawn</div>
          <div className="value"><small>KES</small>{kes(summary.totalWithdrawn)}</div>
        </div>
      </section>
      <p className="avail">
        Paid so far KES {kes(summary.totalPaid)} · Available to withdraw KES {kes(summary.available)}
      </p>

      <form className="card" onSubmit={onPrompt}>
        <h2>New prompt</h2>
        <div className="row">
          <label htmlFor="customer">
            Customer phone
            <input id="customer" inputMode="tel" placeholder="0712 345 678" value={customer}
              onChange={(e) => setCustomer(e.target.value)} />
          </label>
          <label htmlFor="amount">
            Amount (KES)
            <input id="amount" inputMode="numeric" placeholder="500" value={amount}
              onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="lime" disabled={busy}>
          {busy ? "Sending…" : "Prompt"}
        </button>
        <p className={`status ${status.kind}`} role="status" aria-live="polite">{status.text}</p>
      </form>

      <section className="card" aria-label="Recent activity">
        <h2>Recent activity</h2>
        {summary.activity.length === 0 ? (
          <p className="empty">Nothing yet. Your prompts and withdrawals will show here.</p>
        ) : (
          <ul className="log">
            {summary.activity.map((e, i) => (
              <li key={e.checkoutRequestId || e.originatorId || i}>
                <span className={`dot ${e.type}`} aria-hidden="true" />
                <div className="who">
                  {e.type === "prompt" ? "Prompt to " : "Withdrawal to "}
                  {pretty(e.phone)}
                  <em>
                    {new Date(e.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                    {" · "}
                    {e.status}
                  </em>
                </div>
                <div className={`amt ${e.type}`}>
                  {e.type === "prompt" ? "+" : "-"} KES {kes(e.amount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        available={summary.available}
        onDone={(text) => {
          setStatus({ text, kind: "ok" });
          refresh();
        }}
      />
    </main>
  );
}
