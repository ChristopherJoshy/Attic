/// Ride History Screen
///
/// Displays a list of past and active ride requests.
library;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/providers/ride_provider.dart';
import '../../core/theme/app_theme.dart';

class RideHistoryScreen extends StatefulWidget {
  const RideHistoryScreen({super.key});

  @override
  State<RideHistoryScreen> createState() => _RideHistoryScreenState();
}

class _RideHistoryScreenState extends State<RideHistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RideProvider>().fetchRideHistory(includeHistory: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Your Rides')),
      body: Consumer<RideProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.rideHistory.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.rideHistory.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.error_outline,
                    size: 48,
                    color: AppColors.error,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Failed to load history',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  TextButton(
                    onPressed: () => provider.fetchRideHistory(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (provider.rideHistory.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.history,
                    size: 64,
                    color: AppColors.textTertiary.withAlphaValue(
                      100,
                    ), // ~0.4 opacity
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No ride history yet',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => provider.fetchRideHistory(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: provider.rideHistory.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final ride = provider.rideHistory[index];
                return _buildRideCard(context, ride);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildRideCard(BuildContext context, RideRequest ride) {
    final isExpired = ride.status == 'expired';
    final isCancelled = ride.status == 'cancelled';
    final isMatched = ride.status == 'matched';

    Color statusColor = AppColors.textSecondary;
    if (isMatched) statusColor = AppColors.success;
    if (isCancelled) statusColor = AppColors.error;
    if (isExpired) statusColor = AppColors.textTertiary;
    if (ride.status == 'pending') statusColor = AppColors.primary;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor.withAlphaValue(0.1),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: statusColor.withAlphaValue(0.2)),
                  ),
                  child: Text(
                    ride.status.toUpperCase(),
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Text(
                  _formatDate(ride.date),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildLocationRow(
              Icons.circle,
              AppColors.success,
              ride.pickupLabel,
            ),
            Container(
              margin: const EdgeInsets.only(left: 11),
              height: 16,
              decoration: const BoxDecoration(
                border: Border(
                  left: BorderSide(color: AppColors.outline, width: 1),
                ),
              ),
            ),
            _buildLocationRow(
              Icons.location_on,
              AppColors.error,
              ride.dropLabel,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationRow(IconData icon, Color color, String label) {
    return Row(
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w500),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      return DateFormat('MMM d, y').format(date);
    } catch (_) {
      return dateStr;
    }
  }
}
