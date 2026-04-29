import dotenv from "dotenv";

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
  paytm: {
    mid: process.env.PAYTM_MID ?? "",
    merchantKey: process.env.PAYTM_MERCHANT_KEY ?? "",
    website: process.env.PAYTM_WEBSITE ?? "WEBSTAGING",
    callbackUrl: process.env.PAYTM_CALLBACK_URL ?? ""
  },
  phonePe: {
    merchantId: process.env.PHONEPE_MERCHANT_ID ?? "",
    saltKey: process.env.PHONEPE_SALT_KEY ?? "",
    saltIndex: process.env.PHONEPE_SALT_INDEX ?? "1",
    callbackUrl: process.env.PHONEPE_CALLBACK_URL ?? ""
  },
  fcmServiceAccountJson: process.env.FCM_SERVICE_ACCOUNT_JSON ?? "{}",
  aws: {
    region: process.env.AWS_REGION ?? "us-east-1",
    snsSenderId: process.env.AWS_SNS_SENDER_ID ?? "AMBRKTCHN"
  }
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}
