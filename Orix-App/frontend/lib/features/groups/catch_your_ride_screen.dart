/// Catch Your Ride Alarm Screen
///
/// Full-screen alarm notification shown when it's time to catch the ride.
/// Displays even when app is in background and includes "I Am Here" button.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:orix/core/providers/group_provider.dart';
import 'package:orix/core/services/api_service.dart';

/// Show the catch your ride alarm screen
Future<void> showCatchYourRideAlarm({
  required BuildContext context,
  required String groupId,
  required String rideTime,
  required String pickupSummary,
}) {
  return Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute<void>(
      fullscreenDialog: true,
      builder: (BuildContext context) {
        return _CatchYourRideAlarm(
          groupId: groupId,
          rideTime: rideTime,
          pickupSummary: pickupSummary,
        );
      },
    ),
  );
}

/// Full-screen alarm display for catching a ride
class _CatchYourRideAlarm extends StatefulWidget {
  final String groupId;
  final String rideTime;
  final String pickupSummary;

  const _CatchYourRideAlarm({
    required this.groupId,
    required this.rideTime,
    required this.pickupSummary,
  });

  @override
  State<_CatchYourRideAlarm> createState() => _CatchYourRideAlarmState();
}

class _CatchYourRideAlarmState extends State<_CatchYourRideAlarm>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  bool _isSubmitting = false;
  String? _errorMessage;
  Timer? _alarmTimer;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  @override
  void initState() {
    super.initState();

    // Create pulsing animation
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat();

    // Keep screen on and hide system UI for full-screen alarm experience
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    // Set preferred orientations to portrait for alarm
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);

    // Play alarm sound and vibration
    _playAlarmEffects();

    debugPrint('[CatchYourRideAlarm] Alarm shown for group: ${widget.groupId}');
  }

  @override
  void dispose() {
    _stopAlarmEffects();
    _pulseController.dispose();
    // Restore normal system UI when alarm is dismissed
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    // Restore all orientations
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    super.dispose();
  }

  Future<void> _playAlarmEffects() async {
    // Start a repeating alarm (sound + haptics) until user acknowledges.
    _alarmTimer?.cancel();

    Future<void> triggerOnce() async {
      try {
        // Use the available alert sound (SystemSoundType.alarm is not on all platforms)
        await SystemSound.play(SystemSoundType.alert);
        await HapticFeedback.heavyImpact();
      } catch (_) {
        // Ignore platform-specific failures
      }
    }

    // Fire immediately, then keep repeating
    await triggerOnce();
    _alarmTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      if (!mounted) return;
      await triggerOnce();
    });
  }

  void _stopAlarmEffects() {
    _alarmTimer?.cancel();
    _alarmTimer = null;
  }

  Future<void> _markAsHere() async {
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final api = context.read<ApiService>();
      final response = await api.post<Map<String, dynamic>>(
        '/groups/${widget.groupId}/mark-here',
      );

      if (!mounted) return;

      if (response.success) {
        // Stop the alarm loop and clear the notification
        _stopAlarmEffects();
        await _localNotifications.cancel(999);

        if (!mounted) return;

        // Show success feedback
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              '✓ Marked as here! Your ride group is now completed.',
            ),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );

        debugPrint(
          '[CatchYourRideAlarm] User marked as here for group: ${widget.groupId}',
        );

        // Close the alarm and navigate to group detail to refresh and show rating
        Navigator.of(context).pop();

        if (!mounted) return;

        // Refresh group provider to fetch updated status (completed)
        await context.read<GroupProvider>().fetchGroup(widget.groupId);

        // Navigate to group detail where rating dialog will be shown
        if (mounted) {
          context.push('/groups/${widget.groupId}');
        }
      } else {
        setState(() {
          _errorMessage = response.error ?? 'Failed to mark as here';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error: ${e.toString()}';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isMobile = MediaQuery.of(context).size.width < 600;

    return PopScope(
      canPop: false, // Prevent back button from dismissing alarm
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Top spacing
              const SizedBox(height: 40),

              // Main content
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Pulsing alarm icon
                    ScaleTransition(
                      scale: Tween<double>(begin: 0.8, end: 1.0).animate(
                        CurvedAnimation(
                          parent: _pulseController,
                          curve: Curves.easeInOut,
                        ),
                      ),
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.alarm, size: 60, color: Colors.red),
                      ),
                    ),
                    const SizedBox(height: 40),

                    // Title
                    Text(
                      '🔔 Catch Your Ride!',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: isMobile ? 28 : 32,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Ride time
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.orange.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.orange, width: 2),
                      ),
                      child: Column(
                        children: [
                          Text('Ride Time', style: theme.textTheme.labelSmall),
                          const SizedBox(height: 4),
                          Text(
                            widget.rideTime,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: Colors.orange,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Pickup location
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 24),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.blue.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.location_on,
                                size: 20,
                                color: Colors.blue,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Pickup Location',
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: Colors.blue,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            widget.pickupSummary,
                            style: theme.textTheme.bodyLarge?.copyWith(
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Error message if any
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 24),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.1),
                          border: Border.all(color: Colors.red),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(color: Colors.red, fontSize: 14),
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              // Bottom buttons
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    // Main "I Am Here" button
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton.icon(
                        onPressed: _isSubmitting ? null : _markAsHere,
                        icon: _isSubmitting
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    theme.colorScheme.onPrimary,
                                  ),
                                ),
                              )
                            : const Icon(Icons.check_circle),
                        label: Text(
                          _isSubmitting ? 'Marking as here...' : 'I Am Here',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Dismiss button (disabled - must use "I Am Here")
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: OutlinedButton(
                        onPressed: null, // Disabled
                        style: OutlinedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text('Dismiss'),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Tap "I Am Here" to mark your arrival and stop the alarm',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.red.shade700,
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
    );
  }
}
