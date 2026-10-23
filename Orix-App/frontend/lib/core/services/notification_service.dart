import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Background message handler (must be top-level function)
/// CRITICAL: Handles DATA-ONLY FCM messages when app is backgrounded/killed
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();

  // Handle RIDE_ALARM data-only messages
  if (message.data['type'] == 'RIDE_ALARM') {
    final FlutterLocalNotificationsPlugin localNotifications =
        FlutterLocalNotificationsPlugin();

    // Show full-screen alarm notification
    await localNotifications.show(
      999, // Unique ID for alarm
      '🔔 Catch Your Ride!',
      'Your ride is starting! Tap to open.',
      NotificationDetails(
        android: AndroidNotificationDetails(
          'ride_alarm_channel',
          'Ride Alarms',
          channelDescription: 'Full-screen alarms for ride start times',
          icon: '@drawable/ic_notification',
          priority: Priority.max,
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
          audioAttributesUsage: AudioAttributesUsage.alarm,
          fullScreenIntent: true,
          category: AndroidNotificationCategory.alarm,
          visibility: NotificationVisibility.public,
          ongoing: true,
          autoCancel: false,
          actions: [
            AndroidNotificationAction(
              'I_AM_HERE',
              'I Am Here',
              showsUserInterface: true,
            ),
          ],
        ),
      ),
      payload:
          'show_alarm|${message.data['group_id']}|${message.data['ride_time']}|${message.data['pickup_summary']}',
    );
  }
}

