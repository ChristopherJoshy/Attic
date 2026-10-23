/// API Configuration
///
/// Centralized API configuration and constants.
library;

import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

class ApiConfig {
  /// Backend API URL - configure based on environment
  /// Debug (flutter run): Use 10.0.2.2 for Android emulator, localhost for others
  /// Production: http://165.232.187.186:8000
  static const Duration timeout = Duration(seconds: 30);

  /// Backend API URL
  static String get baseUrl {
    const envUrl = String.fromEnvironment('API_BASE_URL');
    if (envUrl.isNotEmpty) {
      return envUrl;
    }

    if (kReleaseMode) {
      return 'http://165.232.187.186:8000';
    }

    // specific handling for emulator to point to localhost of host machine
    if (Platform.isAndroid && kDebugMode) {
      return 'http://10.0.2.2:8000';
    }

    // For iOS, Web, and Desktop in debug mode
    return 'http://localhost:8000';
  }

  static const String apiVersion = 'v1';
}
