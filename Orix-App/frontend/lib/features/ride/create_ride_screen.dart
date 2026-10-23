/// Create Ride Screen
///
/// Map-based ride request creation.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../../core/providers/ride_provider.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/group_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/error_helper.dart';

import '../../core/widgets/custom_alert_dialog.dart';
import 'location_picker_screen.dart';

class CreateRideScreen extends StatefulWidget {
  const CreateRideScreen({super.key});

  @override
  State<CreateRideScreen> createState() => _CreateRideScreenState();
}

class _CreateRideScreenState extends State<CreateRideScreen> {
  final _formKey = GlobalKey<FormState>();

  // Location data
  String? _pickupLabel; // Matches backend field name, but UI will say "Start"
  double? _pickupLat;
  double? _pickupLng;

  String? _dropLabel;
  double? _dropLat;
  double? _dropLng;

  // Date and time
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 8, minute: 0);

  // Preferences
  bool _allowRiders = true;
  bool _femaleOnly = false;

  bool _isLoading = false;
  bool _isCheckingGroups = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _checkActiveGroups();
  }

  Future<void> _checkActiveGroups() async {
    final groupProvider = context.read<GroupProvider>();
    await groupProvider.fetchActiveGroups();

    if (!mounted) return;

    setState(() => _isCheckingGroups = false);

    if (groupProvider.hasActiveGroup) {
      final activeGroup = groupProvider.activeGroups.first;
      _showActiveGroupDialog(activeGroup);
    }
  }

  void _showActiveGroupDialog(RideGroup group) {
    CustomAlertDialog.show(
      context: context,
      barrierDismissible: false,
      title: 'Active Ride Exists',
      message:
          'You already have an active ride group:\n\n'
          '${group.routeSummary}\n'
          '${group.timeWindowStart != null ? "Time: ${group.timeWindowStart}" : ""}\n\n'
          'Please complete or cancel your current ride before creating a new one.',
      primaryButtonText: 'View Ride',
      onPrimaryPressed: () {
        Navigator.of(context).pop();
        context.push('/groups/${group.groupId}'); // Go to group details
      },
      secondaryButtonText: 'Go Home',
      onSecondaryPressed: () {
        Navigator.of(context).pop();
        context.go('/'); // Go to home
      },
      icon: Icons.directions_car_filled_outlined,
      iconColor: AppColors.primary,
    );
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 7)),
    );

    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _selectStartTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _startTime,
    );

    if (picked != null) {
      setState(() => _startTime = picked);
    }
  }

  Future<void> _pickLocation(bool isPickup) async {
    final result = await context.push<LocationResult>(
      RoutePaths.locationPicker,
    );

    if (result != null) {
      setState(() {
        if (isPickup) {
          _pickupLabel = result.address ?? 'Selected Location';
          _pickupLat = result.point.latitude;
          _pickupLng = result.point.longitude;
        } else {
          _dropLabel = result.address ?? 'Selected Location';
          _dropLat = result.point.latitude;
          _dropLng = result.point.longitude;
        }
      });
    }
  }

  Future<void> _createRequest() async {
    if (_pickupLabel == null || _dropLabel == null) {
      setState(() => _error = 'Please select start and drop locations');
      return;
    }

    // Location validation: Check coordinates first, then labels
    if ((_pickupLat != null &&
            _dropLat != null &&
            _pickupLat == _dropLat &&
            _pickupLng == _dropLng) ||
        _pickupLabel?.trim().toLowerCase() ==
            _dropLabel?.trim().toLowerCase()) {
      setState(() => _error = 'Start and drop locations cannot be the same');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    // Time validation: Ensure ride is in the future (at least 1 minute)
    // Users requested "last minute rides", so we remove the 15m constraint.
    final selectedDateTime = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      _startTime.hour,
      _startTime.minute,
    );

    final now = DateTime.now();
    final difference = selectedDateTime.difference(now);

    if (difference.inMinutes < 1) {
      setState(() {
        _isLoading = false;
        _error = 'Ride time must be in the future';
      });
      return;
    }

    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final startStr =
        '${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}';
    // Use same time as both start and end for exact time matching
    final endStr = startStr;

    final rideProvider = context.read<RideProvider>();

    try {
      final request = await rideProvider
          .createRideRequest(
            pickupLat: _pickupLat!,
            pickupLng: _pickupLng!,
            pickupLabel: _pickupLabel!,
            dropLat: _dropLat!,
            dropLng: _dropLng!,
            dropLabel: _dropLabel!,
            date: dateStr,
            timeWindowStart: startStr,
            timeWindowEnd: endStr,
            allowRiders: _allowRiders,
            femaleOnly: _femaleOnly,
          )
          .timeout(const Duration(seconds: 15), onTimeout: () => null);

      if (!mounted) return;

      if (request != null) {
        context.go(RoutePaths.matching);
      } else {
        // Use error helper for user-friendly messages
        final errorMsg = rideProvider.error ?? ErrorMessages.unknownError;
        setState(() => _error = errorMsg);
      }
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _error = 'Failed to create ride request. Please try again.',
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Show loading while checking for active groups
    if (_isCheckingGroups) {
      return Scaffold(
        appBar: AppBar(title: const Text('Find a Ride')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 16),
              Text(
                'Checking for active rides...',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Find a Ride')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildLocationSection(),
            const SizedBox(height: 24),
            _buildDateTimeSection(),
            const SizedBox(height: 24),
            _buildPreferencesSection(),
            const SizedBox(height: 16),
            if (_error != null) _buildError(),
            const SizedBox(height: 24),
            _buildSubmitButton(),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Route',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            _buildLocationPicker(
              label: 'Start Location',
              value: _pickupLabel,
              icon: Icons.trip_origin,
              iconColor: AppColors.success,
              onTap: () => _pickLocation(true),
            ),
            const Padding(
              padding: EdgeInsets.only(left: 20),
              child: SizedBox(height: 24, child: VerticalDivider(width: 2)),
            ),
            _buildLocationPicker(
              label: 'Drop Location',
              value: _dropLabel,
              icon: Icons.location_on,
              iconColor: AppColors.error,
              onTap: () => _pickLocation(false),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationPicker({
    required String label,
    required String? value,
    required IconData icon,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, color: iconColor),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value ?? 'Tap to select',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: value != null
                          ? AppColors.textPrimary
                          : AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }

  Widget _buildDateTimeSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'When',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            _buildDatePicker(),
            const SizedBox(height: 12),
            _buildTimePicker('Time', _startTime, _selectStartTime),
          ],
        ),
      ),
    );
  }

  Widget _buildDatePicker() {
    return InkWell(
      onTap: _selectDate,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today, color: AppColors.primary),
            const SizedBox(width: 12),
            Text(
              DateFormat('EEEE, MMM d, yyyy').format(_selectedDate),
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const Spacer(),
            const Icon(Icons.chevron_right, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }

  Widget _buildTimePicker(String label, TimeOfDay time, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(
                  Icons.access_time,
                  color: AppColors.primary,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  time.format(context),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreferencesSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Preferences',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            SwitchListTile(
              title: const Text('Allow riders'),
              subtitle: const Text('Match with users offering rides'),
              value: _allowRiders,
              onChanged: (v) => setState(() => _allowRiders = v),
              contentPadding: EdgeInsets.zero,
            ),

            Consumer<AuthProvider>(
              builder: (context, auth, child) {
                // Check strictly for female gender
                final gender = auth.user?.gender?.toLowerCase();
                final isFemale = gender == 'f' || gender == 'female';

                return SwitchListTile(
                  title: const Text('Female only'),
                  subtitle: Text(
                    !isFemale
                        ? 'Available for female users only'
                        : 'Match only with female riders',
                    style: TextStyle(
                      color: !isFemale ? AppColors.textTertiary : null,
                    ),
                  ),
                  value: !isFemale ? false : _femaleOnly,
                  onChanged: !isFemale
                      ? null
                      : (v) => setState(() => _femaleOnly = v),
                  contentPadding: EdgeInsets.zero,
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _createRequest,
        child: _isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Text('Find Ride Partners'),
      ),
    );
  }
}
