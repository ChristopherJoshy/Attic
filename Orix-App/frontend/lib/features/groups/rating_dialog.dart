/// Rating Dialog Widget
///
/// Shows a dialog for users to rate their ride partners after a completed ride.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:orix/core/services/api_service.dart';
import 'package:orix/core/providers/group_provider.dart';
import 'package:orix/core/providers/ride_provider.dart';

/// Show the rating dialog for a completed ride
Future<void> showRatingDialog({
  required BuildContext context,
  required String groupId,
}) async {
  final api = context.read<ApiService>();

  Future<void> finishAndExit(String successMessage) async {
    final finishResponse = await api.post<Map<String, dynamic>>(
      '/groups/$groupId/finish',
      body: {'ride_completed': true},
    );

    if (!context.mounted) return;

    if (finishResponse.success) {
      context.read<GroupProvider>().clearGroup();
      context.read<RideProvider>().clearMatchingStatus();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(successMessage),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 2),
        ),
      );

      // Return to home; if already there this is a no-op
      Navigator.of(context).popUntil((route) => route.isFirst);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(finishResponse.error ?? 'Failed to complete ride'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  final response = await api.get<Map<String, dynamic>>(
    '/ratings/pending/$groupId',
  );

  if (!context.mounted) return;

  if (!response.success || response.data == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Failed to load rating information')),
    );
    return;
  }

  final data = response.data!;
  final pendingUsersData = data['pending_users'] as List<dynamic>?;
  final message = data['message'] as String?;
  final isOnlyPerson = data['is_only_person'] as bool? ?? false;

  final hasPending = pendingUsersData != null && pendingUsersData.isNotEmpty;

  if (!hasPending) {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _FinishOnlySheet(
        groupId: groupId,
        finishAndExit: finishAndExit,
        message: message,
        isOnlyPerson: isOnlyPerson,
      ),
    );
    return;
  }

  final pendingUsers = pendingUsersData
      .map((json) => _PendingRating.fromJson(json as Map<String, dynamic>))
      .toList();

  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) =>
        _RatingSheet(groupId: groupId, pendingUsers: pendingUsers),
  );
}

class _FinishOnlySheet extends StatelessWidget {
  final String groupId;
  final Future<void> Function(String) finishAndExit;
  final String? message;
  final bool isOnlyPerson;

