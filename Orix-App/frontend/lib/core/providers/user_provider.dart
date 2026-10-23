/// User Provider
///
/// Manages user profile and rider status.
/// Optimized to minimize unnecessary rebuilds.
library;

import 'package:flutter/widgets.dart';

import '../services/api_service.dart';
import '../services/notification_service.dart';
import '../utils/time_utils.dart';
import 'auth_provider.dart';

/// Rider information
class RiderInfo {
  final String vehicleType;
  final String fromLabel;
  final String toLabel;
  final int seats;
  final DateTime expiresAt;
  final int timeRemainingSeconds;

  RiderInfo({
    required this.vehicleType,
    required this.fromLabel,
    required this.toLabel,
    required this.seats,
    required this.expiresAt,
    required this.timeRemainingSeconds,
  });

  factory RiderInfo.fromJson(Map<String, dynamic> json) {
    return RiderInfo(
      vehicleType: json['vehicle_type'] as String,
      fromLabel: json['from_label'] as String,
      toLabel: json['to_label'] as String,
      seats: json['seats'] as int,
      expiresAt: TimeUtils.parseUtc(json['expires_at'] as String),
      timeRemainingSeconds: json['time_remaining_seconds'] as int,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RiderInfo &&
          vehicleType == other.vehicleType &&
          fromLabel == other.fromLabel &&
          toLabel == other.toLabel &&
          seats == other.seats;

  @override
  int get hashCode => Object.hash(vehicleType, fromLabel, toLabel, seats);
}

/// User provider for profile management
class UserProvider extends ChangeNotifier {
  final ApiService _apiService;
  final NotificationService _notificationService;
  AuthProvider? _authProvider;

  bool _isLoading = false;
  String? _error;
  RiderInfo? _riderInfo;

  String? _lastSyncedToken;
  bool _isSyncingToken = false;

  UserProvider(this._apiService, this._notificationService) {
    _notificationService.onTokenRefresh = (token) {
      if (_authProvider?.user != null) {
        _syncFcmToken();
      }
    };
  }

  bool get isLoading => _isLoading;
  String? get error => _error;
  RiderInfo? get riderInfo => _riderInfo;
  bool get isRider => _riderInfo != null;

  /// Update auth reference and sync FCM token if logged in
  void updateAuth(AuthProvider auth) {
    _authProvider = auth;
    if (auth.user != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _syncFcmToken();
      });
    } else {
      _lastSyncedToken = null;
    }
  }

  Future<void> _syncFcmToken() async {
    if (_isSyncingToken) return;

    final token = _notificationService.fcmToken;
    if (token != null && token != _lastSyncedToken) {
      _isSyncingToken = true;
      try {
        final success = await updateProfile(fcmToken: token);
        if (success) {
          _lastSyncedToken = token;
        }
      } finally {
        _isSyncingToken = false;
      }
    }
  }

  /// Fetch rider info
  Future<void> fetchRiderInfo() async {
    final wasLoading = _isLoading;
    _isLoading = true;
    _error = null;

    if (!wasLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        notifyListeners();
      });
    }

    final response = await _apiService.get<Map<String, dynamic>>(
      '/users/me/rider',
    );

    if (response.success && response.data != null) {
      final data = response.data!;
      final wasRider = _riderInfo != null;
      RiderInfo? newRiderInfo;

      if (data['is_rider'] == true) {
        newRiderInfo = RiderInfo.fromJson(data);
      }

      final isNowRider = newRiderInfo != null;
      final riderChanged = wasRider != isNowRider || _riderInfo != newRiderInfo;

      _riderInfo = newRiderInfo;
      _isLoading = false;

      // Only notify if rider status actually changed
      if (riderChanged || wasLoading) {
        notifyListeners();
      }
    } else {
      _error = response.error;
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Enable rider mode
  Future<bool> enableRiderMode({
    required String vehicleType,
    required double fromLat,
    required double fromLng,
    required String fromLabel,
    required double toLat,
    required double toLng,
    required String toLabel,
    required String date,
    required String timeWindowStart,
    required String timeWindowEnd,
    required int seats,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    final response = await _apiService.post<Map<String, dynamic>>(
      '/users/me/rider',
      body: {
        'vehicle_type': vehicleType,
        'from_lat': fromLat,
        'from_lng': fromLng,
        'from_label': fromLabel,
        'to_lat': toLat,
        'to_lng': toLng,
        'to_label': toLabel,
        'date': date,
        'time_window_start': timeWindowStart,
        'time_window_end': timeWindowEnd,
        'seats': seats,
      },
    );

    if (response.success && response.data != null) {
      _riderInfo = RiderInfo.fromJson(response.data!);
      _isLoading = false;
      notifyListeners();
      return true;
    } else {
      _error = response.error;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Disable rider mode
  Future<bool> disableRiderMode() async {
    _isLoading = true;
    notifyListeners();

    final response = await _apiService.delete<Map<String, dynamic>>(
      '/users/me/rider',
    );

    if (response.success) {
      _riderInfo = null;
    } else {
      _error = response.error;
    }

    _isLoading = false;
    notifyListeners();
    return response.success;
  }

  /// Update profile
  Future<bool> updateProfile({
    String? displayName,
    String? photoUrl,
    String? fcmToken,
  }) async {
    final wasLoading = _isLoading;
    _isLoading = true;

    // Don't notify for silent token sync
    if (fcmToken == null) {
      notifyListeners();
    }

    final body = <String, dynamic>{};
    if (displayName != null) body['display_name'] = displayName;
    if (photoUrl != null) body['photo_url'] = photoUrl;
    if (fcmToken != null) body['fcm_token'] = fcmToken;

    final response = await _apiService.put<Map<String, dynamic>>(
      '/users/me',
      body: body,
    );

    _isLoading = false;

    // Only notify if we showed loading before
    if (fcmToken == null || wasLoading) {
      notifyListeners();
    }

    if (response.success) {
      await _authProvider?.refreshUser();
      return true;
    } else {
      _error = response.error;
      return false;
    }
  }
}
