import Constants from 'expo-constants';

export const config = {
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    Constants.expoConfig?.extra?.apiBaseUrl ??
    'http://localhost:8080',
  socketUrl:
    process.env.EXPO_PUBLIC_SOCKET_URL ??
    Constants.expoConfig?.extra?.socketUrl ??
    'http://localhost:8080',
};
