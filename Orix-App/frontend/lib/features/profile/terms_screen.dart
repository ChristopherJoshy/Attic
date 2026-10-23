/// Terms and Conditions Screen
///
/// Displays full Terms & Conditions document.
library;

import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Terms & Conditions')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSection(
              'Welcome to ORIX',
              'ORIX is a dedicated ride-sharing coordination platform designed exclusively for the college community. Our goal is to facilitate safe, affordable, and eco-friendly commuting for students and staff.',
            ),
            _buildSection(
              '1. Eligibility & Verification',
              'To use ORIX, you must be a verifiable student or staff member of a supported educational institution. You must register using a valid college-issued email address (.ac.in or similar). By registering, you confirm you are at least 18 years of age.',
            ),
            _buildSection(
              '2. Cost Sharing & Payments',
              'ORIX is a coordination tool ONLY. We do NOT process payments within the app. All cost-sharing arrangements (fuel costs, tolls) are to be settled directly between the Rider and Passenger via cash, UPI, or other mutual agreement. ORIX does not charge a commission on rides.',
            ),
            _buildSection(
              '3. Ad-Supported Service',
              'To keep the platform free for the college community, ORIX displays advertisements served by Google Mobile Ads. By using the app, you consent to the display of these ads.',
            ),
            _buildSection(
              '4. Community Guidelines',
              '''As a member of the ORIX community, you agree to:
• Use your real identity (verified by college email)
• Be punctual and respectful
• Maintain a clean and safe vehicle (Riders)
• Follow all campus rules and local traffic laws
• Not engage in harassment, discrimination, or unsafe behavior''',
            ),
            _buildSection(
              '5. Safety & Liability Disclaimer',
              'ORIX is a technology platform that connects users; we do not provide transportation services. Users travel at their own risk. We strongly encourage checking college IDs before starting a ride. ORIX is not liable for accidents, damages, losses, or disputes arising from rides coordinated through the platform.',
            ),
            _buildSection(
              '6. Privacy & Data',
              'We collect minimal data necessary for ride matching (Location, Name, College Email). Your location is shared only during active ride coordination. We do not sell your personal data to third parties.',
            ),
            _buildSection(
              '7. Account Termination',
              'We reserve the right to suspend or ban users who violate these terms, falsify their student status, or are reported for unsafe/inappropriate conduct.',
            ),
            _buildSection(
              '8. Contact',
              'For support or to report safety concerns, please use the "Help & Support" section in the app.',
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.outline),
              ),
              child: Column(
                children: [
                  Text(
                    'Last Updated',
                    style: TextStyle(
                      color: AppColors.textTertiary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'December 26, 2025',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(String title, String content) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: TextStyle(
              fontSize: 14,
              height: 1.6,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
