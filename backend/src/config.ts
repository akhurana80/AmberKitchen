import dotenv from "dotenv";

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:4200").split(",").map(origin => origin.trim()).filter(Boolean),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 120),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? "",
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
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    callbackUrl: process.env.RAZORPAY_CALLBACK_URL ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? ""
  },
  fcmServiceAccountJson: process.env.FCM_SERVICE_ACCOUNT_JSON ?? "{}",
  azure: {
    communicationConnectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING ?? "",
    smsFrom: process.env.AZURE_SMS_FROM ?? "",
    emailFrom: process.env.AZURE_EMAIL_FROM ?? "",
    whatsappFrom: process.env.AZURE_WHATSAPP_FROM ?? "",
    storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING ?? "",
    storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME ?? "",
    storageContainer: process.env.AZURE_STORAGE_CONTAINER ?? "amberkitchen-assets",
    computerVisionEndpoint: process.env.AZURE_COMPUTER_VISION_ENDPOINT ?? "",
    computerVisionKey: process.env.AZURE_COMPUTER_VISION_KEY ?? "",
    faceEndpoint: process.env.AZURE_FACE_ENDPOINT ?? "",
    faceKey: process.env.AZURE_FACE_KEY ?? "",
    applicationInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ?? ""
  }
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}
