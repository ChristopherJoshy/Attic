/// Authentication Provider
///
/// Manages authentication state and user session.
library;

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';

import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../router/app_router.dart';
import '../utils/error_helper.dart';
import '../utils/time_utils.dart';
import '../config/api_config.dart';

/// User status from backend
enum UserStatus { active, suspended, banned }

/// Backend user data
class BackendUser {
  final String userId;
  final String email;
  final String displayName;
  final String? photoUrl;
  final String? phone;
  final String? gender;
  final bool isRider;
  final bool onboardingCompleted;
  final UserStatus status;
  final String? banReason;
  final DateTime? suspensionExpiresAt;

  BackendUser({
    required this.userId,
    required this.email,
    required this.displayName,
    this.photoUrl,
    this.phone,
    this.gender,
    this.isRider = false,
    this.onboardingCompleted = false,
    this.status = UserStatus.active,
    this.banReason,
    this.suspensionExpiresAt,
  });

  factory BackendUser.fromJson(Map<String, dynamic> json) {
    String? photoUrl = json['photo_url'] as String?;
    if (photoUrl != null) {
      if (photoUrl.isEmpty) {
        photoUrl = null;
      } else if (photoUrl.startsWith('/')) {
        photoUrl = '${ApiConfig.baseUrl}$photoUrl';
      }
    }

    return BackendUser(
      userId: json['user_id'] as String,
      email: json['email'] as String,
      displayName: json['display_name'] as String,
      photoUrl: photoUrl,
      phone: json['phone'] as String?,
      gender: json['gender'] as String?,
      isRider: json['is_rider'] as bool? ?? false,
      onboardingCompleted: json['onboarding_completed'] as bool? ?? false,
      status: _parseStatus(json['status'] as String?),
      banReason: json['ban_reason'] as String?,
      suspensionExpiresAt: json['suspension_expires_at'] != null
          ? TimeUtils.parseUtc(json['suspension_expires_at'] as String)
          : null,
    );
  }

  static UserStatus _parseStatus(String? status) {
    switch (status) {
      case 'suspended':
        return UserStatus.suspended;
      case 'banned':
        return UserStatus.banned;
      default:
        return UserStatus.active;
    }
  }
}

