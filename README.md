# Prompt Desk

Next.js (App Router) and React app that sends M-Pesa STK push prompts, withdraws to your own M-Pesa number (B2C), and shows total prompted and total withdrawn.

## Run it

1. Install Node.js 18.17 or newer.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill it in.
4. Download Safaricom's certificate from the Daraja portal (Going Live / API docs) and put it in `certs/`, matching `MPESA_CERT_PATH`.
5. Start a tunnel so Safaricom can reach you, for example `ngrok http 3000`, and put the https address in `APP_BASE_URL`.
6. `npm run dev` and open http://localhost:3000

## Files

- `app/page.js` the page (React client component)
- `app/api/prompt/route.js` sends the STK push
- `app/api/withdraw/route.js` sends a B2C payment to your number
- `app/api/callback/stk/route.js` and `app/api/callback/b2c/route.js` receive results from Safaricom
- `app/api/totals/route.js` totals and recent activity for the page
- `lib/mpesa.js` Daraja calls
- `lib/store.js` JSON file storage

## Things to know

- Test in the sandbox first (`MPESA_ENV=sandbox`). Going live needs a paybill or till, B2C enabled on your shortcode, and a funded B2C utility account. Withdrawals pay out of that account, so the money collected through STK push must be moved to it by your M-Pesa setup.
- "Total prompted" is every amount you asked for. "Paid so far" only counts prompts the customer actually confirmed.
- `lib/store.js` uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or Vercel's `KV_REST_API_URL` and `KV_REST_API_TOKEN`) are set, and a local `data/store.json` file otherwise. Vercel cannot write files, so deploy there with a Redis store connected.
- On Vercel, add every variable from `.env.local` in Project Settings, Environment Variables, and set `APP_BASE_URL` to your deployed https address.
- This page has no login. Add authentication before putting it on the internet, or anyone who finds the URL can send prompts and withdraw.
- Check Safaricom's current Daraja docs for the B2C endpoint version and field names before going live.
