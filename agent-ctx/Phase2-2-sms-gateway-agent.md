# SMS Gateway Integration Agent — Task Phase2-2

## Task: Integrate configurable SMS/WhatsApp gateway for OTP delivery

## Work Completed

### 1. Created `/src/lib/sms-gateway.ts`
- Unified SMS gateway abstraction with 3 provider implementations:
  - **mock** (default): Logs OTP, returns success with provider='mock'
  - **twilio**: REST API via fetch, Basic auth, SMS delivery
  - **fonnte**: WhatsApp API via POST, Authorization header
- Phone normalization functions:
  - `normalizePhoneInternational()`: For Twilio (→ +62XXX)
  - `normalizePhoneFonnte()`: For Fonnte/WhatsApp (→ 62XXX digits only)
- `sendSMS(phone, message)`: Generic message sender via configured provider
- `sendOTP(phone, otpCode, expiryMinutes)`: OTP-specific sender with Indonesian message format
- Error handling: Never throws, logs failures as warnings, OTP remains in DB for retry
- Provider selection: `SMS_PROVIDER` env var, falls back to 'mock' if unset/unknown

### 2. Updated `/api/auth/otp/send/route.ts`
- Added `import { sendOTP } from '@/lib/sms-gateway'`
- Replaced `logger.info('[OTP] Code xxx sent to xxx')` with `await sendOTP(normalizedPhone, otpCode, OTP_EXPIRY_MINUTES)`
- Logs success/failure with provider, messageId, and phone details
- `devOtp` still returned in development mode

### 3. Updated `/api/user/2fa/route.ts`
- Added `import { sendOTP } from '@/lib/sms-gateway'`
- In `send-otp` action: replaced logger mock with `await sendOTP(user.phone, newOtpCode, OTP_EXPIRY_MINUTES)`
- Logs success/failure with provider, messageId details
- `devOtp` still returned in development mode

### 4. Updated `.env`
- Added SMS gateway configuration section:
  - `SMS_PROVIDER=mock`
  - `TWILIO_ACCOUNT_SID=`, `TWILIO_AUTH_TOKEN=`, `TWILIO_PHONE_NUMBER=`
  - `FONNTE_API_KEY=`, `FONNTE_DEVICE_ID=`

### 5. Lint Check
- `bun run lint` passes with 0 errors, 0 warnings
