/// Home Screen
///
/// Main dashboard with ride status and quick actions.
/// Optimized for low-RAM devices with selective rebuilds.
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/providers/ride_provider.dart';
import '../../core/providers/notification_provider.dart';
import '../../core/providers/user_provider.dart';
import '../../core/providers/group_provider.dart';
import '../../core/providers/connectivity_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
// import '../../core/widgets/banner_ad_widget.dart';
import '../../core/services/app_version_service.dart';
import '../../core/widgets/custom_alert_dialog.dart';
import '../../core/utils/error_helper.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/services/notification_service.dart';
import '../groups/rating_dialog.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  bool _isCancelling = false;
  String? _cachedGreeting;
  int? _cachedHour;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _loadData();
        _setupNotificationHandling();
        _startPolling();
      }
    });
  }

  void _setupNotificationHandling() {
    final notificationService = context.read<NotificationService>();

    // 1. Handle background -> foreground (app opened from notification)
    notificationService.onMessageOpenedApp.listen((message) {
      if (!mounted) return;
      _handleNotification(message);
    });

    // 2. Handle foreground messages
    notificationService.onNotificationReceived = (message) {
      if (!mounted) return;
      // Refresh notifications list
      context.read<NotificationProvider>().fetchNotifications();
      // Handle action
      _handleNotification(message);
    };

    // 3. Handle initial message (app launched from terminated)
    notificationService.getInitialMessage().then((message) {
      if (message != null && mounted) {
        _handleNotification(message);
      }
    });
  }

  void _handleNotification(dynamic message) {
    if (!mounted) return;

    // Abstract the data access since type isn't available here
    final data = message.data as Map<String, dynamic>;
    final type = data['type'] as String?;

    if (type == 'ride_completed') {
      final groupId = data['group_id'] as String?;
      if (groupId != null) {
        showRatingDialog(context: context, groupId: groupId);
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollingTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    // Start dynamic polling based on app state
    // Reduce frequency when waiting for match to conserve battery
    _pollingTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) {
        final rideProvider = context.read<RideProvider>();
        final groupProvider = context.read<GroupProvider>();

        // Check current state to determine polling frequency
        final matchingStatus = rideProvider.matchingStatus;
        final hasActiveGroup = groupProvider.hasActiveGroup;

        // Stop polling if ride is completed or no active request
        if (matchingStatus == null && !hasActiveGroup) {
          _pollingTimer?.cancel();
          return;
        }

        // Fast poll (10s) if waiting for match
        if (matchingStatus?.status == 'matching' ||
            matchingStatus?.status == 'pending') {
          rideProvider.fetchMatchingStatus();
          groupProvider.fetchActiveGroups();
        }
        // Slower poll (30s) if already matched
        else if (matchingStatus?.status == 'matched') {
          // Only poll every 3rd tick (30 seconds)
          if (DateTime.now().millisecondsSinceEpoch % 3 == 0) {
            rideProvider.fetchMatchingStatus();
            groupProvider.fetchActiveGroups();
          }
        }
        // Normal poll (10s) for active group
        else if (hasActiveGroup) {
          groupProvider.fetchActiveGroups();
        }
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadData();
      if (_pollingTimer?.isActive != true) {
        _startPolling();
      }
    } else if (state == AppLifecycleState.paused) {
      // Pause polling when app goes to background
      _pollingTimer?.cancel();
    }
  }

  void _loadData() {
    if (!mounted) return;
    // Fetch critical data immediately
    context.read<RideProvider>().fetchMatchingStatus();
    context.read<UserProvider>().fetchRiderInfo();
    context.read<NotificationProvider>().fetchNotifications();
    context.read<GroupProvider>().fetchActiveGroups();

    // Defer non-critical calls to 300ms
    Future.delayed(const Duration(milliseconds: 300), () {
      if (mounted) _checkAppUpdate();
    });
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) _checkPendingRatings();
    });
  }

  Future<void> _checkPendingRatings() async {
    try {
      final pendingGroups = await context
          .read<GroupProvider>()
          .checkPendingRatings();
      if (pendingGroups.isNotEmpty && mounted) {
        showRatingDialog(context: context, groupId: pendingGroups.first);
      }
    } catch (_) {}
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    // Cache greeting to avoid recalculation on every build
    if (_cachedHour == hour && _cachedGreeting != null) {
      return _cachedGreeting!;
    }
    _cachedHour = hour;
    if (hour < 12) {
      _cachedGreeting = 'Good morning';
    } else if (hour < 17) {
      _cachedGreeting = 'Good afternoon';
    } else {
      _cachedGreeting = 'Good evening';
    }
    return _cachedGreeting!;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(),
      body: RefreshIndicator(
        onRefresh: () async => _loadData(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RepaintBoundary(
                child: _GreetingSection(greeting: _getGreeting()),
              ),
              const SizedBox(height: 24),
              const RepaintBoundary(child: _QuickActionsSection()),
              const SizedBox(height: 24),
              RepaintBoundary(
                child: _RideStatusSection(
                  isCancelling: _isCancelling,
                  onCancellingChanged: (val) =>
                      setState(() => _isCancelling = val),
                ),
              ),
              const SizedBox(height: 24),
              const RepaintBoundary(child: _RiderStatusSection()),
              const SizedBox(height: 80),
            ],
          ),
        ),
      ),
      // bottomNavigationBar: const BannerAdWidget(), // DISABLED: Crashing on Emulator
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      title: const Text('ORIX'),
      actions: [
        IconButton(
          icon: Selector<NotificationProvider, int>(
            selector: (_, p) => p.unreadCount,
            builder: (context, unreadCount, child) {
              return Badge(
                isLabelVisible: unreadCount > 0,
                label: Text('$unreadCount'),
                child: const Icon(Icons.notifications_outlined),
              );
            },
          ),
          onPressed: () => context.push(RoutePaths.notifications),
        ),
        IconButton(
          icon: const Icon(Icons.person_outline),
          onPressed: () => context.push(RoutePaths.profile),
        ),
      ],
    );
  }

  Future<void> _checkAppUpdate() async {
    if (!mounted) return;
    try {
      final appVersionService = context.read<AppVersionService>();
      final updateInfo = await appVersionService.shouldShowUpdatePopup();

      if (updateInfo != null && mounted) {
        _showUpdateDialog(updateInfo);
      }
    } catch (e) {
      ErrorHelper.logError(e, null, 'App update check');
    }
  }

  Future<void> _showUpdateDialog(AppVersionInfo info) async {
    if (!mounted) return;

    await CustomAlertDialog.show<bool>(
      context: context,
      title: info.updateTitle ?? 'Update Available',
      message:
          'A new version (${info.currentVersion}) is available.\n\n${(info.updateNotes ?? "Please update to continue using the app.").replaceAll(r'\n', '\n')}',
      primaryButtonText: 'Update Now',
      onPrimaryPressed: () {
        final url = info.storeUrl;
        if (url.isNotEmpty) {
          launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        }
      },
      secondaryButtonText: info.updateRequired ? null : 'Later',
      onSecondaryPressed: info.updateRequired
          ? null
          : () {
              context.read<AppVersionService>().markUpdateDetailsSeen(
                info.currentVersion,
              );
              Navigator.pop(context);
            },
      icon: Icons.system_update_rounded,
      iconColor: AppColors.primary,
      barrierDismissible: !info.updateRequired,
    );
  }
}

