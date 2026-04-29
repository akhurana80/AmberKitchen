import axios from "axios";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { config } from "../config";
import { query } from "../db";

export async function createPayment(provider: "paytm" | "phonepe", orderId: string, amountPaise: number) {
  const transactionId = uuid();

  await query(
    `insert into payments (id, order_id, provider, amount_paise, status)
     values ($1, $2, $3, $4, 'created')`,
    [transactionId, orderId, provider, amountPaise]
  );

  if (provider === "phonepe") {
    return createPhonePePayment(transactionId, amountPaise);
  }

  return createPaytmPayment(transactionId, amountPaise);
}

async function createPaytmPayment(transactionId: string, amountPaise: number) {
  const amount = (amountPaise / 100).toFixed(2);
  const body = {
    requestType: "Payment",
    mid: config.paytm.mid,
    websiteName: config.paytm.website,
    orderId: transactionId,
    callbackUrl: config.paytm.callbackUrl,
    txnAmount: { value: amount, currency: "INR" },
    userInfo: { custId: "amber-customer" }
  };

  return {
    provider: "paytm",
    transactionId,
    amount,
    payload: body,
    note: "Send this payload to Paytm Initiate Transaction API after adding checksum with merchant key."
  };
}

async function createPhonePePayment(transactionId: string, amountPaise: number) {
  const payload = {
    merchantId: config.phonePe.merchantId,
    merchantTransactionId: transactionId,
    merchantUserId: "amber-customer",
    amount: amountPaise,
    redirectMode: "POST",
    callbackUrl: config.phonePe.callbackUrl,
    paymentInstrument: { type: "PAY_PAGE" }
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  const path = "/pg/v1/pay";
  const checksum = sha256(encoded + path + config.phonePe.saltKey) + "###" + config.phonePe.saltIndex;

  return {
    provider: "phonepe",
    transactionId,
    request: { request: encoded },
    headers: { "X-VERIFY": checksum },
    note: "POST request to PhonePe pay endpoint when live credentials are configured."
  };
}

export async function recordPaymentCallback(provider: string, transactionId: string, status: string, rawPayload: unknown) {
  await query(
    `update payments
     set status = $1, raw_callback = $2, updated_at = now()
     where id = $3 and provider = $4`,
    [status, rawPayload, transactionId, provider]
  );
}

export async function verifyPhonePeTransaction(transactionId: string) {
  const path = `/pg/v1/status/${config.phonePe.merchantId}/${transactionId}`;
  const checksum = sha256(path + config.phonePe.saltKey) + "###" + config.phonePe.saltIndex;
  return axios.get(`https://api.phonepe.com/apis/hermes${path}`, {
    headers: {
      "X-VERIFY": checksum,
      "X-MERCHANT-ID": config.phonePe.merchantId
    }
  });
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
