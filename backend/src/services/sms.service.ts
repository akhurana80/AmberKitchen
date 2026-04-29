import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { config } from "../config";

const sns = new SNSClient({ region: config.aws.region });

export async function sendOtpSms(phone: string, code: string) {
  if (config.nodeEnv !== "production") {
    return { provider: "dev", sent: true };
  }

  await sns.send(new PublishCommand({
    PhoneNumber: phone,
    Message: `Your AmberKitchen OTP is ${code}. It expires in 5 minutes.`,
    MessageAttributes: {
      "AWS.SNS.SMS.SenderID": {
        DataType: "String",
        StringValue: config.aws.snsSenderId
      },
      "AWS.SNS.SMS.SMSType": {
        DataType: "String",
        StringValue: "Transactional"
      }
    }
  }));

  return { provider: "aws-sns", sent: true };
}
