/// Rider Setup Screen
///
/// Configure or disable rider mode.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../../core/providers/user_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/custom_alert_dialog.dart';
import '../ride/location_picker_screen.dart';

class RiderSetupScreen extends StatefulWidget {
  const RiderSetupScreen({super.key});

  @override
  State<RiderSetupScreen> createState() => _RiderSetupScreenState();
}

class _RiderSetupScreenState extends State<RiderSetupScreen> {
  String _vehicleType = 'bike';

  String? _fromLabel;
  double _fromLat = 0;
  double _fromLng = 0;

  String? _toLabel;
  double _toLat = 0;
  double _toLng = 0;

  DateTime _selectedDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 8, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 10, minute: 0);
  int _seats = 1;

  bool _isLoading = false;
  String? _error;

  Future<void> _selectLocation(bool isFrom) async {
    // Navigate to location picker
    final result = await Navigator.push<LocationResult>(
      context,
      MaterialPageRoute(builder: (context) => const LocationPickerScreen()),
    );

    if (result != null && mounted) {
      setState(() {
        if (isFrom) {
          _fromLabel = result.address;
          _fromLat = result.point.latitude;
          _fromLng = result.point.longitude;
        } else {
          _toLabel = result.address;
          _toLat = result.point.latitude;
          _toLng = result.point.longitude;
        }
      });
    }
  }

  Future<void> _enableRiderMode() async {
    if (_fromLabel == null || _toLabel == null) {
      setState(() => _error = 'Please select both locations');
      return;
    }

    if (_fromLabel == _toLabel) {
      setState(() => _error = 'Start and destination cannot be the same');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    final userProvider = context.read<UserProvider>();
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final startStr =
        '${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}';
    final endStr =
        '${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}';

    final success = await userProvider.enableRiderMode(
      vehicleType: _vehicleType,
      fromLat: _fromLat,
      fromLng: _fromLng,
      fromLabel: _fromLabel!,
      toLat: _toLat,
      toLng: _toLng,
      toLabel: _toLabel!,
      date: dateStr,
      timeWindowStart: startStr,
      timeWindowEnd: endStr,
      seats: _seats,
    );

    if (!mounted) return;

    setState(() => _isLoading = false);

    if (success) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Rider mode enabled!')));
      context.pop();
    } else {
      setState(() => _error = userProvider.error);
    }
  }

  Future<void> _disableRiderMode() async {
    final confirm = await CustomAlertDialog.show<bool>(
      context: context,
      title: 'Disable Rider Mode?',
      message: 'You will no longer be visible to passengers.',
      primaryButtonText: 'Disable',
      onPrimaryPressed: () => Navigator.pop(context, true),
      secondaryButtonText: 'Cancel',
      onSecondaryPressed: () => Navigator.pop(context, false),
      icon: Icons.two_wheeler,
      iconColor: AppColors.error,
    );

    if (confirm == true && mounted) {
      final userProvider = context.read<UserProvider>();
      await userProvider.disableRiderMode();
      if (mounted) context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final userProvider = context.watch<UserProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rider Mode'),
        actions: [
          if (userProvider.isRider)
            TextButton(
              onPressed: _disableRiderMode,
              child: Text('Disable', style: TextStyle(color: AppColors.error)),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildVehicleSelector(),
          const SizedBox(height: 24),
          _buildRouteSection(),
          const SizedBox(height: 24),
          _buildTimeSection(),
          const SizedBox(height: 24),
          _buildSeatsSection(),
          const SizedBox(height: 16),
          if (_error != null) _buildError(),
          const SizedBox(height: 24),
          _buildSubmitButton(),
        ],
      ),
    );
  }

  Widget _buildVehicleSelector() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Vehicle Type',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _buildVehicleOption('bike', 'Bike', Icons.pedal_bike),
                const SizedBox(width: 12),
                _buildVehicleOption('scooter', 'Scooter', Icons.two_wheeler),
                const SizedBox(width: 12),
                _buildVehicleOption('car', 'Car', Icons.directions_car),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVehicleOption(String value, String label, IconData icon) {
    final isSelected = _vehicleType == value;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _vehicleType = value),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.secondary.withAlphaValue(0.1)
                : AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppColors.secondary : Colors.transparent,
              width: 2,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: isSelected
                    ? AppColors.secondary
                    : AppColors.textSecondary,
                size: 28,
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: TextStyle(
                  color: isSelected
                      ? AppColors.secondary
                      : AppColors.textSecondary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRouteSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your Route',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            _buildLocationTile(
              'From',
              _fromLabel,
              AppColors.success,
              () => _selectLocation(true),
            ),
            const SizedBox(height: 12),
            _buildLocationTile(
              'To',
              _toLabel,
              AppColors.error,
              () => _selectLocation(false),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationTile(
    String label,
    String? value,
    Color color,
    VoidCallback onTap,
  ) {
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
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: Theme.of(context).textTheme.bodySmall),
                  Text(
                    value ?? 'Select location',
                    style: Theme.of(context).textTheme.bodyLarge,
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

  Widget _buildTimeSection() {
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
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate,
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 7)),
                );
                if (picked != null) setState(() => _selectedDate = picked);
              },
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
                    Text(DateFormat('EEEE, MMM d').format(_selectedDate)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildTimeTile(
                    'From',
                    _startTime,
                    (t) => setState(() => _startTime = t),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimeTile(
                    'To',
                    _endTime,
                    (t) => setState(() => _endTime = t),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimeTile(
    String label,
    TimeOfDay time,
    Function(TimeOfDay) onChanged,
  ) {
    return InkWell(
      onTap: () async {
        final picked = await showTimePicker(
          context: context,
          initialTime: time,
        );
        if (picked != null) onChanged(picked);
      },
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
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            Row(
              children: [
                const Icon(
                  Icons.access_time,
                  size: 18,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 8),
                Text(time.format(context)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSeatsSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Available Seats',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    'How many passengers?',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Row(
              children: [
                IconButton(
                  onPressed: _seats > 1 ? () => setState(() => _seats--) : null,
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('$_seats', style: Theme.of(context).textTheme.titleLarge),
                IconButton(
                  onPressed: _seats < 4 ? () => setState(() => _seats++) : null,
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
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
        color: AppColors.error.withAlphaValue(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _error!,
              style: TextStyle(color: AppColors.error, fontSize: 12),
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
        onPressed: _isLoading ? null : _enableRiderMode,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.error,
          foregroundColor: Colors.black,
        ),
        child: _isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.black,
                ),
              )
            : const Text(
                'Enable Rider Mode',
                style: TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }
}