/// Authentication provider
class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  final ApiService _apiService;
  final WebSocketService _webSocketService; // NEW

  StreamSubscription<User?>? _authSubscription;

  bool _isLoading = true;
  bool _isAuthenticated = false;
  bool _isUnsupportedDomain = false;
  bool _hasNetworkError = false;
  // System Config

  User? _firebaseUser;
  BackendUser? _backendUser;
  String? _error;

  AuthProvider(this._authService, this._apiService, this._webSocketService) {
    _apiService.setAuthService(_authService);
    _initErrorHelper();
    _init();
  }

  void _initErrorHelper() {
    ErrorHelper.getUserInfo = () {
      if (_backendUser != null) {
        return {
          'user_id': _backendUser!.userId,
          'email': _backendUser!.email,
          'display_name': _backendUser!.displayName,
        };
      } else if (_firebaseUser != null) {
        return {'user_id': _firebaseUser!.uid, 'email': _firebaseUser!.email};
      }
      return {};
    };

    ErrorHelper.getAuthToken = () async {
      return await _authService.getIdToken();
    };
  }

  // Getters
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  bool get isUnsupportedDomain => _isUnsupportedDomain;
  bool get hasNetworkError => _hasNetworkError;

  bool get isOnboarded => _backendUser?.onboardingCompleted ?? false;
  bool get isBanned => _backendUser?.status == UserStatus.banned;
  bool get isSuspended => _backendUser?.status == UserStatus.suspended;
  User? get firebaseUser => _firebaseUser;
  BackendUser? get user => _backendUser;
  String? get error => _error;

  /// Initialize auth state
  Future<void> _init() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _authService.initialize();
      _authSubscription = _authService.authStateChanges.listen(
        _onAuthStateChanged,
      );
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }

    // Listen for real-time account status changes (ban/suspension/maintenance)
    _webSocketService.on('user_banned', _onBanned);
    _webSocketService.on('user_suspended', _onSuspended);
    _webSocketService.on('maintenance_mode', _onMaintenance);
  }

  /// Handle real-time ban event - immediately redirect
  void _onBanned(Map<String, dynamic> data) {
    debugPrint('🚫 BANNED event received: $data');
    _handleSystemRedirect('/banned');
  }

  /// Handle real-time suspension event - immediately redirect
  void _onSuspended(Map<String, dynamic> data) {
    debugPrint('⏸️ SUSPENDED event received: $data');
    _handleSystemRedirect('/suspended');
  }

  /// Handle maintenance mode event - immediately redirect
  void _onMaintenance(Map<String, dynamic> data) {
    debugPrint('🔧 MAINTENANCE event received: $data');
    _handleSystemRedirect('/maintenance');
  }

  /// Immediately redirect to system screen
  void _handleSystemRedirect(String path) {
    // Import and navigate directly
    final context = _getNavigatorContext();
    if (context != null) {
      debugPrint('Immediately redirecting to $path');
      GoRouter.of(context).go(path);
    }
    // Also refresh to update local state
    refreshUser();
  }

  /// Get navigator context for immediate redirects
  BuildContext? _getNavigatorContext() {
    try {
      return AppRouter.rootNavigatorKey.currentContext;
    } catch (_) {
      return null;
    }
  }

  /// Handle auth state changes
  Future<void> _onAuthStateChanged(User? user) async {
    _firebaseUser = user;

    if (user == null) {
      _isAuthenticated = false;
      _backendUser = null;
      _webSocketService.disconnect(); // Disconnect on logout/session end
    } else {
      await _verifyWithBackend();
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Verify token with backend and get user data
  Future<void> _verifyWithBackend() async {
    try {
      final token = await _authService.getIdToken();
      if (token == null) {
        _isAuthenticated = false;
        _isUnsupportedDomain = false;
        _hasNetworkError = false;
        return;
      }

      final response = await _apiService.post<Map<String, dynamic>>(
        '/auth/verify',
        body: {'id_token': token},
        withAuth: false,
      );

      if (response.success && response.data != null) {
        _isAuthenticated = true;
        _isUnsupportedDomain = false;
        _hasNetworkError = false;
        debugPrint(
          'AUTH: Backend verified. Photo: ${response.data!['photo_url']}',
        );
        _backendUser = BackendUser.fromJson(response.data!);
        _error = null;

        // Connect WebSocket immediately after verification
        _webSocketService.connect(token);
      } else {
        _isAuthenticated = false;
        _error = response.error;

        // Check for network error (status code 0 indicates connection failure)
        if (response.statusCode == 0) {
          _hasNetworkError = true;
          _isUnsupportedDomain = false;
        } else if (response.statusCode == 403) {
          // Check for domain validation error using errorCode
          _hasNetworkError = false;
          if (response.errorCode == 'invalid_domain') {
            _isUnsupportedDomain = true;
          } else {
            _isUnsupportedDomain = false;
          }
        } else {
          _hasNetworkError = false;
          _isUnsupportedDomain = false;
        }
      }
    } catch (e) {
      _isAuthenticated = false;
      _isUnsupportedDomain = false;
      _hasNetworkError = true;
      // Sanitize error for user
      _error = 'Connection failed. Please check your internet.';
    }
  }

  /// Sign in with Google
  Future<bool> signInWithGoogle() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    final result = await _authService.signInWithGoogle();

    if (!result.success) {
      _error = result.error;
      // Check if domain validation failed in auth service
      if (result.errorCode == 'invalid_domain') {
        _isUnsupportedDomain = true;
      }
      _isLoading = false;
      notifyListeners();
      return false;
    }

    // Explicitly verify to ensure state is updated and loading cleared,
    // handling cases where authStateChanges might not fire (e.g. re-login).
    _firebaseUser = result.user;
    await _verifyWithBackend();

    _isLoading = false;
    notifyListeners();
    return true;
  }

  /// Complete onboarding
  Future<bool> completeOnboarding({
    required String phone,
    required String? gender,
    required bool safetyConsent,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    final response = await _apiService.post<Map<String, dynamic>>(
      '/auth/onboard',
      body: {'phone': phone, 'gender': gender, 'safety_consent': safetyConsent},
    );

    if (response.success) {
      // Refresh user data
      await _verifyWithBackend();
      _isLoading = false;
      notifyListeners();
      return true;
    } else {
      _error = response.error;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Sign out
  Future<void> signOut() async {
    await _authService.signOut();
    _isAuthenticated = false;
    _isUnsupportedDomain = false;
    _hasNetworkError = false;
    _backendUser = null;
    _error = null;
    _webSocketService.disconnect(); // Explicit disconnect
    notifyListeners();
  }

  /// Refresh user data
  Future<void> refreshUser() async {
    await _verifyWithBackend();
    notifyListeners();
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }
}