/// Greeting section - isolated from main rebuild cycle
class _GreetingSection extends StatelessWidget {
  final String greeting;
  const _GreetingSection({required this.greeting});

  static String _toTitleCase(String text) {
    return text
        .split(' ')
        .map((word) {
          if (word.isEmpty) return word;
          return word[0].toUpperCase() + word.substring(1).toLowerCase();
        })
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    return Selector<AuthProvider, String?>(
      selector: (_, auth) => auth.user?.displayName,
      builder: (context, displayName, _) {
        final name = displayName != null ? _toTitleCase(displayName) : 'User';
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              greeting,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w400,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              name,
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
          ],
        );
      },
    );
  }
}

/// Quick actions - only rebuilds when rider or request status changes
class _QuickActionsSection extends StatelessWidget {
  const _QuickActionsSection();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionCard(
            icon: Icons.local_taxi,
            label: 'Find Ride',
            color: AppColors.primary,
            iconColor: Colors.white,
            textColor: Colors.white,
            onTap: () => _handleFindRide(context),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _ActionCard(
            icon: Icons.two_wheeler,
            label: 'Give Ride',
            color: Colors.white,
            textColor: Colors.black,
            iconColor: Colors.black,
            onTap: () => _handleGiveRide(context),
          ),
        ),
      ],
    );
  }

  void _handleFindRide(BuildContext context) {
    final userProvider = context.read<UserProvider>();
    final rideProvider = context.read<RideProvider>();

    if (userProvider.isRider) {
      _showErrorDialog(
        context,
        'Rider Mode Active',
        'You are currently offering a ride. Please disable Rider Mode to find a ride as a passenger.',
      );
      return;
    }

    if (rideProvider.matchingStatus?.hasActiveRequest ?? false) {
      _showErrorDialog(
        context,
        'Active Request',
        'You already have an active ride request. Please cancel it before creating a new one.',
      );
      return;
    }

    context.push(RoutePaths.createRide);
  }

  Future<void> _handleGiveRide(BuildContext context) async {
    final userProvider = context.read<UserProvider>();
    final rideProvider = context.read<RideProvider>();

    // Check if user has an active passenger request
    if (rideProvider.matchingStatus?.hasActiveRequest ?? false) {
      final confirm = await CustomAlertDialog.show<bool>(
        context: context,
        title: 'Switch to Driver Mode?',
        message:
            'You have an active passenger request. Would you like to cancel it and offer a ride instead?',
        primaryButtonText: 'Switch',
        onPrimaryPressed: () => Navigator.pop(context, true),
        secondaryButtonText: 'Keep Request',
        onSecondaryPressed: () => Navigator.pop(context, false),
        icon: Icons.swap_horiz,
        iconColor: AppColors.primary,
      );

      if (confirm == true) {
        if (!context.mounted) return;

        final requestId = rideProvider.matchingStatus?.requestId;
        if (requestId != null) {
          // Show loading
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Cancelling request...')),
            );
          }

          final success = await rideProvider.cancelRideRequest(requestId);

          if (!success) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    rideProvider.error ?? 'Failed to cancel request',
                  ),
                ),
              );
            }
            return;
          }
        }

        if (context.mounted) {
          context.push(RoutePaths.riderSetup);
        }
      }
      return;
    }

    if (userProvider.isRider) {
      CustomAlertDialog.show(
        context: context,
        title: 'Already Offering Ride',
        message:
            'You are already listed as a rider. Disable your current ride to create a new one.',
        primaryButtonText: 'OK',
        onPrimaryPressed: () => Navigator.pop(context),
        icon: Icons.info_outline,
        iconColor: AppColors.primary,
      );
      return;
    }

    context.push(RoutePaths.riderSetup);
  }

  void _showErrorDialog(BuildContext context, String title, String message) {
    CustomAlertDialog.show(
      context: context,
      title: title,
      message: message,
      primaryButtonText: 'OK',
      onPrimaryPressed: () => Navigator.pop(context),
      icon: Icons.info_outline,
      iconColor: AppColors.primary,
    );
  }
}