  const _FinishOnlySheet({
    required this.groupId,
    required this.finishAndExit,
    this.message,
    required this.isOnlyPerson,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final infoText = message?.isNotEmpty == true
        ? message!
        : (isOnlyPerson
              ? 'You were the only rider in this trip.'
              : 'All set. Finish to wrap up this ride.');

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _HandleBar(color: theme.dividerColor),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.flag_rounded,
                color: theme.colorScheme.primary,
                size: 22,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Finish Ride',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              infoText,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => finishAndExit('Ride completed!'),
                icon: const Icon(Icons.check_circle_rounded),
                label: const Text('Finish Ride'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PendingRating {
  final String userId;
  final String displayName;
  final String? photoUrl;

  _PendingRating({
    required this.userId,
    required this.displayName,
    this.photoUrl,
  });

  factory _PendingRating.fromJson(Map<String, dynamic> json) {
    return _PendingRating(
      userId: json['user_id'] as String,
      displayName: json['display_name'] as String,
      photoUrl: json['photo_url'] as String?,
    );
  }
}

class _RatingSheet extends StatefulWidget {
  final String groupId;
  final List<_PendingRating> pendingUsers;

  const _RatingSheet({required this.groupId, required this.pendingUsers});

  @override
  State<_RatingSheet> createState() => _RatingSheetState();
}

class _RatingSheetState extends State<_RatingSheet> {
  final Map<String, int> _ratings = {};
  bool _isSubmitting = false;
  int _currentIndex = 0;
  bool _allRatingsComplete = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // Normal rating flow for multiple users
    final user = widget.pendingUsers[_currentIndex];
    final currentRating = _ratings[user.userId] ?? 0;

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _HandleBar(color: theme.dividerColor),
          const SizedBox(height: 16),

          // Title
          Text(
            _allRatingsComplete ? 'All Ratings Done' : 'Rate Your Ride',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _allRatingsComplete
                ? 'Wrap up and start a new ride.'
                : '${_currentIndex + 1} of ${widget.pendingUsers.length}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: 20),

          // User avatar or completion checkmark (no animation for minimal feel)
          !_allRatingsComplete
              ? _AvatarCard(user: user, theme: theme)
              : _CompletionBadge(theme: theme),
          const SizedBox(height: 18),

          // User name or completion text
          Text(
            _allRatingsComplete ? 'All riders rated' : user.displayName,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 18),

          // Star rating or completion message
          if (!_allRatingsComplete)
            _StarRow(
              currentRating: currentRating,
              onRated: (value) {
                setState(() {
                  _ratings[user.userId] = value;
                });
              },
              theme: theme,
            )
          else
            _CompletionNote(theme: theme),

          const SizedBox(height: 28),

          // Action buttons
          if (!_allRatingsComplete)
            Row(
              children: [
                if (_currentIndex > 0)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        setState(() {
                          _currentIndex--;
                        });
                      },
                      child: const Text('Back'),
                    ),
                  ),
                if (_currentIndex > 0) const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: currentRating > 0 && !_isSubmitting
                        ? _onNext
                        : null,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(
                            _currentIndex < widget.pendingUsers.length - 1
                                ? 'Next'
                                : 'Submit',
                          ),
                  ),
                ),
              ],
            )
          else
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                    },
                    child: const Text('Later'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _isSubmitting ? null : _finishRide,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Finish Ride'),
                  ),
                ),
              ],
            ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Future<void> _onNext() async {
    if (_currentIndex < widget.pendingUsers.length - 1) {
      setState(() {
        _currentIndex++;
      });
    } else {
      await _submitAllRatings();
    }
  }

  Future<void> _submitAllRatings() async {
    setState(() {
      _isSubmitting = true;
    });

    final api = context.read<ApiService>();
    int successCount = 0;

    for (final entry in _ratings.entries) {
      final response = await api.post<Map<String, dynamic>>(
        '/ratings',
        body: {
          'rated_user_id': entry.key,
          'group_id': widget.groupId,
          'rating': entry.value,
        },
      );

      if (response.success) {
        successCount++;
      }
    }

    if (mounted) {
      setState(() {
        _allRatingsComplete = true;
        _isSubmitting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Thanks! Rated $successCount riders'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  Future<void> _finishRide() async {
    setState(() {
      _isSubmitting = true;
    });

    try {
      final api = context.read<ApiService>();

      // Submit ratings first if any
      if (_ratings.isNotEmpty) {
        for (final entry in _ratings.entries) {
          await api.post<Map<String, dynamic>>(
            '/ratings',
            body: {
              'rated_user_id': entry.key,
              'group_id': widget.groupId,
              'rating': entry.value,
            },
          );
        }
      }

      // Mark ride as complete and remove user from group
      final finishResponse = await api.post<Map<String, dynamic>>(
        '/groups/${widget.groupId}/finish',
        body: {'ride_completed': true},
      );

      if (!finishResponse.success) {
        throw Exception(finishResponse.error ?? 'Failed to finish ride');
      }

      // Bust all cached responses related to groups and rides
      api.invalidateCacheByPrefix('/groups');
      api.invalidateCacheByPrefix('/rides/status');

      if (!mounted) return;

      context.read<GroupProvider>().clearGroup();
      context.read<RideProvider>().clearMatchingStatus();

      // Force fresh fetch to ensure stale data doesn't reappear
      await Future.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;

      context.read<RideProvider>().fetchMatchingStatus();
      context.read<GroupProvider>().fetchActiveGroups();

      if (!mounted) return;

      Navigator.of(context).pop();
      // Return to home after closing the sheet so the dashboard refreshes
      Navigator.of(context).popUntil((route) => route.isFirst);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ride finished! Thank you for riding with Orix!'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to finish ride: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}

class _HandleBar extends StatelessWidget {
  final Color color;
  const _HandleBar({required this.color});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 44,
        height: 4,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}

class _AvatarCard extends StatelessWidget {
  final _PendingRating user;
  final ThemeData theme;

  const _AvatarCard({required this.user, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        CircleAvatar(
          radius: 42,
          backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.12),
          backgroundImage: user.photoUrl != null && user.photoUrl!.isNotEmpty
              ? NetworkImage(user.photoUrl!)
              : null,
          onBackgroundImageError: user.photoUrl != null
              ? (exception, stackTrace) {
                  // Image load failed - avatar will fall back to initials
                }
              : null,
          child: user.photoUrl == null || user.photoUrl!.isEmpty
              ? Text(
                  user.displayName[0].toUpperCase(),
                  style: TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.primary,
                  ),
                )
              : null,
        ),
      ],
    );
  }
}

class _CompletionBadge extends StatelessWidget {
  final ThemeData theme;

  const _CompletionBadge({required this.theme});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.12),
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.check_rounded,
        color: theme.colorScheme.primary,
        size: 28,
      ),
    );
  }
}

class _CompletionNote extends StatelessWidget {
  final ThemeData theme;

  const _CompletionNote({required this.theme});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        'Thank you for rating your co-riders.',
        style: theme.textTheme.bodyMedium?.copyWith(
          color: theme.colorScheme.onSurface,
          fontWeight: FontWeight.w600,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class _StarRow extends StatelessWidget {
  final int currentRating;
  final ValueChanged<int> onRated;
  final ThemeData theme;

  const _StarRow({
    required this.currentRating,
    required this.onRated,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(5, (index) {
        final starIndex = index + 1;
        final isFilled = starIndex <= currentRating;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: GestureDetector(
            onTap: () => onRated(starIndex),
            child: Icon(
              isFilled ? Icons.star_rounded : Icons.star_outline_rounded,
              size: 44,
              color: isFilled
                  ? theme.colorScheme.secondary
                  : theme.colorScheme.onSurface.withValues(alpha: 0.35),
            ),
          ),
        );
      }),
    );
  }
}
