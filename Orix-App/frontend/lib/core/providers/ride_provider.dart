/// Ride Provider
///
/// Manages ride requests and matching status.
/// Optimized to minimize unnecessary rebuilds.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../services/api_service.dart';
import '../utils/time_utils.dart';

/// Time window for rides
class TimeWindow {
  final String start;
  final String end;

  TimeWindow({required this.start, required this.end});

  factory TimeWindow.fromJson(Map<String, dynamic> json) {
    return TimeWindow(
      start: json['start'] as String,
      end: json['end'] as String,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TimeWindow && start == other.start && end == other.end;

  @override
  int get hashCode => Object.hash(start, end);
}

/// Ride request model
class RideRequest {
  final String requestId;
  final String pickupLabel;
  final String dropLabel;
  final String date;
  final TimeWindow timeWindow;
  final bool allowRiders;
  final bool femaleOnly;
  final String status;
  final String? groupId;
  final DateTime createdAt;
  final DateTime expiresAt;
  final int timeRemainingSeconds;

  RideRequest({
    required this.requestId,
    required this.pickupLabel,
    required this.dropLabel,
    required this.date,
    required this.timeWindow,
    required this.allowRiders,
    required this.femaleOnly,
    required this.status,
    this.groupId,
    required this.createdAt,
    required this.expiresAt,
    required this.timeRemainingSeconds,
  });

  factory RideRequest.fromJson(Map<String, dynamic> json) {
    return RideRequest(
      requestId: json['request_id'] as String,
      pickupLabel: json['pickup_label'] as String,
      dropLabel: json['drop_label'] as String,
      date: json['date'] as String,
      timeWindow: TimeWindow.fromJson(
        json['time_window'] as Map<String, dynamic>,
      ),
      allowRiders: json['allow_riders'] as bool,
      femaleOnly: json['female_only'] as bool,
      status: json['status'] as String,
      groupId: json['group_id'] as String?,
      createdAt: TimeUtils.parseUtc(json['created_at'] as String),
      expiresAt: TimeUtils.parseUtc(json['expires_at'] as String),
      timeRemainingSeconds: json['time_remaining_seconds'] as int,
    );
  }
}

/// Matching status
class MatchingStatus {
  final bool hasActiveRequest;
  final String? requestId;
  final String? status;
  final String? pickupLabel;
  final String? dropLabel;
  final String? date;
  final TimeWindow? timeWindow;
  final int? timeRemainingSeconds;
  final String? pendingConfirmationGroupId;
  final bool myReadinessConfirmed;
  final double? matchScore;
  final double? routeOverlapScore;
  final double? timeCompatibilityScore;

  MatchingStatus({
    required this.hasActiveRequest,
    this.requestId,
    this.status,
    this.pickupLabel,
    this.dropLabel,
    this.date,
    this.timeWindow,
    this.timeRemainingSeconds,
    this.pendingConfirmationGroupId,
    this.myReadinessConfirmed = false,
    this.matchScore,
    this.routeOverlapScore,
    this.timeCompatibilityScore,
  });

  factory MatchingStatus.fromJson(Map<String, dynamic> json) {
    return MatchingStatus(
      hasActiveRequest: json['has_active_request'] as bool,
      requestId: json['request_id'] as String?,
      status: json['status'] as String?,
      pickupLabel: json['pickup_label'] as String?,
      dropLabel: json['drop_label'] as String?,
      date: json['date'] as String?,
      timeWindow: json['time_window'] != null
          ? TimeWindow.fromJson(json['time_window'] as Map<String, dynamic>)
          : null,
      timeRemainingSeconds: json['time_remaining_seconds'] as int?,
      pendingConfirmationGroupId:
          json['pending_confirmation_group_id'] as String?,
      myReadinessConfirmed: json['my_readiness_confirmed'] as bool? ?? false,
      matchScore: (json['match_score'] as num?)?.toDouble(),
      routeOverlapScore: (json['route_overlap_score'] as num?)?.toDouble(),
      timeCompatibilityScore: (json['time_compatibility_score'] as num?)
          ?.toDouble(),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MatchingStatus &&
          hasActiveRequest == other.hasActiveRequest &&
          requestId == other.requestId &&
          status == other.status &&
          pickupLabel == other.pickupLabel &&
          dropLabel == other.dropLabel &&
          myReadinessConfirmed == other.myReadinessConfirmed &&
          pendingConfirmationGroupId == other.pendingConfirmationGroupId;

  @override
  int get hashCode => Object.hash(
    hasActiveRequest,
    requestId,
    status,
    pickupLabel,
    dropLabel,
    myReadinessConfirmed,
    pendingConfirmationGroupId,
  );
}

/// Ride provider
class RideProvider extends ChangeNotifier {
  final ApiService _apiService;

  bool _isLoading = false;
  String? _error;
  MatchingStatus? _matchingStatus;
  List<RideRequest> _rideHistory = [];
  DateTime? _lastStatusFetch;

  RideProvider(this._apiService);

  bool get isLoading => _isLoading;
  String? get error => _error;
  MatchingStatus? get matchingStatus => _matchingStatus;
  List<RideRequest> get rideHistory => _rideHistory;
  DateTime? get lastStatusFetch => _lastStatusFetch;
  bool get hasActiveRequest => _matchingStatus?.hasActiveRequest ?? false;

  /// Fetch matching status
  Future<void> fetchMatchingStatus() async {
    final wasLoading = _isLoading;
    _isLoading = true;
    _error = null;

    // Only notify if loading state changed
    if (!wasLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        notifyListeners();
      });
    }

    try {
      final response = await _apiService.get<Map<String, dynamic>>(
        '/rides/status',
      );

      if (response.success && response.data != null) {
        final newStatus = MatchingStatus.fromJson(response.data!);
        final changed = _matchingStatus != newStatus;
        _matchingStatus = newStatus;
        _lastStatusFetch = DateTime.now(); // Track when we fetched
        // Only notify if status actually changed
        if (changed || wasLoading) notifyListeners();
      } else {
        _error = response.error;
        notifyListeners();
      }
    } catch (e) {
      _error = 'Failed to load status: $e';
      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Create ride request
  Future<RideRequest?> createRideRequest({
    required double pickupLat,
    required double pickupLng,
    required String pickupLabel,
    required double dropLat,
    required double dropLng,
    required String dropLabel,
    required String date,
    required String timeWindowStart,
    required String timeWindowEnd,
    bool allowRiders = true,
    bool femaleOnly = false,
  }) async {
    if (_isLoading) return null;
    _isLoading = true;
    _error = null;
    notifyListeners();

    final response = await _apiService.post<Map<String, dynamic>>(
      '/rides',
      body: {
        'pickup_lat': pickupLat,
        'pickup_lng': pickupLng,
        'pickup_label': pickupLabel,
        'drop_lat': dropLat,
        'drop_lng': dropLng,
        'drop_label': dropLabel,
        'date': date,
        'time_window_start': timeWindowStart,
        'time_window_end': timeWindowEnd,
        'timezone_offset_minutes': DateTime.now().timeZoneOffset.inMinutes,
        'allow_riders': allowRiders,
        'female_only': femaleOnly,
      },
    );

    if (response.success && response.data != null) {
      final request = RideRequest.fromJson(response.data!);
      // Fetch full status to get group info, confirmation state, etc.
      await fetchMatchingStatus();
      _isLoading = false;
      notifyListeners();
      return request;
    } else {
      _error = response.error;
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  /// Cancel ride request
  Future<bool> cancelRideRequest(String requestId) async {
    _isLoading = true;
    notifyListeners();

    final response = await _apiService.delete<Map<String, dynamic>>(
      '/rides/$requestId',
    );

    if (response.success) {
      _matchingStatus = MatchingStatus(hasActiveRequest: false);
    } else {
      _error = response.error;
    }

    _isLoading = false;
    notifyListeners();
    return response.success;
  }

  /// Fetch ride history
  Future<void> fetchRideHistory({bool includeHistory = true}) async {
    final response = await _apiService.get<List<dynamic>>(
      '/rides',
      queryParams: {'include_history': includeHistory.toString()},
    );

    if (response.success && response.data != null) {
      final newHistory = response.data!
          .map((json) => RideRequest.fromJson(json as Map<String, dynamic>))
          .toList();

      // Only notify if history changed
      if (!listEquals(
        _rideHistory.map((e) => e.requestId).toList(),
        newHistory.map((e) => e.requestId).toList(),
      )) {
        _rideHistory = newHistory;
        notifyListeners();
      }
    }
  }

  /// Clear matching status when ride is completed
  void clearMatchingStatus() {
    _matchingStatus = null;
    _error = null;
    notifyListeners();
  }
}
