/// Profile Screen
///
/// User profile with settings and rider toggle.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/providers/user_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_alert_dialog.dart';
import 'package:cached_network_image/cached_network_image.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  String _toTitleCase(String text) {
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
    final authProvider = context.watch<AuthProvider>();
    final userProvider = context.watch<UserProvider>();
    final user = authProvider.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildProfileHeader(context, user),
          const SizedBox(height: 24),
          _buildRiderSection(context, userProvider),
          const SizedBox(height: 24),
          _buildSettingsSection(context),
          const SizedBox(height: 24),
          _buildDangerSection(context, authProvider),
        ],
      ),
    );
  }

  Widget _buildProfileHeader(BuildContext context, BackendUser? user) {
    final displayName = user?.displayName != null
        ? _toTitleCase(user!.displayName)
        : 'User';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(15),
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        onTap: () => context.push(RoutePaths.editProfile),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Stack(
                children: [
                  if (user?.photoUrl != null)
                    CachedNetworkImage(
                      imageUrl: user!.photoUrl!,
                      memCacheHeight: 200,
                      imageBuilder: (context, imageProvider) => CircleAvatar(
                        radius: 40,
                        backgroundColor: AppColors.primary.withAlpha(30),
                        backgroundImage: imageProvider,
                      ),
                      placeholder: (context, url) => CircleAvatar(
                        radius: 40,
                        backgroundColor: AppColors.primary.withAlpha(30),
                        child: const CircularProgressIndicator(strokeWidth: 2),
                      ),
                      errorWidget: (context, url, error) => CircleAvatar(
                        radius: 40,
                        backgroundColor: AppColors.primary.withAlpha(30),
                        child: Text(
                          displayName.substring(0, 1).toUpperCase(),
                          style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    )
                  else
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: AppColors.primary.withAlpha(30),
                      child: Text(
                        displayName.substring(0, 1).toUpperCase(),
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.edit,
                        color: Colors.white,
                        size: 12,
                      ),
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
                      displayName,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user?.email ?? '',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.white.withAlpha(100)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRiderSection(BuildContext context, UserProvider userProvider) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(15),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                const Icon(Icons.two_wheeler, color: AppColors.secondary),
                const SizedBox(width: 8),
                Text(
                  'Rider Mode',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          ListTile(
            leading: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: userProvider.isRider
                    ? AppColors.success.withAlpha(25)
                    : Colors.white.withAlpha(10),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                userProvider.isRider
                    ? Icons.check_circle
                    : Icons.radio_button_unchecked,
                color: userProvider.isRider
                    ? AppColors.success
                    : AppColors.textTertiary,
              ),
            ),
            title: Text(
              userProvider.isRider ? 'Active' : 'Not Active',
              style: TextStyle(
                color: userProvider.isRider
                    ? AppColors.success
                    : AppColors.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
            subtitle: Text(
              userProvider.isRider
                  ? 'Offering rides to others'
                  : 'Enable to offer rides',
            ),
            trailing: Icon(
              Icons.chevron_right,
              color: Colors.white.withAlpha(100),
            ),
            onTap: () => context.push(RoutePaths.riderSetup),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsSection(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(15),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          _buildSettingsTile(
            context,
            icon: Icons.history,
            title: 'Ride History',
            subtitle: 'View your past trips',
            onTap: () => context.push(RoutePaths.rideHistory),
          ),
          Divider(height: 1, color: Colors.white.withAlpha(10)),
          _buildSettingsTile(
            context,
            icon: Icons.notifications_outlined,
            title: 'Notifications',
            subtitle: 'Manage notification preferences',
            onTap: () => context.push(RoutePaths.notificationPreferences),
          ),
          Divider(height: 1, color: Colors.white.withAlpha(10)),
          _buildSettingsTile(
            context,
            icon: Icons.policy_outlined,
            title: 'Terms & Conditions',
            subtitle: 'View our terms of service',
            onTap: () => context.push(RoutePaths.termsAndConditions),
          ),
          Divider(height: 1, color: Colors.white.withAlpha(10)),
          _buildSettingsTile(
            context,
            icon: Icons.help_outline,
            title: 'Help & Support',
            subtitle: 'FAQs and contact support',
            onTap: () => context.push(RoutePaths.helpSupport),
          ),
          Divider(height: 1, color: Colors.white.withAlpha(10)),
          _buildSettingsTile(
            context,
            icon: Icons.info_outline,
            title: 'About',
            subtitle: 'App version and credits',
            onTap: () => context.push(RoutePaths.about),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: Icon(Icons.chevron_right, color: Colors.white.withAlpha(100)),
      onTap: onTap,
    );
  }

  Widget _buildDangerSection(BuildContext context, AuthProvider authProvider) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(15),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.error),
            title: const Text(
              'Sign Out',
              style: TextStyle(color: AppColors.error),
            ),
            onTap: () => _showSignOutDialog(context, authProvider),
          ),
        ],
      ),
    );
  }

  void _showSignOutDialog(
    BuildContext context,
    AuthProvider authProvider,
  ) async {
    final confirm = await CustomAlertDialog.show<bool>(
      context: context,
      title: 'Sign Out?',
      message: 'Are you sure you want to sign out?',
      primaryButtonText: 'Sign Out',
      onPrimaryPressed: () => Navigator.pop(context, true),
      secondaryButtonText: 'Cancel',
      onSecondaryPressed: () => Navigator.pop(context, false),
      icon: Icons.logout,
      iconColor: AppColors.error,
    );

    if (confirm == true) {
      await authProvider.signOut();
      if (context.mounted) context.go(RoutePaths.login);
    }
  }
}
