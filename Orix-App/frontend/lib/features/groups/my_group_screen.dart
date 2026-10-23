/// My Group Screen
///
/// Displays the user's active group if any, otherwise shows a placeholder.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/providers/group_provider.dart';
import '../../core/theme/app_theme.dart';

class MyGroupScreen extends StatefulWidget {
  const MyGroupScreen({super.key});

  @override
  State<MyGroupScreen> createState() => _MyGroupScreenState();
}

class _MyGroupScreenState extends State<MyGroupScreen> {
  bool _hasNavigated = false;

  @override
  void initState() {
    super.initState();
    _checkAndNavigate();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reset navigation flag when returning to this screen
    _hasNavigated = false;
  }

  Future<void> _checkAndNavigate() async {
    if (_hasNavigated) return;

    final groupProvider = context.read<GroupProvider>();
    await groupProvider.fetchActiveGroups();

    if (!mounted) return;

    if (groupProvider.hasActiveGroup) {
      final group = groupProvider.activeGroups.first;
      if (group.status == 'active' || group.status == 'confirming') {
        _hasNavigated = true;
        context.go('/groups/${group.groupId}');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final groupProvider = context.watch<GroupProvider>();

    if (groupProvider.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('My Group')),
      body: RefreshIndicator(
        onRefresh: _checkAndNavigate,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.7,
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.group_outlined,
                      size: 64,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'You have no active group.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Find a ride to join a group',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textTertiary,
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
}
