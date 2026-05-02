import Constants from "expo-constants";

type ExtraConfig = {
  apiBaseUrl?: string;
  socketUrl?: string;
  googleMapsApiKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? "").trim();
const socketUrl = (process.env.EXPO_PUBLIC_SOCKET_URL ?? extra.socketUrl ?? apiBaseUrl).trim();
const googleMapsApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? extra.googleMapsApiKey ?? "").trim();

if (!__DEV__) {
  if (!apiBaseUrl || apiBaseUrl.startsWith("http://localhost") || apiBaseUrl.includes("10.0.2.2")) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must be set to a production API URL for mobile-react builds.");
  }
  if (!socketUrl || socketUrl.startsWith("http://localhost") || socketUrl.includes("10.0.2.2")) {
    throw new Error("EXPO_PUBLIC_SOCKET_URL must be set to a production socket URL for mobile-react builds.");
  }
  if (!googleMapsApiKey) {
    throw new Error("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY must be set for production mobile-react builds.");
  }
}

export const config = {
  apiBaseUrl,
  socketUrl,
  googleMapsApiKey
};
