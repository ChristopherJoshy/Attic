import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class ActivityLogger {
  static Map<String, dynamic> Function()? getUserInfo;
  static Future<String?> Function()? getAuthToken;

  static void logActivity({
    required String actionType,
    required String screen,
    String? target,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final url = Uri.parse('${ApiConfig.baseUrl}/api/v1/logs/activity');
      final headers = <String, String>{'Content-Type': 'application/json'};

      if (getAuthToken != null) {
        try {
          final token = await getAuthToken!();
          if (token != null) {
            headers['Authorization'] = 'Bearer $token';
          }
        } catch (_) {}
      }

      final body = jsonEncode({
        'action_type': actionType,
        'screen': screen,
        'target': target,
        'metadata': metadata,
      });

      http.post(url, headers: headers, body: body).catchError((_) {
        return http.Response('', 500);
      });
    } catch (_) {}
  }

  static void logNavigation(String fromScreen, String toScreen) {
    logActivity(
      actionType: 'navigation',
      screen: toScreen,
      target: fromScreen,
      metadata: {'from': fromScreen, 'to': toScreen},
    );
  }

  static void logButtonTap(String screen, String buttonId) {
    logActivity(actionType: 'button_tap', screen: screen, target: buttonId);
  }

  static void logFeatureUsage(String screen, String feature) {
    logActivity(actionType: 'feature_usage', screen: screen, target: feature);
  }

  static void logSearch(String screen, String query) {
    logActivity(actionType: 'search', screen: screen, target: query);
  }

  static void logFormSubmit(
    String screen,
    String formId, {
    bool success = true,
  }) {
    logActivity(
      actionType: 'form_submit',
      screen: screen,
      target: formId,
      metadata: {'success': success},
    );
  }

  static void logScrollEvent(String screen, String direction) {
    logActivity(actionType: 'scroll', screen: screen, target: direction);
  }

  static void logGesture(String screen, String gestureType, {String? target}) {
    logActivity(
      actionType: 'gesture',
      screen: screen,
      target: target ?? gestureType,
      metadata: {'gesture': gestureType},
    );
  }

  static void logNotificationInteraction(
    String notificationId,
    String action,
  ) async {
    try {
      final url = Uri.parse(
        '${ApiConfig.baseUrl}/api/v1/logs/notification-received',
      );
      final headers = <String, String>{'Content-Type': 'application/json'};

      if (getAuthToken != null) {
        try {
          final token = await getAuthToken!();
          if (token != null) {
            headers['Authorization'] = 'Bearer $token';
          }
        } catch (_) {}
      }

      final body = jsonEncode({
        'notification_id': notificationId,
        'action': action,
      });

      http.post(url, headers: headers, body: body).catchError((_) {
        return http.Response('', 500);
      });
    } catch (_) {}
  }
}
