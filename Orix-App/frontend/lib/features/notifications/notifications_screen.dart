/// Notifications Screen
///
/// In-app notification center.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/time_utils.dart';
import '../../core/widgets/custom_alert_dialog.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _isMarkingAll = false;
  bool _isClearing = false;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    await context.read<NotificationProvider>().fetchNotifications();
  }

  Future<void> _markAllRead() async {
    if (_isMarkingAll) return;
    setState(() => _isMarkingAll = true);
    await context.read<NotificationProvider>().markAllAsRead();
    if (mounted) setState(() => _isMarkingAll = false);
  }

  Future<void> _clearAll() async {
    if (_isClearing) return;
    final confirmed = await CustomAlertDialog.show<bool>(
      context: context,
      title: 'Clear all notifications?',
      message: 'This action cannot be undone.',
      primaryButtonText: 'Clear All',
      onPrimaryPressed: () => Navigator.pop(context, true),
      secondaryButtonText: 'Cancel',
      onSecondaryPressed: () => Navigator.pop(context, false),
      icon: Icons.delete_forever_rounded,
      iconColor: AppColors.error,
    );

    if (confirmed == true && mounted) {
      setState(() => _isClearing = true);
      await context.read<NotificationProvider>().clearAllNotifications();
      if (mounted) setState(() => _isClearing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<NotificationProvider>(
      builder: (context, notificationProvider, _) {
        final notifications = notificationProvider.notifications;
        final isLoading = notificationProvider.isLoading;
        final hasUnread = notificationProvider.hasUnread;

        return Scaffold(
          appBar: AppBar(
            title: const Text('Notifications'),
            actions: [
              if (notifications.isNotEmpty)
                IconButton(
                  icon: _isClearing
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.delete_outline),
                  tooltip: 'Clear all',
                  onPressed: _isClearing ? null : _clearAll,
                ),
              if (hasUnread)
                TextButton(
                  onPressed: _isMarkingAll ? null : _markAllRead,
                  child: _isMarkingAll
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Mark all read'),
                ),
            ],
          ),
          body: isLoading
              ? const Center(child: CircularProgressIndicator())
              : notifications.isEmpty
              ? _buildEmpty()
              : _buildList(notifications),
        );
      },
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.notifications_off_outlined,
            size: 64,
            color: AppColors.textTertiary.withAlphaValue(0.5),
          ),
          const SizedBox(height: 16),
          Text(
            'No notifications',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildList(List<AppNotification> notifications) {
    return RefreshIndicator(
      onRefresh: _loadNotifications,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: notifications.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) =>
            _buildNotificationCard(notifications[index]),
      ),
    );
  }

  Widget _buildNotificationCard(AppNotification notification) {
    final isUnread = !notification.isRead;
    final type = notification.type;

    IconData icon;
    Color color;

    switch (type) {
      case 'match':
        icon = Icons.people;
        color = AppColors.success;
        break;
      case 'group':
        icon = Icons.check_circle;
        color = AppColors.primary;
        break;
      case 'reminder':
        icon = Icons.alarm;
        color = AppColors.warning;
        break;
      default:
        icon = Icons.info;
        color = AppColors.textSecondary;
    }

    return Card(
      color: isUnread ? AppColors.primary.withAlphaValue(0.05) : null,
      child: InkWell(
        onTap: () {
          if (isUnread) {
            context.read<NotificationProvider>().markAsRead(notification.id);
          }
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withAlphaValue(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  fontWeight: isUnread
                                      ? FontWeight.w600
                                      : FontWeight.w500,
                                ),
                          ),
                        ),
                        if (isUnread)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      notification.body,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      TimeUtils.formatRelative(notification.createdAt),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppColors.textTertiary,
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
