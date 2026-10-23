import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/ride_provider.dart';
import '../../core/providers/connectivity_provider.dart';
import '../../core/router/app_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_alert_dialog.dart';

class MatchingScreen extends StatefulWidget {
  const MatchingScreen({super.key});

  @override
  State<MatchingScreen> createState() => _MatchingScreenState();
}

class _MatchingScreenState extends State<MatchingScreen>
    with WidgetsBindingObserver, TickerProviderStateMixin {
  Timer? _refreshTimer;
  Timer? _countdownTimer;
  int _timeRemaining = 0;
  bool _isInit = true;
  bool _timersActive = false;

  late AnimationController _pulseController;
  late AnimationController _rotationController;
  late Animation<double> _pulseAnimation;

  static const int _minimumDisplaySeconds = 10;
  late DateTime _screenStartTime;
  bool _hasRedirected = false;

  @override
  void initState() {
    super.initState();
    _screenStartTime = DateTime.now();
    WidgetsBinding.instance.addObserver(this);

    // Pulse animation for the search icon
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.1).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Rotation for the radar effect
    _rotationController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_isInit) {
        _loadStatus();
        _startTimers();
        _isInit = false;
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadStatus(forceRefresh: true);
      _startTimers();
    } else if (state == AppLifecycleState.paused) {
      _refreshTimer?.cancel();
      _countdownTimer?.cancel();
      _timersActive = false;
    }
  }

  void _loadStatus({bool forceRefresh = false}) async {
    final rideProvider = context.read<RideProvider>();

    // Skip fetching if data was just fetched (within last 2 seconds) unless forced
    if (!forceRefresh && rideProvider.lastStatusFetch != null) {
      final timeSinceLastFetch = DateTime.now()
          .difference(rideProvider.lastStatusFetch!)
          .inSeconds;

      if (timeSinceLastFetch < 2 &&
          rideProvider.matchingStatus != null &&
          rideProvider.matchingStatus!.hasActiveRequest) {
        // Use existing fresh data
        if (mounted) {
          setState(() {
            _timeRemaining =
                rideProvider.matchingStatus!.timeRemainingSeconds ?? 0;
          });

          final status = rideProvider.matchingStatus;
          if (status!.pendingConfirmationGroupId != null && !_hasRedirected) {
            final elapsed = DateTime.now()
                .difference(_screenStartTime)
                .inSeconds;
            final remainingWait = _minimumDisplaySeconds - elapsed;

            if (remainingWait > 0) {
              Future.delayed(Duration(seconds: remainingWait), () {
                if (mounted && !_hasRedirected) {
                  _hasRedirected = true;
                  context.go('/groups/${status.pendingConfirmationGroupId}');
                }
              });
            } else {
              _hasRedirected = true;
              context.go('/groups/${status.pendingConfirmationGroupId}');
            }
          }
        }
        return; // Skip API call
      }
    }

    // Fetch fresh status from API
    await rideProvider.fetchMatchingStatus();

    if (mounted) {
      final status = rideProvider.matchingStatus;

      if (status != null && !status.hasActiveRequest) {
        context.go(RoutePaths.home);
        return;
      }

      if (status != null && status.hasActiveRequest) {
        setState(() {
          _timeRemaining = status.timeRemainingSeconds ?? 0;
        });

        if (status.pendingConfirmationGroupId != null && !_hasRedirected) {
          final elapsed = DateTime.now().difference(_screenStartTime).inSeconds;
          final remainingWait = _minimumDisplaySeconds - elapsed;

          if (remainingWait > 0) {
            Future.delayed(Duration(seconds: remainingWait), () {
              if (mounted && !_hasRedirected) {
                _hasRedirected = true;
                context.go('/groups/${status.pendingConfirmationGroupId}');
              }
            });
          } else {
            _hasRedirected = true;
            context.go('/groups/${status.pendingConfirmationGroupId}');
          }
        }
      }
    }
  }

  void _startTimers() {
    if (_timersActive) return;
    _timersActive = true;

    _refreshTimer?.cancel();
    _countdownTimer?.cancel();

    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _loadStatus(forceRefresh: true);
    });

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_timeRemaining > 0 && mounted) {
        setState(() => _timeRemaining--);
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    _refreshTimer?.cancel();
    _pulseController.dispose();
    _rotationController.dispose();
    super.dispose();
  }

  void _showCancelConfirmation() {
    CustomAlertDialog.show(
      context: context,
      title: 'Cancel Ride Search?',
      message:
          'Are you sure you want to stop searching for ride partners? '
          'Your request will be cancelled.',
      primaryButtonText: 'Cancel Request',
      onPrimaryPressed: () async {
        Navigator.of(context).pop();
        final rideProvider = context.read<RideProvider>();
        final status = rideProvider.matchingStatus;
        if (status?.requestId != null) {
          await rideProvider.cancelRideRequest(status!.requestId!);
        }
        if (mounted) {
          context.go(RoutePaths.home);
        }
      },
      secondaryButtonText: 'Keep Searching',
      onSecondaryPressed: () => Navigator.of(context).pop(),
      icon: Icons.cancel_schedule_send_rounded,
      iconColor: AppColors.error,
    );
  }

  String _formatTime(int seconds) {
    final minutes = (seconds / 60).floor();
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final connectivity = context.watch<ConnectivityProvider>();
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Stack(
          children: [
            // Main content - Centered
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Offline warning
                    if (!connectivity.isOnline)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 32),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.error),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.wifi_off,
                              color: AppColors.error,
                              size: 20,
                            ),
                            SizedBox(width: 8),
                            Text(
                              'No internet connection',
                              style: TextStyle(color: AppColors.error),
                            ),
                          ],
                        ),
                      ),

                    // Animated search visualization
                    SizedBox(
                      height: size.width * 0.55,
                      width: size.width * 0.55,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Outer rotating radar circle
                          AnimatedBuilder(
                            animation: _rotationController,
                            builder: (context, child) {
                              return Transform.rotate(
                                angle: _rotationController.value * 2 * math.pi,
                                child: CustomPaint(
                                  size: Size(
                                    size.width * 0.55,
                                    size.width * 0.55,
                                  ),
                                  painter: _RadarPainter(
                                    color: AppColors.primary,
                                  ),
                                ),
                              );
                            },
                          ),

                          // Pulsing rings
                          ..._buildPulsingRings(size.width * 0.55),

                          // Center search icon with pulse
                          ScaleTransition(
                            scale: _pulseAnimation,
                            child: Container(
                              width: 80,
                              height: 80,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.primary,
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withValues(
                                      alpha: 0.4,
                                    ),
                                    blurRadius: 20,
                                    spreadRadius: 5,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.search_rounded,
                                size: 40,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 40),

                    // Title
                    Text(
                      'Finding Your Ride',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                    ),
                    const SizedBox(height: 12),

                    // Subtitle
                    Text(
                      'Matching you with fellow travelers\nheading your way',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.5,
                      ),
                    ),

                    const SizedBox(height: 48),

                    // Timer display
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 32,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.surface, AppColors.surfaceVariant],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.outline, width: 1),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(
                                    alpha: 0.15,
                                  ),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.schedule_rounded,
                                  color: AppColors.primary,
                                  size: 24,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Text(
                                _formatTime(_timeRemaining),
                                style: const TextStyle(
                                  fontSize: 36,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'monospace',
                                  letterSpacing: 2,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Time remaining',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.textTertiary),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Cancel button
                    TextButton.icon(
                      onPressed: _showCancelConfirmation,
                      icon: const Icon(Icons.close_rounded, size: 20),
                      label: const Text('Cancel Search'),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.textTertiary,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildPulsingRings(double maxSize) {
    return List.generate(3, (index) {
      final delay = index * 0.3;
      return AnimatedBuilder(
        animation: _rotationController,
        builder: (context, child) {
          final progress = ((_rotationController.value + delay) % 1.0);
          final scale = 0.4 + (progress * 0.6);
          final opacity = (1.0 - progress) * 0.3;

          return Container(
            width: maxSize * scale,
            height: maxSize * scale,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.primary.withValues(alpha: opacity),
                width: 2,
              ),
            ),
          );
        },
      );
    });
  }
}

class _RadarPainter extends CustomPainter {
  final Color color;

  _RadarPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    // Draw radar sweep
    final sweepPaint = Paint()
      ..shader = SweepGradient(
        colors: [
          color.withValues(alpha: 0.0),
          color.withValues(alpha: 0.3),
          color.withValues(alpha: 0.0),
        ],
        stops: const [0.0, 0.25, 0.5],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius, sweepPaint);

    // Draw dotted circle outline
    final outlinePaint = Paint()
      ..color = color.withValues(alpha: 0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    canvas.drawCircle(center, radius, outlinePaint);
    canvas.drawCircle(center, radius * 0.7, outlinePaint);
    canvas.drawCircle(center, radius * 0.4, outlinePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
