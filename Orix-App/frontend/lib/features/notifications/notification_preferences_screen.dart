/// Notification Preferences Screen
///
/// Allows users to manage their notification settings.
/// Persists preferences using SharedPreferences.
library;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart';
import '../../core/services/notification_service.dart';
import '../../core/theme/app_theme.dart';

class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  State<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends State<NotificationPreferencesScreen> {
  // Preference keys
  static const _keyRideMatches = 'notif_ride_matches';
  static const _keyGroupUpdates = 'notif_group_updates';
  static const _keyChatMessages = 'notif_chat_messages';
  static const _keySystemAlerts = 'notif_system_alerts';
  static const _keyPromotions = 'notif_promotions';

  bool _rideMatches = true;
  bool _groupUpdates = true;
  bool _chatMessages = true;
  bool _systemAlerts = true;
  bool _promotions = false;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;

    setState(() {
      _rideMatches = prefs.getBool(_keyRideMatches) ?? true;
      _groupUpdates = prefs.getBool(_keyGroupUpdates) ?? true;
      _chatMessages = prefs.getBool(_keyChatMessages) ?? true;
      _systemAlerts = prefs.getBool(_keySystemAlerts) ?? true;
      _promotions =
          prefs.getBool(_keyPromotions) ??
          true; // Default to true per requirements
      _isLoading = false;
    });
  }

  Future<void> _savePreference(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  void _updatePreference(String key, bool value, void Function(bool) setter) {
    setState(() => setter(value));
    _savePreference(key, value);

    // Handle topic subscription for promotions
    if (key == _keyPromotions) {
      context.read<NotificationService>().setPromotionsEnabled(value);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notification Preferences')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Notification Preferences')),
      body: ListView(
        children: [
          _buildSection('Ride Notifications', [
            _buildSwitch(
              'Ride Matches',
              'Get notified when you\'re matched with a group',
              _rideMatches,
              (v) => _updatePreference(
                _keyRideMatches,
                v,
                (val) => _rideMatches = val,
              ),
            ),
            _buildSwitch(
              'Group Updates',
              'Updates about your ride group status',
              _groupUpdates,
              (v) => _updatePreference(
                _keyGroupUpdates,
                v,
                (val) => _groupUpdates = val,
              ),
            ),
          ]),
          _buildSection('Communication', [
            _buildSwitch(
              'Chat Messages',
              'New messages from your ride group',
              _chatMessages,
              (v) => _updatePreference(
                _keyChatMessages,
                v,
                (val) => _chatMessages = val,
              ),
            ),
          ]),
          _buildSection('Other', [
            _buildSwitch(
              'System Alerts',
              'Important app updates and announcements',
              _systemAlerts,
              (v) => _updatePreference(
                _keySystemAlerts,
                v,
                (val) => _systemAlerts = val,
              ),
            ),
            _buildSwitch(
              'Promotions',
              'Special offers and promotions',
              _promotions,
              (v) => _updatePreference(
                _keyPromotions,
                v,
                (val) => _promotions = val,
              ),
            ),
          ]),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'You can also manage notifications in your device settings.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Card(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(children: children),
        ),
      ],
    );
  }

  Widget _buildSwitch(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return SwitchListTile(
      title: Text(title),
      subtitle: Text(
        subtitle,
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
      ),
      value: value,
      onChanged: onChanged,
    );
  }
}
