/// Notification Provider
///
/// Manages app notifications with optimized rebuild behavior.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../services/api_service.dart';
import '../services/notification_service.dart';
import '../utils/time_utils.dart';

/// App notification model
class AppNotification {
  final String id;
  final String title;
  final String body;
  final String type;
  final bool isRead;
  final DateTime createdAt;
  final Map<String, dynamic>? data;

  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.isRead,
    required this.createdAt,
    this.data,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['notification_id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      type: json['type'] as String? ?? 'system',
      isRead: json['read'] as bool? ?? false,
      createdAt: TimeUtils.parseUtc(json['created_at'] as String),
      data: json['data'] as Map<String, dynamic>?,
    );
  }

  AppNotification copyWith({bool? isRead}) {
    return AppNotification(
      id: id,
      title: title,
      body: body,
      type: type,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
      data: data,
    );
  }
}

class NotificationProvider extends ChangeNotifier {
  final ApiService _apiService;
  final NotificationService? _notificationService;

  bool _isLoading = false;
  String? _error;
  List<AppNotification> _notifications = [];
  int _unreadCount = 0;

  Timer? _debounceTimer;
  static const Duration _debounceDuration = Duration(seconds: 2);

  NotificationProvider(this._apiService, [this._notificationService]) {
    if (_notificationService != null) {
      _notificationService.onNotificationReceived = (message) {
        _handleNotificationAction(message);
        _debounceTimer?.cancel();
        _debounceTimer = Timer(_debounceDuration, () {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            fetchNotifications();
          });
        });
      };
    }
  }

  void _handleNotificationAction(dynamic message) {
    // Extract action from message data
    final action = message.data?['action'] as String?;
    final groupId = message.data?['group_id'] as String?;

    if (action == 'show_alarm' && groupId != null) {
      // Queue the alarm to be shown when the app is ready
      _pendingAlarmGroupId = groupId;
      _pendingAlarmRideTime = message.data?['ride_time'] as String? ?? '';
      _pendingAlarmPickupSummary =
          message.data?['pickup_summary'] as String? ?? '';

      // Notify listeners immediately so the alarm screen can be shown without manual refresh
      notifyListeners();
    }
  }

  String? _pendingAlarmGroupId;
  String? _pendingAlarmRideTime;
  String? _pendingAlarmPickupSummary;

  String? get pendingAlarmGroupId => _pendingAlarmGroupId;
  String? get pendingAlarmRideTime => _pendingAlarmRideTime;
  String? get pendingAlarmPickupSummary => _pendingAlarmPickupSummary;

  void clearPendingAlarm() {
    _pendingAlarmGroupId = null;
    _pendingAlarmRideTime = null;
    _pendingAlarmPickupSummary = null;
    notifyListeners();
  }

  void setPendingAlarmFromService({
    required String groupId,
    required String rideTime,
    required String pickupSummary,
  }) {
    _pendingAlarmGroupId = groupId;
    _pendingAlarmRideTime = rideTime;
    _pendingAlarmPickupSummary = pickupSummary;
    notifyListeners();
  }

  bool get isLoading => _isLoading;
  String? get error => _error;
  List<AppNotification> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get hasUnread => _unreadCount > 0;

  /// Fetch notifications
  Future<void> fetchNotifications() async {
    final wasLoading = _isLoading;
    _isLoading = true;
    _error = null;

    if (!wasLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        notifyListeners();
      });
    }

    try {
      final response = await _apiService.get<Map<String, dynamic>>(
        '/notifications',
      );

      if (response.success && response.data != null) {
        final data = response.data!;
        final list = data['notifications'] as List<dynamic>? ?? [];

        final newNotifications = list
            .map(
              (json) => AppNotification.fromJson(json as Map<String, dynamic>),
            )
            .toList();
        final newUnreadCount = data['unread_count'] as int? ?? 0;

        // Only notify if data actually changed
        final oldIds = _notifications.map((n) => n.id).toList();
        final newIds = newNotifications.map((n) => n.id).toList();
        final changed =
            !listEquals(oldIds, newIds) || _unreadCount != newUnreadCount;

        _notifications = newNotifications;
        _unreadCount = newUnreadCount;

        if (changed || wasLoading) {
          notifyListeners();
        }
      } else {
        _error = response.error;
      }
    } catch (e) {
      _error = 'Failed to load notifications: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Mark notification as read
  Future<bool> markAsRead(String notificationId) async {
    final response = await _apiService.put<Map<String, dynamic>>(
      '/notifications/$notificationId/read',
    );

    if (response.success) {
      final index = _notifications.indexWhere((n) => n.id == notificationId);
      if (index != -1 && !_notifications[index].isRead) {
        _notifications[index] = _notifications[index].copyWith(isRead: true);
        _unreadCount = _notifications.where((n) => !n.isRead).length;
        notifyListeners();
      }
      return true;
    } else {
      _error = response.error;
      return false;
    }
  }

  /// Mark all as read
  Future<bool> markAllAsRead() async {
    if (_unreadCount == 0) return true;

    final response = await _apiService.put<Map<String, dynamic>>(
      '/notifications/read-all',
    );

    if (response.success) {
      _notifications = _notifications
          .map((n) => n.copyWith(isRead: true))
          .toList();
      _unreadCount = 0;
      notifyListeners();
      return true;
    } else {
      _error = response.error;
      return false;
    }
  }

  /// Delete notification
  Future<bool> deleteNotification(String notificationId) async {
    final response = await _apiService.delete<Map<String, dynamic>>(
      '/notifications/$notificationId',
    );

    if (response.success) {
      _notifications.removeWhere((n) => n.id == notificationId);
      _unreadCount = _notifications.where((n) => !n.isRead).length;
      notifyListeners();
      return true;
    } else {
      _error = response.error;
      return false;
    }
  }

  /// Clear all notifications
  Future<bool> clearAllNotifications() async {
    if (_notifications.isEmpty) return true;

    final response = await _apiService.delete<Map<String, dynamic>>(
      '/notifications',
    );

    if (response.success) {
      _notifications.clear();
      _unreadCount = 0;
      notifyListeners();
      return true;
    } else {
      _error = response.error;
      return false;
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }
}
