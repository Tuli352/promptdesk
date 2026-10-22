"use client";

import { useEffect, useRef, useState } from "react";

const kes = (n) => new Intl.NumberFormat("en-KE").format(n);

// Pop-up for withdrawing to your own M-Pesa number.
export default function WithdrawModal({ open, onClose, available, onDone }) {
  const ref = useRef(null);
  const [mine, setMine] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: "", kind: "" });

  // Remember your own number on this device.
  useEffect(() => {
    try {
      setMine(localStorage.getItem("prompt-desk-mine") || "");
    } catch {}
  }, []);

  // Open and close the native <dialog>.
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      setStatus({ text: "", kind: "" });
      dlg.showModal();
    }
    if (!open && dlg.open) dlg.close();
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setStatus({ text: "", kind: "" });
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mine, amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      try {
        localStorage.setItem("prompt-desk-mine", mine);
      } catch {}
      setAmount("");
      onDone("Withdrawal requested. M-Pesa will confirm shortly.");
      onClose();
    } catch (err) {
      setStatus({ text: err.message, kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="wd-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the dark backdrop
      }}
    >
      <form className="modal-body" onSubmit={submit}>
        <div className="modal-head">
          <h2 id="wd-title">Withdraw to M-Pesa</h2>
          <button type="button" className="close" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <div className="avail-pill">
          Available <strong>KES {kes(available)}</strong>
        </div>

        <label htmlFor="wd-mine">
          My M-Pesa number
          <input id="wd-mine" inputMode="tel" placeholder="0722 000 000" value={mine}
            onChange={(e) => setMine(e.target.value)} />
        </label>
        <label htmlFor="wd-amount">
          Amount (KES)
          <input id="wd-amount" inputMode="numeric" placeholder="1000" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </label>

        <p className={`status ${status.kind}`} role="status" aria-live="polite">{status.text}</p>

        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="amber" disabled={busy}>
            {busy ? "Sending…" : "Withdraw"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
