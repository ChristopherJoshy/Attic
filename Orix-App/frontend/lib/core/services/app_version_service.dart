/// App Version Service
///
/// Handles version checking and update notifications.
library;

import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'api_service.dart';
import '../utils/error_helper.dart';

class AppVersionInfo {
  final String currentVersion;
  final String minVersion;
  final bool updateRequired;
  final String? updateTitle;
  final String? updateNotes;
  final String? playStoreUrl;
  final String? appStoreUrl;

  AppVersionInfo({
    required this.currentVersion,
    required this.minVersion,
    required this.updateRequired,
    this.updateTitle,
    this.updateNotes,
    this.playStoreUrl,
    this.appStoreUrl,
  });

  factory AppVersionInfo.fromJson(Map<String, dynamic> json) {
    return AppVersionInfo(
      currentVersion: json['current_version'] as String,
      minVersion: json['min_version'] as String,
      updateRequired: json['update_required'] as bool,
      updateTitle: json['update_title'] as String?,
      updateNotes: json['update_notes'] as String?,
      playStoreUrl: json['play_store_url'] as String?,
      appStoreUrl: json['app_store_url'] as String?,
    );
  }

  String get storeUrl {
    if (Platform.isAndroid) {
      return playStoreUrl ??
          'https://play.google.com/store/apps/details?id=com.orix.app';
    } else if (Platform.isIOS) {
      return appStoreUrl ?? 'https://apps.apple.com/app/orix';
    }
    return playStoreUrl ?? '';
  }
}

class AppVersionService {
  final ApiService _apiService;
  static const String _seenVersionKey = 'seen_update_version';

  AppVersionService(this._apiService);

  Future<String> getLocalVersion() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      return packageInfo.version;
    } catch (e) {
      return '1.0.0';
    }
  }

  Future<AppVersionInfo?> checkForUpdates() async {
    try {
      final localVersion = await getLocalVersion();

      final response = await _apiService.get<Map<String, dynamic>>(
        '/app/version',
        queryParams: {'client_version': localVersion},
        withAuth: false,
      );

      if (response.success && response.data != null) {
        return AppVersionInfo.fromJson(response.data!);
      }
    } catch (e) {
      ErrorHelper.logError(e, null, 'Version check');
    }
    return null;
  }

  Future<bool> hasSeenUpdateDetails(String version) async {
    final prefs = await SharedPreferences.getInstance();
    final seenVersion = prefs.getString(_seenVersionKey);
    return seenVersion == version;
  }

  Future<void> markUpdateDetailsSeen(String version) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_seenVersionKey, version);
  }

  Future<AppVersionInfo?> shouldShowUpdatePopup() async {
    final versionInfo = await checkForUpdates();
    if (versionInfo == null) return null;

    if (versionInfo.updateRequired) {
      return versionInfo;
    }

    final localVersion = await getLocalVersion();
    if (_compareVersions(localVersion, versionInfo.currentVersion) < 0) {
      final hasSeen = await hasSeenUpdateDetails(versionInfo.currentVersion);
      if (!hasSeen) return versionInfo;
    }

    return null;
  }

  int _compareVersions(String v1, String v2) {
    List<int> parse(String v) {
      final parts = v.replaceAll('+', '.').split('.');
      return parts.take(3).map((p) => int.tryParse(p) ?? 0).toList();
    }

    final p1 = parse(v1);
    final p2 = parse(v2);

    for (int i = 0; i < 3; i++) {
      final a = i < p1.length ? p1[i] : 0;
      final b = i < p2.length ? p2[i] : 0;
      if (a < b) return -1;
      if (a > b) return 1;
    }
    return 0;
  }
}
