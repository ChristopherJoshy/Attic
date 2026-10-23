/// WebSocket Service
///
/// Manages real-time connection to the backend.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;

import '../config/api_config.dart';
import '../utils/error_helper.dart';

/// WebSocket Service
class WebSocketService {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _pingTimer;

  /// Auto-reconnection support
  String? _lastToken;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;
  Timer? _reconnectTimer;
  bool _intentionalDisconnect = false;

  // Connection status callbacks
  void Function(bool isConnected)? onConnectionChange;

  // Message callbacks
  final Map<String, List<Function(Map<String, dynamic>)>> _listeners = {};

  bool get isConnected => _channel != null;

  /// Connect to WebSocket
  Future<void> connect(String token) async {
    if (_channel != null) return;

    _lastToken = token;
    _intentionalDisconnect = false;

    try {
      final baseUrl = ApiConfig.baseUrl;
      final wsUrl = baseUrl.replaceFirst('http', 'ws');
      final uri = Uri.parse('$wsUrl/ws?token=$token');

      _channel = WebSocketChannel.connect(uri);

      // Wait for connection to be ready (or fail)
      try {
        await _channel!.ready;
      } catch (e) {
        // Connection failed - cleanup and schedule reconnect
        _channel = null;
        _scheduleReconnect();
        return;
      }

      _subscription = _channel!.stream.listen(
        (message) {
          try {
            final data = jsonDecode(message as String);
            _handleMessage(data);
          } catch (e) {
            // Silently ignore parse errors
          }
        },
        onDone: () {
          _cleanup();
        },
        onError: (error) {
          // Silently handle WebSocket errors
          _cleanup();
        },
        cancelOnError: true,
      );

      // Reset reconnect attempts on successful connection
      _reconnectAttempts = 0;
      onConnectionChange?.call(true);
      _startPing();
    } catch (e) {
      // Silently handle connection errors
      _cleanup();
    }
  }

  /// Disconnect intentionally (won't trigger auto-reconnect)
  void disconnect() {
    if (_channel != null) {
      _intentionalDisconnect = true;
      _channel!.sink.close(status.goingAway);
      _cleanup();
    }
  }

  /// Clean up resources
  void _cleanup() {
    _subscription?.cancel();
    _subscription = null;
    _channel = null;
    _pingTimer?.cancel();
    _pingTimer = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    onConnectionChange?.call(false);

    // Attempt auto-reconnect if not intentional disconnect
    if (!_intentionalDisconnect) {
      _scheduleReconnect();
    }
  }

  /// Schedule auto-reconnection with exponential backoff
  /// Implements exponential backoff: 2s, 4s, 8s, 16s, 30s (max)
  void _scheduleReconnect() {
    if (_lastToken == null || _reconnectAttempts >= _maxReconnectAttempts) {
      return;
    }

    // Exponential backoff: 2^attempt, capped at 30s
    final delaySeconds = math.min(30, math.pow(2, _reconnectAttempts).toInt());
    final delay = Duration(seconds: delaySeconds);
    _reconnectAttempts++;

    // Don't schedule if we're already scheduled
    if (_reconnectTimer?.isActive == true) {
      return;
    }

    _reconnectTimer = Timer(delay, () {
      if (_lastToken != null && _channel == null && !_intentionalDisconnect) {
        connect(_lastToken!);
      }
    });
  }

  /// Reset reconnect attempts (call after successful operations)
  void resetReconnectAttempts() {
    _reconnectAttempts = 0;
  }

  /// Start ping timer to keep connection alive
  void _startPing() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (_channel != null) {
        send({'type': 'ping'});
      }
    });
  }

  /// Send message
  void send(Map<String, dynamic> data) {
    if (_channel != null) {
      _channel!.sink.add(jsonEncode(data));
    }
  }

  /// Handle incoming message
  void _handleMessage(Map<String, dynamic> data) {
    // Log connected status
    if (data['type'] == 'connected') {}

    // Notify listeners
    final type = data['type'] as String?;
    if (type != null && _listeners.containsKey(type)) {
      for (final listener in _listeners[type]!) {
        try {
          listener(data);
        } catch (e) {
          ErrorHelper.logError(e, null, 'WebSocket listener callback');
        }
      }
    }
  }

  /// Add message listener
  void on(String type, Function(Map<String, dynamic>) callback) {
    if (!_listeners.containsKey(type)) {
      _listeners[type] = [];
    }
    _listeners[type]!.add(callback);
  }

  /// Remove message listener
  void off(String type, Function(Map<String, dynamic>) callback) {
    if (_listeners.containsKey(type)) {
      _listeners[type]!.remove(callback);
    }
  }
}