/// Notification service
class NotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  /// FCM token
  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  /// Callback for when token changes (to sync with backend)
  void Function(String token)? onTokenRefresh;

  /// Callback for when a notification is received in foreground
  void Function(RemoteMessage message)? onNotificationReceived;

  /// Pending alarm data from notification tap
  Map<String, String>? _pendingAlarmData;
  Map<String, String>? get pendingAlarmData => _pendingAlarmData;

  void clearPendingAlarmData() {
    _pendingAlarmData = null;
  }

  /// Stream of incoming messages when app is in foreground
  Stream<RemoteMessage> get onMessage => FirebaseMessaging.onMessage;

  /// Stream for when user taps notification (app was in background)
  Stream<RemoteMessage> get onMessageOpenedApp =>
      FirebaseMessaging.onMessageOpenedApp;

  /// Initialization flag
  bool _isInitialized = false;

  /// Android Notification Channel for High Importance
  static const AndroidNotificationChannel _androidChannel =
      AndroidNotificationChannel(
        'high_importance_channel', // id
        'High Importance Notifications', // title
        description:
            'This channel is used for important notifications.', // description
        importance: Importance.max,
        playSound: true,
      );

  /// Android Notification Channel for Ride Alarms (rings until user responds)
  static const AndroidNotificationChannel _alarmChannel =
      AndroidNotificationChannel(
        'ride_alarm_channel', // id
        'Ride Alarms', // title
        description:
            'Urgent ride notifications that require immediate attention.',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
        enableLights: true,
      );

  /// Initialize notifications
  Future<void> initialize() async {
    if (_isInitialized) return;

    // Platform specific initialization settings
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@drawable/ic_notification');

    // Note: iOS permissions are requested by FirebaseMessaging below
    const DarwinInitializationSettings initializationSettingsDarwin =
        DarwinInitializationSettings();

    const InitializationSettings initializationSettings =
        InitializationSettings(
          android: initializationSettingsAndroid,
          iOS: initializationSettingsDarwin,
        );

    await _localNotifications.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (details) {
        // Handle notification tap to show alarm screen
        final payload = details.payload;
        if (payload != null && payload.isNotEmpty) {
          List<String> parts = [];

          if (payload.startsWith('show_alarm|')) {
            parts = payload.split('|');
          } else if (payload.startsWith('show_alarm:')) {
            // Legacy colon-delimited payload
            parts = payload.split(':');
          } else if (payload.contains('|')) {
            // Fallback to raw pipe-separated payload
            parts = payload.split('|');
          }

          if (parts.length >= 4) {
            final groupId = parts[1];
            final rideTime = parts[2];
            final pickupSummary = parts.sublist(3).join('|');

            // Store pending alarm details for display when app opens
            _pendingAlarmData = {
              'group_id': groupId,
              'ride_time': rideTime,
              'pickup_summary': pickupSummary,
            };
          }
        }
      },
    );

    // Create Android channels
    final resolve = _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    if (resolve != null) {
      await resolve.createNotificationChannel(_androidChannel);
      await resolve.createNotificationChannel(_alarmChannel);
    }

    // Request permission
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      _isInitialized = true;

      // Set up background handler
      FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

      // Get FCM token
      _fcmToken = await _messaging.getToken();
      debugPrint('[Notifications] Permission granted; token: $_fcmToken');

      // Listen for token refresh
      _messaging.onTokenRefresh.listen((token) {
        _fcmToken = token;
        debugPrint('[Notifications] FCM token refreshed: $token');
        onTokenRefresh?.call(token);
      });

      // Enable foreground notification presentation options
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

      // Initialize preferences for promotions
      final prefs = await SharedPreferences.getInstance();
      final promotionsEnabled = prefs.getBool('notif_promotions') ?? true;

      if (promotionsEnabled) {
        await subscribeToTopic('promotions');
      } else {
        await unsubscribeFromTopic('promotions');
      }
    } else {
      debugPrint(
        '[Notifications] Permission not granted: ${settings.authorizationStatus}',
      );
    }
  }

  /// Toggle promotions
  Future<void> setPromotionsEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notif_promotions', enabled);

    if (enabled) {
      await subscribeToTopic('promotions');
    } else {
      await unsubscribeFromTopic('promotions');
    }
  }

  /// Processed message IDs to prevent duplicates
  final Set<String> _processedMessageIds = {};

  void _handleForegroundMessage(RemoteMessage message) {
    if (message.messageId != null) {
      if (_processedMessageIds.contains(message.messageId)) {
        return;
      }
      _processedMessageIds.add(message.messageId!);

      if (_processedMessageIds.length > 50) {
        _processedMessageIds.remove(_processedMessageIds.first);
      }
    }

    RemoteNotification? notification = message.notification;
    AndroidNotification? android = message.notification?.android;

    // Check if this is a ride-related notification
    final type = message.data['type'] ?? '';
    final isRideAlarmData = message.data['isRideAlarm'] == 'true';
    final isRideAlarm =
        isRideAlarmData ||
        type == 'ride_start' ||
        type == 'ride_reminder' ||
        type == 'ride_completed';

    debugPrint(
      '[Notifications] Received foreground message: type=$type, isRideAlarm=$isRideAlarm',
    );

    // For ride alarms (when app is in FOREGROUND), show full-screen notification
    if (isRideAlarm) {
      final groupId = message.data['group_id'] ?? '';
      final rideTime = message.data['ride_time'] ?? '';
      final pickupSummary = message.data['pickup_summary'] ?? '';

      // Show full-screen notification with action button
      _localNotifications.show(
        999, // Fixed ID for alarm
        '🔔 Catch Your Ride!',
        'Your ride is starting! Tap to open.',
        NotificationDetails(
          android: AndroidNotificationDetails(
            'ride_alarm_channel',
            'Ride Alarms',
            channelDescription: 'Full-screen alarms for ride start times',
            icon: '@drawable/ic_notification',
            priority: Priority.max,
            importance: Importance.max,
            playSound: true,
            enableVibration: true,
            audioAttributesUsage: AudioAttributesUsage.alarm,
            fullScreenIntent: true,
            category: AndroidNotificationCategory.alarm,
            visibility: NotificationVisibility.public,
            ongoing: true,
            autoCancel: false,
            actions: [
              AndroidNotificationAction(
                'I_AM_HERE',
                'I Am Here',
                showsUserInterface: true,
              ),
            ],
          ),
        ),
        payload: 'show_alarm|$groupId|$rideTime|$pickupSummary',
      );

      onNotificationReceived?.call(message);
      return;
    }

    // Show local notification using the appropriate channel
    if (notification != null && android != null) {
      _localNotifications.show(
        notification.hashCode,
        notification.title,
        notification.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _androidChannel.id,
            _androidChannel.name,
            channelDescription: _androidChannel.description,
            icon:
                '@drawable/ic_notification', // Monochrome small icon to satisfy Android requirements
            priority: Priority.high,
            importance: Importance.max,
            playSound: true,
          ),
        ),
      );
    }

    // Notify callback for in-app handling
    onNotificationReceived?.call(message);
  }

  /// Check if app was opened from notification
  Future<RemoteMessage?> getInitialMessage() async {
    return await _messaging.getInitialMessage();
  }

  /// Route notification to appropriate screen based on type
  Future<void> handleNotificationTap(
    RemoteMessage message, {
    required Function(String route, Map<String, dynamic> args) navigateTo,
  }) async {
    final data = message.data;
    final type = data['type'] ?? '';

    switch (type) {
      case 'ride_match':
      case 'match_found':
        // Navigate to group/ride view when match is found
        navigateTo('/group', {'groupId': data['group_id']});
        break;
      case 'ride_alarm':
      case 'RIDE_ALARM':
        // Navigate to group view for ride alarm
        navigateTo('/group', {'groupId': data['group_id']});
        break;
      case 'chat_message':
      case 'new_message':
        // Navigate to chat screen
        navigateTo('/chat', {'groupId': data['group_id']});
        break;
      case 'rating_pending':
      case 'rating_request':
        // Navigate to ratings
        navigateTo('/ratings', {'groupId': data['group_id']});
        break;
      case 'user_match_update':
        // Generic group update
        navigateTo('/group', {'groupId': data['group_id']});
        break;
      default:
        // Default: go to home
        navigateTo('/', {});
    }
  }

  /// Subscribe to topic
  Future<void> subscribeToTopic(String topic) async {
    await _messaging.subscribeToTopic(topic);
  }

  /// Unsubscribe from topic
  Future<void> unsubscribeFromTopic(String topic) async {
    await _messaging.unsubscribeFromTopic(topic);
  }
}
