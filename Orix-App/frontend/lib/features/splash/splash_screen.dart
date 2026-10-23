/// Splash Screen
///
/// Initial loading screen with auth check.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  Timer? _timeoutTimer;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.5, curve: Curves.easeOut),
      ),
    );

    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.5, curve: Curves.easeOut),
      ),
    );

    _controller.forward();

    // Navigate after animation
    Future.delayed(const Duration(milliseconds: 1000), _checkAuth);

    // Safety timeout - navigate to login if auth takes too long
    _timeoutTimer = Timer(const Duration(seconds: 8), () {
      if (mounted) {
        _navigateToLogin();
      }
    });
  }

  void _checkAuth() {
    if (!mounted) return;

    final authProvider = context.read<AuthProvider>();

    if (authProvider.isLoading) {
      // Wait for auth to complete
      authProvider.addListener(_onAuthChanged);
    } else {
      _navigate(authProvider);
    }
  }

  void _onAuthChanged() {
    if (!mounted) return;

    final authProvider = context.read<AuthProvider>();
    if (!authProvider.isLoading) {
      authProvider.removeListener(_onAuthChanged);
      _navigate(authProvider);
    }
  }

  void _navigate(AuthProvider authProvider) {
    if (!mounted) return;

    // Cancel timeout timer
    _timeoutTimer?.cancel();

    if (authProvider.isBanned) {
      context.go(RoutePaths.banned);
    } else if (authProvider.isSuspended) {
      context.go(RoutePaths.suspended);
    } else if (!authProvider.isAuthenticated) {
      context.go(RoutePaths.login);
    } else if (!authProvider.isOnboarded) {
      context.go(RoutePaths.onboarding);
    } else {
      context.go(RoutePaths.home);
    }
  }

  void _navigateToLogin() {
    if (!mounted) return;
    _timeoutTimer?.cancel();
    context.go(RoutePaths.login);
  }

  @override
  void dispose() {
    _controller.dispose();
    _timeoutTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return FadeTransition(
              opacity: _fadeAnimation,
              child: ScaleTransition(
                scale: _scaleAnimation,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ORIX Logo SVG
                    SizedBox(
                      width: 180,
                      height: 180,
                      child: SvgPicture.asset(
                        'assets/images/orix_logo.svg',
                        fit: BoxFit.contain,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // App name
                    const Text(
                      'ORIX',
                      style: TextStyle(
                        fontSize: 48,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                        fontFamily: AppTextStyles.fontFamily,
                        letterSpacing: 8,
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Tagline
                    Text(
                      'Ride Together. Save Together.',
                      style: TextStyle(
                        fontSize: 16,
                        color: AppColors.textSecondary,
                        fontFamily: AppTextStyles.fontFamily,
                      ),
                    ),

                    const SizedBox(height: 48),

                    // Loading indicator
                    const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
