import { randomInt } from "crypto";
import { query } from "../db";
import { config } from "../config";
import { sendOtpSms } from "./sms.service";

export async function createOtp(phone: string) {
  const code = randomInt(100000, 999999).toString();
  await query(
    `insert into otp_codes (phone, code_hash, expires_at)
     values ($1, crypt($2, gen_salt('bf')), now() + ($3 || ' seconds')::interval)`,
    [phone, code, config.otpTtlSeconds]
  );

  const sms = await sendOtpSms(phone, code);
  await query(
    `insert into integration_events (provider, event_type, status, payload)
     values ('azure-whatsapp', 'otp-fallback-ready', 'queued', $1::jsonb),
            ('missed-call', 'otp-primary-ready', 'queued', $1::jsonb)
     on conflict do nothing`,
    [JSON.stringify({ phoneMasked: phone.slice(-4), channelStrategy: "missed-call-primary-whatsapp-fallback-sms-last" })]
  );

  if (sms.provider === "dev") {
    return { sent: true, devCode: code };
  }

  return { sent: true };
}

export async function verifyOtp(phone: string, code: string) {
  const result = await query<{ id: string }>(
    `select id from otp_codes
     where phone = $1
       and consumed_at is null
       and expires_at > now()
       and code_hash = crypt($2, code_hash)
     order by created_at desc
     limit 1`,
    [phone, code]
  );

  const otp = result.rows[0];
  if (!otp) {
    return false;
  }

  await query("update otp_codes set consumed_at = now() where id = $1", [otp.id]);
  return true;
}
