/// Group Detail Screen
///
/// Shows group members, readiness confirmation, and navigation to chat.
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/providers/group_provider.dart';
import '../../core/providers/notification_provider.dart';
import '../../core/theme/app_theme.dart';
import 'rating_dialog.dart';

class GroupDetailScreen extends StatefulWidget {
  final String groupId;

  const GroupDetailScreen({super.key, required this.groupId});

  @override
  State<GroupDetailScreen> createState() => _GroupDetailScreenState();
}

class _GroupDetailScreenState extends State<GroupDetailScreen> {
  Timer? _refreshTimer;
  bool _hasShownRatingDialog = false;

  @override
  void initState() {
    super.initState();
    _loadGroup();

    // Start periodic refresh every 10 seconds to check for status changes
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _loadGroup();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadGroup() async {
    await context.read<GroupProvider>().fetchGroup(widget.groupId);

    if (!mounted) return;

    final group = context.read<GroupProvider>().currentGroup;
    final error = context.read<GroupProvider>().error;

    // If group not found or error, navigate back to home immediately
    if (group == null || error != null) {
      _refreshTimer?.cancel();
      if (mounted) {
        // Use pop to return to previous screen (home)
        Navigator.of(context).pop();
      }
      return;
    }

    // Check if ride time has passed and show rating dialog
    _checkAndShowRatingDialog();
  }

  void _checkAndShowRatingDialog() {
    final group = context.read<GroupProvider>().currentGroup;
    if (group == null) return;

    // Show rating dialog only once when status becomes completed
    if (group.status == 'completed' && !_hasShownRatingDialog) {
      _hasShownRatingDialog = true;
      _refreshTimer?.cancel(); // Cancel timer to prevent further fetches

      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          showRatingDialog(context: context, groupId: group.groupId).then((_) {
            // After rating dialog is closed, go back to home
            if (mounted) {
              context.go('/home');
            }
          });
        }
      });
    }
  }

  Future<void> _confirmReadiness() async {
    // Prevent double-taps
    final provider = context.read<GroupProvider>();
    if (provider.isConfirming) return;

    final success = await provider.confirmReadiness(widget.groupId);

    if (!mounted) return;

    if (success) {
      // Refresh notifications to show confirmation notification
      context.read<NotificationProvider>().fetchNotifications();

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Readiness confirmed!')));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to confirm. Please try again.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<GroupProvider>(
      builder: (context, groupProvider, _) {
        final group = groupProvider.currentGroup;
        final isLoading = groupProvider.isLoading;
        final isConfirming = groupProvider.isConfirming;

        return Scaffold(
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/');
                }
              },
            ),
            title: const Text('Ride Group'),
            actions: [
              IconButton(
                icon: const Icon(Icons.chat_outlined),
                onPressed: () => context.push('/groups/${widget.groupId}/chat'),
              ),
            ],
          ),
          body: isLoading
              ? const Center(child: CircularProgressIndicator())
              : _buildContent(group),
          bottomNavigationBar: group != null && !group.myReadinessConfirmed
              ? _buildConfirmButton(isConfirming)
              : null,
        );
      },
    );
  }

  Widget _buildContent(RideGroup? group) {
    if (group == null) {
      return const Center(child: Text('Group not found'));
    }

    return RefreshIndicator(
      onRefresh: _loadGroup,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 100),
        children: [
          Center(child: _buildStatusPill(group)),
          const SizedBox(height: 40),
          _buildRouteSection(group),
          const SizedBox(height: 40),
          _buildMembersSection(group),
          // Show rate button for completed rides
          if (group.status == 'completed') ...[
            const SizedBox(height: 32),
            _buildRateButton(group),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusPill(RideGroup group) {
    final status = group.status;
    final allConfirmed = group.allConfirmed;

    Color color;
    String text;
    IconData icon;

    if (status == 'completed') {
      color = AppColors.primary;
      text = 'Ride Completed - Rate Your Riders!';
      icon = Icons.star;
    } else if (status == 'active') {
      color = AppColors.success;
      text = 'Ride Confirmed';
      icon = Icons.check_circle;
    } else if (allConfirmed) {
      color = AppColors.success;
      text = 'All Ready!';
      icon = Icons.check_circle;
    } else {
      color = AppColors.warning;
      text = 'Waiting for confirmation';
      icon = Icons.hourglass_empty;
    }

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: color.withAlphaValue(0.1),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: color.withAlphaValue(0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 8),
              Text(
                text,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
        if (status == 'confirming') ...[
          const SizedBox(height: 12),
          Text(
            'Confirm your readiness closely',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
        ],
        if (status == 'completed') ...[
          const SizedBox(height: 12),
          Text(
            'Tap on a member to rate them',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ],
    );
  }

  Widget _buildRouteSection(RideGroup group) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'ROUTE',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: AppColors.textTertiary,
                letterSpacing: 1.2,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (group.date != null || group.timeWindowStart != null)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (group.date != null)
                    Text(
                      _formatDate(group.date!),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  if (group.date != null && group.timeWindowStart != null)
                    Text(
                      ' • ',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textTertiary,
                      ),
                    ),
                  if (group.timeWindowStart != null)
                    Text(
                      _formatTime(group.timeWindowStart!),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                ],
              ),
          ],
        ),
        const SizedBox(height: 24),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Column(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primary, width: 2),
                    ),
                  ),
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: AppColors.outline.withAlphaValue(0.5),
                    ),
                  ),
                  Container(
                    width: 12,
                    height: 12,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      group.pickupSummary,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      group.dropSummary,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _formatDate(String date) {
    try {
      final parsedDate = DateTime.parse(date);
      return DateFormat('EEE, MMM d').format(parsedDate);
    } catch (_) {
      return date;
    }
  }

  String _formatTime(String time) {
    try {
      final parts = time.split(':');
      final hour = int.parse(parts[0]);
      final minute = parts[1];
      final period = hour >= 12 ? 'PM' : 'AM';
      final h12 = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
      return '$h12:$minute $period';
    } catch (_) {
      return time;
    }
  }

  Widget _buildMembersSection(RideGroup group) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'MEMBERS (${group.members.length})',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: AppColors.textTertiary,
            letterSpacing: 1.2,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 16),
        ...group.members.map(_buildMemberRow),
      ],
    );
  }

  Widget _buildMemberRow(GroupMember member) {
    final isConfirmed = member.readinessConfirmed;
    final isMe = member.isMe;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: member.role == 'rider'
                ? AppColors.secondary.withAlphaValue(0.1)
                : AppColors.surfaceVariant,
            child: Icon(
              member.role == 'rider' ? Icons.two_wheeler : Icons.person_outline,
              size: 20,
              color: member.role == 'rider'
                  ? AppColors.secondary
                  : AppColors.textSecondary,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      member.displayName,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (isMe)
                      Container(
                        margin: const EdgeInsets.only(left: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withAlphaValue(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'YOU',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                  ],
                ),
                Row(
                  children: [
                    if (member.phone != null && member.phone!.isNotEmpty) ...[
                      Icon(
                        Icons.phone_rounded,
                        size: 14,
                        color: AppColors.textTertiary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        member.phone!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ] else ...[
                      Text(
                        member.role == 'rider' ? 'Rider' : 'Passenger',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textTertiary,
                        ),
                      ),
                    ],
                    const SizedBox(width: 8),
                    if (member.averageRating != null) ...[
                      Icon(
                        Icons.star_rounded,
                        size: 14,
                        color: Colors.amber[600],
                      ),
                      const SizedBox(width: 2),
                      Text(
                        member.averageRating!.toStringAsFixed(1),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.amber[700],
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withAlphaValue(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'NEW',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (isConfirmed)
            const Icon(Icons.check_circle, size: 20, color: AppColors.success)
          else
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.outline),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildConfirmButton(bool isConfirming) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: isConfirming ? null : _confirmReadiness,
            child: isConfirming
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text("I'm Ready!"),
          ),
        ),
      ),
    );
  }

  Widget _buildRateButton(RideGroup group) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.secondary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withAlphaValue(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () =>
              showRatingDialog(context: context, groupId: group.groupId),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.star_rounded, color: Colors.white, size: 28),
                const SizedBox(width: 12),
                Text(
                  'Rate Your Ride Partners',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
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
