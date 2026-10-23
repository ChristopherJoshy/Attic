/// Onboarding Screen
///
/// Premium multi-step onboarding - OLED optimized, no glow effects.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _phoneFocus = FocusNode();

  int _currentPage = 0;
  String? _selectedGender;
  bool _safetyConsent = false;
  bool _privacyConsent = false;
  bool _isLoading = false;

  String? _error;

  static const _totalPages = 3;

  @override
  void initState() {
    super.initState();
    _phoneFocus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _pageController.dispose();
    _phoneController.dispose();
    _phoneFocus.dispose();
    super.dispose();
  }

  void _nextPage() async {
    // Validation for Page 0 (Profile)
    if (_currentPage == 0) {
      if (!_formKey.currentState!.validate()) return;

      _pageController.nextPage(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
      );
      return;
    }

    if (_currentPage < _totalPages - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
      );
    }
  }

  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _submit() async {
    if (!_safetyConsent || !_privacyConsent) {
      setState(() => _error = 'Please accept both policies');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final authProvider = context.read<AuthProvider>();
    // Phone is already linked via verifyOTP, but we still update backend data
    final success = await authProvider.completeOnboarding(
      phone: '+91${_phoneController.text.trim()}',
      gender: _selectedGender,
      safetyConsent: true,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (success) {
      context.go(RoutePaths.home);
    } else {
      setState(() => _error = authProvider.error);
    }
  }

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
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (index) => setState(() => _currentPage = index),
                children: [
                  _buildProfilePage(),
                  _buildSafetyPage(),
                  _buildPrivacyPage(),
                ],
              ),
            ),
            _buildNavigation(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Row(
        children: List.generate(_totalPages, (index) {
          final isActive = index <= _currentPage;
          final isCurrent = index == _currentPage;
          return Expanded(
            child: Container(
              margin: EdgeInsets.only(right: index < _totalPages - 1 ? 8 : 0),
              height: isCurrent ? 3 : 2,
              decoration: BoxDecoration(
                color: isActive ? AppColors.primary : const Color(0xFF1A1A1A),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildProfilePage() {
    final user = context.watch<AuthProvider>().user;
    final displayName = user?.displayName != null
        ? _toTitleCase(user!.displayName)
        : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 40),
            const Text(
              'Welcome to ORIX',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: -1,
              ),
            ),
            if (displayName != null) ...[
              const SizedBox(height: 6),
              Text(
                displayName,
                style: const TextStyle(
                  fontSize: 20,
                  color: AppColors.primary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
            const SizedBox(height: 56),

            // Phone Input
            const Text(
              'Phone Number',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Shared only with your ride group',
              style: TextStyle(color: Color(0xFF666666), fontSize: 13),
            ),
            const SizedBox(height: 14),
            Container(
              decoration: BoxDecoration(
                border: Border.all(
                  color: _phoneFocus.hasFocus
                      ? AppColors.primary
                      : const Color(0xFF2A2A2A),
                  width: _phoneFocus.hasFocus ? 1.5 : 1,
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                    decoration: const BoxDecoration(
                      border: Border(
                        right: BorderSide(color: Color(0xFF2A2A2A)),
                      ),
                    ),
                    child: const Text(
                      '+91',
                      style: TextStyle(
                        color: Color(0xFF888888),
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  Expanded(
                    child: TextFormField(
                      controller: _phoneController,
                      focusNode: _phoneFocus,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(
                        fontSize: 16,
                        letterSpacing: 2,
                        color: Colors.white,
                      ),
                      cursorColor: AppColors.primary,
                      decoration: const InputDecoration(
                        hintText: 'Enter 10-digit number',
                        hintStyle: TextStyle(
                          color: Color(0xFF444444),
                          letterSpacing: 0,
                        ),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 16,
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) return 'Required';
                        final clean = value.replaceAll(RegExp(r'\D'), '');
                        if (clean.length != 10) return 'Enter 10 digits';
                        return null;
                      },
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null && _currentPage == 0)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: AppColors.error, fontSize: 13),
                ),
              ),

            const SizedBox(height: 40),

            // Gender - Pill Buttons
            const Text(
              'Gender',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Required • For female-only matching',
              style: TextStyle(color: Color(0xFF666666), fontSize: 13),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _buildGenderPill('M', 'Male'),
                const SizedBox(width: 12),
                _buildGenderPill('F', 'Female'),
              ],
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildGenderPill(String value, String label) {
    final isSelected = _selectedGender == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(
          () => _selectedGender = _selectedGender == value ? null : value,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.primary.withAlpha(18)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(50),
            border: Border.all(
              color: isSelected
                  ? AppColors.primary
                  : Colors.white.withAlpha(50),
              width: 1,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? AppColors.primary
                    : Colors.white.withAlpha(180),
                fontWeight: FontWeight.w500,
                fontSize: 15,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSafetyPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 40),
          Row(
            children: const [
              Icon(Icons.shield_outlined, color: AppColors.primary, size: 26),
              SizedBox(width: 10),
              Text(
                'Safety First',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Our community guidelines',
            style: TextStyle(color: Color(0xFF666666), fontSize: 14),
          ),
          const SizedBox(height: 32),

          // Rule Cards
          _buildRuleCard(
            Icons.handshake_outlined,
            'Respect Everyone',
            'Treat all users with dignity and respect',
          ),
          _buildRuleCard(
            Icons.lock_outlined,
            'Protect Privacy',
            'Never share personal info outside the app',
          ),
          _buildRuleCard(
            Icons.report_outlined,
            'Report Issues',
            'Flag any safety concerns immediately',
          ),
          _buildRuleCard(
            Icons.gavel_outlined,
            'Follow Laws',
            'Comply with all traffic regulations',
          ),
          _buildRuleCard(
            Icons.block_outlined,
            'Zero Tolerance',
            'Harassment leads to permanent ban',
            isWarning: true,
          ),

          const SizedBox(height: 28),
          _buildConsentBar(
            value: _safetyConsent,
            onChanged: (v) => setState(() => _safetyConsent = v),
            label: 'I agree to the safety guidelines',
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildPrivacyPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 40),
          Row(
            children: const [
              Icon(Icons.lock_outline, color: AppColors.primary, size: 26),
              SizedBox(width: 10),
              Text(
                'Your Privacy',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'How we handle your data',
            style: TextStyle(color: Color(0xFF666666), fontSize: 14),
          ),
          const SizedBox(height: 32),

          // Reordered for trust hierarchy
          _buildRuleCard(
            Icons.security_outlined,
            'Encrypted',
            'All data transmitted securely',
          ),
          _buildRuleCard(
            Icons.visibility_off_outlined,
            'No Tracking',
            'We don\'t track you outside the app',
          ),
          _buildRuleCard(
            Icons.delete_outline,
            'Data Deletion',
            'Request account deletion anytime',
          ),
          _buildRuleCard(
            Icons.location_on_outlined,
            'Location Data',
            'Used only for ride matching',
          ),
          _buildRuleCard(
            Icons.phone_android_outlined,
            'Phone Number',
            'Visible only to your ride group',
          ),
          _buildRuleCard(
            Icons.bug_report_outlined,
            'Error Logging',
            'Anonymous crash reports help us improve',
          ),

          const SizedBox(height: 28),
          _buildConsentBar(
            value: _privacyConsent,
            onChanged: (v) => setState(() => _privacyConsent = v),
            label: 'I agree to the privacy policy',
          ),

          if (!_privacyConsent && _currentPage == 2) ...[
            const SizedBox(height: 12),
            const Text(
              'Accept the privacy policy to continue',
              style: TextStyle(color: Color(0xFF555555), fontSize: 12),
            ),
          ],

          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.error, fontSize: 13),
            ),
          ],
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildRuleCard(
    IconData icon,
    String title,
    String subtitle, {
    bool isWarning = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isWarning
            ? AppColors.primary.withAlpha(22)
            : Colors.white.withAlpha(8),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            size: 22,
            color: isWarning ? AppColors.primary : const Color(0xFF777777),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: isWarning ? FontWeight.w600 : FontWeight.w500,
                    fontSize: 15,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFF666666),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConsentBar({
    required bool value,
    required ValueChanged<bool> onChanged,
    required String label,
  }) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: value
              ? AppColors.primary.withAlpha(18)
              : Colors.white.withAlpha(6),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: value ? AppColors.primary : Colors.transparent,
            width: 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: value ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: value ? AppColors.primary : const Color(0xFF444444),
                  width: 2,
                ),
              ),
              child: value
                  ? const Icon(Icons.check, size: 14, color: Colors.black)
                  : null,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNavigation() {
    final isLastPage = _currentPage == _totalPages - 1;
    final canProceed =
        (_currentPage == 0 && _selectedGender != null) ||
        (_currentPage == 1 && _safetyConsent) ||
        (_currentPage == 2 && _privacyConsent);

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
      color: Colors.black,
      child: Row(
        children: [
          if (_currentPage > 0)
            TextButton(
              onPressed: _previousPage,
              style: TextButton.styleFrom(
                foregroundColor: Colors.white.withAlpha(150),
              ),
              child: const Text('Back', style: TextStyle(fontSize: 15)),
            ),
          const Spacer(),
          SizedBox(
            height: 54,
            child: ElevatedButton(
              onPressed: _isLoading || !canProceed
                  ? null
                  : (isLastPage ? _submit : _nextPage),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                disabledBackgroundColor: AppColors.primary.withValues(
                  alpha: 0.3,
                ),
                disabledForegroundColor: Colors.white.withValues(alpha: 0.5),
                padding: const EdgeInsets.symmetric(horizontal: 40),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.black,
                      ),
                    )
                  : Text(
                      isLastPage ? 'Get Started' : 'Continue',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
