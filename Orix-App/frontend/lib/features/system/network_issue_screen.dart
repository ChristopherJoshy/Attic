/// Network Issue Screen
///
/// Displayed when network connectivity is lost.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/providers/connectivity_provider.dart';
import '../../core/theme/app_theme.dart';

class NetworkIssueScreen extends StatefulWidget {
  final VoidCallback? onRetry;

  const NetworkIssueScreen({super.key, this.onRetry});

  @override
  State<NetworkIssueScreen> createState() => _NetworkIssueScreenState();
}

class _NetworkIssueScreenState extends State<NetworkIssueScreen> {
  bool _isRetrying = false;
  ConnectivityProvider? _connectivityProvider;
  Timer? _retryTimer;

  @override
  void initState() {
    super.initState();
    // Listen for connectivity changes to auto-recover
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _listenToConnectivity();
      _startPeriodicRetry();
    });
  }

  void _listenToConnectivity() {
    _connectivityProvider = context.read<ConnectivityProvider>();
    _connectivityProvider?.addListener(_onConnectivityChange);
  }

  /// Start periodic retry every 5 seconds
  void _startPeriodicRetry() {
    _retryTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted && !_isRetrying) {
        _retryConnection();
      }
    });
  }

  void _onConnectivityChange() {
    if (!mounted) return;

    final isOnline = _connectivityProvider?.isOnline ?? false;
    debugPrint('Connectivity changed: isOnline=$isOnline');

    if (isOnline && !_isRetrying) {
      // Connection restored - try to refresh auth immediately
      debugPrint('Connection restored - attempting to reconnect');
      _retryConnection();
    }
  }

  Future<void> _retryConnection() async {
    if (_isRetrying) return;

    setState(() => _isRetrying = true);

    try {
      // First, check if we actually have connectivity
      if (!mounted) return;
      final connectivityProvider = context.read<ConnectivityProvider>();
      await connectivityProvider.refresh();

      if (!connectivityProvider.isOnline) {
        // Still offline - don't try to refresh auth
        if (mounted) {
          setState(() => _isRetrying = false);
        }
        return;
      }

      // We have connectivity - try to refresh auth
      if (!mounted) return;
      final authProvider = context.read<AuthProvider>();
      await authProvider.refreshUser();

      if (mounted) {
        // Success - clean up and navigate
        _retryTimer?.cancel();
        _connectivityProvider?.removeListener(_onConnectivityChange);
        _connectivityProvider?.clearOfflineFlag();

        // Navigate based on auth state
        if (authProvider.isAuthenticated) {
          context.go('/home');
        } else {
          context.go('/');
        }
      }
    } catch (e) {
      // Failed - will retry again in 5 seconds
      debugPrint('Connection retry failed: $e');
      if (mounted) {
        setState(() => _isRetrying = false);
      }
    }
  }

  @override
  void dispose() {
    _retryTimer?.cancel();
    _connectivityProvider?.removeListener(_onConnectivityChange);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Icon container
                Container(
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    color: AppColors.error.withAlphaValue(0.1),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.error.withAlphaValue(0.3),
                      width: 2,
                    ),
                  ),
                  child: const Icon(
                    Icons.wifi_off_rounded,
                    size: 64,
                    color: AppColors.error,
                  ),
                ),

                const SizedBox(height: 32),

                // Title
                Text(
                  'Connection Lost',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),

                const SizedBox(height: 12),

                // Message
                Text(
                  'We couldn\'t connect to the server.\nPlease check your internet connection.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),

                const SizedBox(height: 40),

                // Retry Button
                SizedBox(
                  width: 200,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _isRetrying ? null : _retryConnection,
                    icon: _isRetrying
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.refresh_rounded),
                    label: Text(_isRetrying ? 'Connecting...' : 'Try Again'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.primary.withAlpha(150),
                      disabledForegroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Auto-reconnect hint
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!_isRetrying) ...[
                        SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.textTertiary,
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Text(
                        'Auto-retrying in background...',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textTertiary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
