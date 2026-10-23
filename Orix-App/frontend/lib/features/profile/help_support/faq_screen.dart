import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class FAQScreen extends StatelessWidget {
  const FAQScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('FAQs')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildFAQItem(
            context,
            question: 'What is ORIX?',
            answer:
                'ORIX is a ride-sharing community exclusive to college students and staff. It helps you find others traveling on the same route to share costs and reduce carbon footprint.',
          ),
          _buildFAQItem(
            context,
            question: 'Who can use ORIX?',
            answer:
                'Only Verified Users can join. You must sign up with a valid email address from a supported college domain (e.g., @sjcetpalai.ac.in). This ensures a safer community of peers.',
          ),
          _buildFAQItem(
            context,
            question: 'How do I pay for rides?',
            answer:
                'ORIX does NOT process payments. Riders and Passengers typically split fuel and toll costs. You can settle this directly via Cash, UPI, or any other method you both agree on at the end of the ride.',
          ),
          _buildFAQItem(
            context,
            question: 'Is ORIX safe?',
            answer:
                'We focus on community trust. Everyone on ORIX is verified via their college email. However, always exercise caution: check college IDs before entering a car and let friends know your whereabouts.',
          ),
          _buildFAQItem(
            context,
            question: 'Why do I see ads?',
            answer:
                'ORIX is free to use! To cover our server and maintenance costs without charging you subscription fees, we display non-intrusive advertisements.',
          ),
          _buildFAQItem(
            context,
            question: 'Can I cancel a requested ride?',
            answer:
                'Yes, but frequent late cancellations may affect your reputation score. Please cancel as early as possible so the Rider can find another passenger.',
          ),
          _buildFAQItem(
            context,
            question: 'My college is not supported. What do I do?',
            answer:
                'We are expanding! Please use the "Contact Support" option to request your college domain to be added to our network.',
          ),
        ],
      ),
    );
  }

  Widget _buildFAQItem(
    BuildContext context, {
    required String question,
    required String answer,
  }) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: AppColors.surface,
      child: ExpansionTile(
        title: Text(
          question,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          Text(
            answer,
            style: const TextStyle(color: AppColors.textSecondary, height: 1.5),
          ),
        ],
      ),
    );
  }
}
