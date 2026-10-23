/// Connectivity Provider
///
/// Monitors network connectivity status app-wide.
library;

import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Connectivity provider for monitoring network status
class ConnectivityProvider extends ChangeNotifier {
  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  bool _isOnline = true;
  bool _wasOffline = false;

  ConnectivityProvider() {
    _init();
  }

  /// Whether device is currently online
  bool get isOnline => _isOnline;

  /// Whether the device was recently offline (for showing recovery UI)
  bool get wasOffline => _wasOffline;

  void _init() {
    // Check initial status
    _checkStatus();

    // Listen for changes
    _subscription = _connectivity.onConnectivityChanged.listen(_onStatusChange);
  }

  Future<void> _checkStatus() async {
    final results = await _connectivity.checkConnectivity();
    _updateStatus(results);
  }

  void _onStatusChange(List<ConnectivityResult> results) {
    _updateStatus(results);
  }

  void _updateStatus(List<ConnectivityResult> results) {
    final wasOnline = _isOnline;

    // Consider online if any connectivity type is available (except none)
    _isOnline =
        results.isNotEmpty &&
        !results.every((r) => r == ConnectivityResult.none);

    // Track if we went offline
    if (!_isOnline && wasOnline) {
      _wasOffline = true;
    }

    // Notify only if status actually changed
    if (_isOnline != wasOnline) {
      notifyListeners();
    }
  }

  /// Clear the "was offline" flag after recovery handling
  void clearOfflineFlag() {
    _wasOffline = false;
  }

  /// Force a status check and notify
  Future<void> refresh() async {
    await _checkStatus();
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
