class AppConfig {
  static const bool isProduction = bool.fromEnvironment('PRODUCTION', defaultValue: false);

  static String get apiBaseUrl {
    if (isProduction) {
      return const String.fromEnvironment('API_BASE_URL', defaultValue: 'https://api.amberkitchen.com');
    } else {
      return const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
    }
  }

  static String get googleClientId {
    if (isProduction) {
      return const String.fromEnvironment('GOOGLE_CLIENT_ID', defaultValue: 'your-production-google-client-id');
    } else {
      return const String.fromEnvironment('GOOGLE_CLIENT_ID', defaultValue: 'your-local-google-client-id');
    }
  }

  static String get googleServerClientId {
    if (isProduction) {
      return const String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID', defaultValue: 'your-production-google-server-client-id');
    } else {
      return const String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID', defaultValue: 'your-local-google-server-client-id');
    }
  }

  static String get serviceRegionName {
    return const String.fromEnvironment('SERVICE_REGION_NAME', defaultValue: 'Delhi NCR');
  }

  static double get serviceRegionLat {
    return double.tryParse(const String.fromEnvironment('SERVICE_REGION_LAT', defaultValue: '28.6139')) ?? 28.6139;
  }

  static double get serviceRegionLng {
    return double.tryParse(const String.fromEnvironment('SERVICE_REGION_LNG', defaultValue: '77.2090')) ?? 77.2090;
  }
}