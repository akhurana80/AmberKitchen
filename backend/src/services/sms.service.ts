import { SmsClient } from "@azure/communication-sms";
import { config } from "../config";

export async function sendOtpSms(phone: string, code: string) {
  if (config.nodeEnv !== "production") {
    return { provider: "dev", sent: true };
  }

  if (!config.azure.communicationConnectionString || !config.azure.smsFrom) {
    throw new Error("Azure Communication Services SMS is not configured");
  }

  const client = new SmsClient(config.azure.communicationConnectionString);
  const response = await client.send({
    from: config.azure.smsFrom,
    to: [phone],
    message: `Your AmberKitchen OTP is ${code}. It expires in 5 minutes.`
  });

  const result = response[0];
  if (!result?.successful) {
    throw new Error(result?.errorMessage ?? "Azure SMS delivery failed");
  }

  return { provider: "azure-communication-services", sent: true };
}