/// Ride status section - only rebuilds when ride provider changes
class _RideStatusSection extends StatelessWidget {
  final bool isCancelling;
  final ValueChanged<bool> onCancellingChanged;

  const _RideStatusSection({
    required this.isCancelling,
    required this.onCancellingChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Selector<ConnectivityProvider, bool>(
      selector: (_, p) => p.isOnline,
      builder: (context, isOnline, _) {
        if (!isOnline) {
          return _buildOfflineCard(context);
        }
        return Selector<RideProvider, (bool, MatchingStatus?)>(
          selector: (_, ride) => (ride.isLoading, ride.matchingStatus),
          builder: (context, data, _) {
            final (isLoading, status) = data;
            if (isLoading) {
              return _buildLoadingCard(context);
            }
            if (status == null || !status.hasActiveRequest) {
              return _buildNoRideCard(context);
            }

            // Detect stale data: matched/confirmed but no group ID
            final isMatched =
                status.status?.toLowerCase() == 'matched' ||
                status.myReadinessConfirmed;
            if (isMatched && status.pendingConfirmationGroupId == null) {
              // Stale data detected - auto-refresh and show nothing
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (context.mounted) {
                  context.read<RideProvider>().clearMatchingStatus();
                  context.read<RideProvider>().fetchMatchingStatus();
                }
              });
              return _buildNoRideCard(context);
            }

            return _buildActiveRideCard(context, status);
          },
        );
      },
    );
  }

  Widget _buildOfflineCard(BuildContext context) {
    return _StatusCard(
      title: 'Ride Status',
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(
              Icons.wifi_off_outlined,
              size: 40,
              color: Colors.white.withAlpha(80),
            ),
            const SizedBox(height: 14),
            const Text(
              'No internet connection',
              style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Check your network and try again',
              style: TextStyle(
                color: Colors.white.withAlpha(120),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 18),
            OutlinedButton(
              onPressed: () => context.push(RoutePaths.networkIssue),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingCard(BuildContext context) {
    return const _StatusCard(
      title: 'Ride Status',
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }

  Widget _buildNoRideCard(BuildContext context) {
    return _StatusCard(
      title: 'Ride Status',
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
        child: Column(
          children: [
            Icon(
              Icons.directions_car_outlined,
              size: 36,
              color: Colors.white.withAlpha(60),
            ),
            const SizedBox(height: 16),
            const Text(
              'No active ride',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Start a ride request to get matched with students nearby',
              style: TextStyle(
                color: Colors.white.withAlpha(100),
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveRideCard(BuildContext context, MatchingStatus status) {
    final isConfirmed = status.myReadinessConfirmed;
    final isCompleted = status.status?.toLowerCase() == 'completed';
    final isExpired = status.status?.toLowerCase() == 'expired';

    // Detect solo group (e.g., others left) so we can allow finishing the ride
    final groupProvider = Provider.of<GroupProvider>(context, listen: false);
    RideGroup? soloGroup;
    for (final g in groupProvider.activeGroups) {
      if (g.groupId == status.pendingConfirmationGroupId ||
          g.groupId == status.requestId) {
        soloGroup = g;
        break;
      }
    }
    final isSoloGroup = soloGroup != null && soloGroup.members.length <= 1;
    final finishGroupId =
        status.pendingConfirmationGroupId ?? soloGroup?.groupId;

    // If expired (and not completed - which we handle visibly), user should see nothing or "No active ride".
    // But backend sets status to "expired" eventually.
    // If backend sends "expired" status, let's treat it as no active ride (unless we want to show a history item?)
    // For now, if "expired", the RideStatusSection logic handles it?
    // Actually RideStatusSection shows _buildActiveRideCard if status != null.
    // So we should return empty here or handle it in parent.
    // Parent checks !status.hasActiveRequest. Backend sends hasActiveRequest=true for everything including expired if we return it.
    // So let's handle "expired" by showing "Expired" state or just "No Active Ride".
    // If we want it to vanish, parent should handle it.
    // Ideally, for "expired", we want the user to know it's gone? Or just disappear.
    // User requested "fully removed". So just being gone is good.
    // But if we are here, backend returned it.

    // Logic: If status is 'active' or 'completed', show card. If 'expired', maybe show nothing or text.

    if (isExpired) {
      // Ideally this shouldn't happen if we filter it, but if we do trigger it:
      return _buildNoRideCard(context);
    }

    final title = isCompleted
        ? 'Ride Completed'
        : (isConfirmed ? 'Active Ride Group' : 'Active Ride Request');

    final titleColor = isCompleted ? AppColors.success : null;

    return _StatusCard(
      title: title,
      titleColor: titleColor,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!status.myReadinessConfirmed && !isCompleted)
              Row(
                children: [
                  _StatusBadge(
                    status: status.status ?? 'pending',
                    isConfirmed: status.myReadinessConfirmed,
                  ),
                  const Spacer(),
                  Text(
                    _formatTimeRemaining(
                      status.timeRemainingSeconds ?? 0,
                      status.status,
                    ),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            if (isCompleted)
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.success.withAlpha(25),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.success,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          'Trip Finished',
                          style: TextStyle(
                            color: AppColors.success,
                            fontWeight: FontWeight.w500,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

            const SizedBox(height: 16),
            _RouteInfo(
              from: status.pickupLabel ?? 'Unknown',
              to: status.dropLabel ?? 'Unknown',
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                if (isCompleted || isSoloGroup)
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () {
                        // Show rating dialog (which handles solo rides automatically)
                        if (finishGroupId != null) {
                          showRatingDialog(
                            context: context,
                            groupId: finishGroupId,
                          );
                        }
                      },
                      icon: const Icon(Icons.check_circle),
                      label: const Text('Finish Ride'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  )
                else ...[
                  OutlinedButton(
                    onPressed: () async {
                      final isMatched =
                          status.status?.toLowerCase() == 'matched' ||
                          status.myReadinessConfirmed;

                      // If matched but no group ID, this is stale data - refresh
                      if (isMatched &&
                          status.pendingConfirmationGroupId == null) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Refreshing ride status...'),
                              duration: Duration(seconds: 1),
                            ),
                          );
                          context.read<RideProvider>().clearMatchingStatus();
                          await context
                              .read<RideProvider>()
                              .fetchMatchingStatus();
                        }
                        return;
                      }

                      if (isMatched &&
                          status.pendingConfirmationGroupId != null) {
                        // Validate group still exists before navigating
                        try {
                          final groupProvider = context.read<GroupProvider>();
                          await groupProvider.fetchGroup(
                            status.pendingConfirmationGroupId!,
                          );

                          if (!context.mounted) return;

                          final group = groupProvider.currentGroup;
                          if (group != null) {
                            // Group exists, navigate to it
                            await context.push(
                              '/groups/${status.pendingConfirmationGroupId}',
                            );
                          } else {
                            // Group was deleted, clear the stale data
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'This group is no longer available',
                                  ),
                                  backgroundColor: AppColors.error,
                                  duration: Duration(seconds: 2),
                                ),
                              );
                              context
                                  .read<RideProvider>()
                                  .clearMatchingStatus();
                              await context
                                  .read<RideProvider>()
                                  .fetchMatchingStatus();
                            }
                            return; // Don't navigate to matching screen
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Could not load group'),
                                backgroundColor: AppColors.error,
                              ),
                            );
                          }
                          return; // Don't navigate on error
                        }
                      } else if (!isMatched) {
                        // Only navigate to matching screen if explicitly not matched
                        await context.push(RoutePaths.matching);
                      }

                      if (context.mounted) {
                        context.read<RideProvider>().fetchMatchingStatus();
                      }
                    },
                    child: Text(
                      (status.status?.toLowerCase() == 'matched' ||
                              status.myReadinessConfirmed)
                          ? 'View Group'
                          : 'View Status',
                    ),
                  ),
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: isCancelling
                        ? null
                        : () => _handleCancel(context, status),
                    child: isCancelling
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.error,
                            ),
                          )
                        : Text(
                            (status.status?.toLowerCase() == 'matched' ||
                                    status.myReadinessConfirmed)
                                ? 'Exit'
                                : 'Cancel',
                            style: const TextStyle(color: AppColors.error),
                          ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleCancel(
    BuildContext context,
    MatchingStatus status,
  ) async {
    final rideProvider = context.read<RideProvider>();
    final isMatched =
        status.status?.toLowerCase() == 'matched' ||
        status.myReadinessConfirmed;

    final confirm = await CustomAlertDialog.show<bool>(
      context: context,
      title: isMatched ? 'Exit Group?' : 'Cancel Request?',
      message: isMatched
          ? 'Are you sure you want to leave this group?'
          : 'Are you sure you want to cancel your ride request?',
      primaryButtonText: 'Yes, Cancel',
      onPrimaryPressed: () => Navigator.pop(context, true),
      secondaryButtonText: 'No, Keep',
      onSecondaryPressed: () => Navigator.pop(context, false),
      icon: isMatched ? Icons.exit_to_app : Icons.cancel_outlined,
      iconColor: AppColors.error,
    );

    if (confirm == true && context.mounted) {
      onCancellingChanged(true);
      await rideProvider.cancelRideRequest(status.requestId!);
      if (context.mounted) {
        onCancellingChanged(false);
        context.read<GroupProvider>().fetchActiveGroups();
      }
    }
  }

  static String _formatTimeRemaining(int seconds, String? status) {
    if (status?.toLowerCase() == 'matched') return 'Ready';
    if (seconds <= 0) return 'Expired';

    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;

    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }
}

/// Rider status section - isolated rebuild
class _RiderStatusSection extends StatelessWidget {
  const _RiderStatusSection();

  @override
  Widget build(BuildContext context) {
    return Selector<UserProvider, (bool, RiderInfo?)>(
      selector: (_, p) => (p.isRider, p.riderInfo),
      builder: (context, data, _) {
        final (isRider, riderInfo) = data;
        if (!isRider || riderInfo == null) {
          return const SizedBox.shrink();
        }

        return _StatusCard(
          title: 'Rider Mode Active',
          titleColor: AppColors.secondary,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.secondary.withAlphaValue(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.two_wheeler,
                            size: 16,
                            color: AppColors.secondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            riderInfo.vehicleType,
                            style: const TextStyle(
                              color: AppColors.secondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${riderInfo.seats} seats',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _RouteInfo(from: riderInfo.fromLabel, to: riderInfo.toLabel),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text(
                      'Expires in ${_formatTime(riderInfo.timeRemainingSeconds)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () =>
                          context.read<UserProvider>().disableRiderMode(),
                      child: const Text(
                        'Disable',
                        style: TextStyle(color: AppColors.error),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  static String _formatTime(int seconds) {
    if (seconds <= 0) return 'Expired';
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    if (hours > 0) return '${hours}h ${minutes}m';
    return '${minutes}m';
  }
}

/// Reusable status card
class _StatusCard extends StatelessWidget {
  final String title;
  final Widget child;
  final Color? titleColor;

  const _StatusCard({
    required this.title,
    required this.child,
    this.titleColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(15),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: titleColor,
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// Status badge widget
class _StatusBadge extends StatelessWidget {
  final String status;
  final bool isConfirmed;

  const _StatusBadge({required this.status, this.isConfirmed = false});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;
    final effectiveStatus = isConfirmed ? 'confirmed' : status;

    switch (effectiveStatus.toLowerCase()) {
      case 'matching':
        color = AppColors.warning;
        label = 'Matching...';
        break;
      case 'matched':
        color = AppColors.success;
        label = 'Match Found!';
        break;
      case 'confirmed':
        color = AppColors.success;
        label = 'Confirmed';
        break;
      case 'pending':
      default:
        color = AppColors.primary;
        label = 'Searching';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlphaValue(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w500,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

/// Route info display
class _RouteInfo extends StatelessWidget {
  final String from;
  final String to;

  const _RouteInfo({required this.from, required this.to});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Column(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
              ),
            ),
            Container(width: 2, height: 24, color: AppColors.outline),
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                color: AppColors.error,
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                from,
                style: Theme.of(context).textTheme.bodyMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 16),
              Text(
                to,
                style: Theme.of(context).textTheme.bodyMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Action card for quick actions
class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color? textColor;
  final Color? iconColor;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.label,
    required this.color,
    this.textColor,
    this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: iconColor ?? Colors.white, size: 32),
            const SizedBox(height: 12),
            Text(
              label,
              style: TextStyle(
                color: textColor ?? Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
