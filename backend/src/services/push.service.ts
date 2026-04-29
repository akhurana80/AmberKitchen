import admin from "firebase-admin";
import { config } from "../config";
import { query } from "../db";

let initialized = false;

function ensureFirebase() {
  if (initialized) {
    return;
  }

  const serviceAccount = JSON.parse(config.fcmServiceAccountJson);
  if (!serviceAccount.project_id) {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON is not configured");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  initialized = true;
}

export async function saveDeviceToken(userId: string, token: string, platform: string) {
  await query(
    `insert into device_tokens (user_id, token, platform)
     values ($1, $2, $3)
     on conflict (token) do update set platform = excluded.platform, updated_at = now()`,
    [userId, token, platform]
  );
}

export async function sendPushToUser(userId: string, title: string, body: string, data: Record<string, string> = {}) {
  ensureFirebase();
  const tokens = await query<{ token: string }>("select token from device_tokens where user_id = $1", [userId]);
  if (tokens.rows.length === 0) {
    return { sent: 0 };
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens: tokens.rows.map(row => row.token),
    notification: { title, body },
    data
  });

  return { sent: response.successCount, failed: response.failureCount };
}
