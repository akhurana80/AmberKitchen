import { OAuth2Client } from "google-auth-library";
import { config } from "../config";

const client = new OAuth2Client(config.googleClientId);

export async function verifyGoogleIdToken(idToken: string) {
  if (!config.googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: config.googleClientId
  });
  const payload = ticket.getPayload();

  if (!payload?.email) {
    throw new Error("Google account email is missing");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email
  };
}
