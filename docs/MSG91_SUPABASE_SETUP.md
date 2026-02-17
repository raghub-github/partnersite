# MSG91 + Supabase Auth for Phone OTP (6-Digit)

This app uses **Supabase Auth** for phone OTP. Supabase generates the 6-digit OTP. MSG91 **only delivers** the SMS — it does **not** generate or validate OTP.

---

## 1. Flow (Supabase-Generated OTP)

1. User enters mobile → app calls `supabase.auth.signInWithOtp({ phone: '+91...' })`
2. **Supabase** generates a 6-digit OTP and invokes the **Send SMS** hook with `phone` and `otp`
3. Our hook sends the OTP via **MSG91 Text SMS API** (delivery only — do NOT use MSG91 OTP API)
4. User enters the 6-digit code → app calls `supabase.auth.verifyOtp({ phone, token, type: 'sms' })` → **Supabase** verifies and returns a session

---

## 2. MSG91 Configuration

- Sign up at [msg91.com](https://msg91.com)
- Get your **Auth Key**
- Use **Text SMS API** (`api/v2/sendsms`) — **NOT** the OTP API (`api/v5/otp`)
- MSG91 is delivery-only; OTP length and validation are controlled by Supabase

---

## 3. Send SMS Hook (This App)

This app provides an API route: **`POST /api/auth/send-sms`**

- Supabase Dashboard → **Authentication** → **Hooks** → **Send SMS**
- Hook URL: `https://your-domain.com/api/auth/send-sms`

The hook:

1. Validates the Supabase hook secret (if `SUPABASE_SEND_SMS_HOOK_SECRET` is set)
2. Extracts `phone` and `otp` from the request body (Supabase sends `user.phone` and `sms.otp`)
3. Sends the OTP via MSG91 **Text SMS API** — passes the Supabase OTP in the message body
4. Returns 200 on success

### Environment Variables

Add to `.env.local` (or your deployment env):

```bash
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_SENDER_ID=GMMSMS              # optional; default "GMMSMS"
SUPABASE_SEND_SMS_HOOK_SECRET=xxx   # optional; validates Supabase hook calls
```

---

## 4. Do NOT Use MSG91 OTP API

- Do **not** call `https://control.msg91.com/api/v5/otp` — that generates OTP on MSG91's side
- Use **Text SMS API**: `https://api.msg91.com/api/v2/sendsms`
- The hook sends the OTP value from Supabase as the message content

---

## 5. Supabase Dashboard

- **SMS OTP Length**: 6 (default; do not reduce)
- **Phone Provider**: Enabled
- **Send SMS Hook**: Enabled, URL = `https://your-domain.com/api/auth/send-sms`

---

## 6. Enable Phone OTP in App

In `.env.local`:

```bash
NEXT_PUBLIC_ENABLE_PHONE_OTP_REGISTER=true
NEXT_PUBLIC_ENABLE_PHONE_OTP_LOGIN=true
```

Restart the Next.js dev server.

---

## 7. Summary

| Item | Where |
|------|--------|
| OTP generation | Supabase |
| OTP verification | Supabase |
| SMS delivery | MSG91 Text SMS API (via `/api/auth/send-sms`) |
| MSG91 Auth Key | `.env.local` / deployment env |
| Hook secret | Optional; `SUPABASE_SEND_SMS_HOOK_SECRET` |
