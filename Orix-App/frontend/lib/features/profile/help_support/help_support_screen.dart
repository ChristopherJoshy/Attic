import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';

class HelpSupportScreen extends StatelessWidget {
  const HelpSupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSupportOption(
            context,
            icon: Icons.question_answer_outlined,
            title: 'FAQs',
            subtitle: 'Frequently asked questions',
            onTap: () => context.push(RoutePaths.faq),
          ),
          const SizedBox(height: 16),
          _buildSupportOption(
            context,
            icon: Icons.confirmation_number_outlined,
            title: 'My Tickets',
            subtitle: 'View status of your reports & requests',
            onTap: () => context.push(RoutePaths.ticketList),
          ),
          const SizedBox(height: 24),
          Text(
            'Contact Us',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          _buildSupportOption(
            context,
            icon: Icons.bug_report_outlined,
            title: 'Report an Issue',
            subtitle: 'Something not working right?',
            onTap: () => context.push(RoutePaths.createTicket, extra: 'issue'),
          ),
          const SizedBox(height: 12),
          _buildSupportOption(
            context,
            icon: Icons.lightbulb_outline,
            title: 'Suggest a Feature',
            subtitle: 'Have an idea for Orix?',
            onTap: () =>
                context.push(RoutePaths.createTicket, extra: 'feature'),
          ),
          const SizedBox(height: 12),
          _buildSupportOption(
            context,
            icon: Icons.flag_outlined,
            title: 'Report a User',
            subtitle: 'Report bad behavior',
            onTap: () =>
                context.push(RoutePaths.createTicket, extra: 'report_user'),
          ),
        ],
      ),
    );
  }

  Widget _buildSupportOption(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 0,
      color: AppColors.surfaceVariant.withAlphaValue(100),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: AppColors.primary),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(
          Icons.chevron_right,
          color: AppColors.textTertiary,
        ),
        onTap: onTap,
      ),
    );
  }
}
