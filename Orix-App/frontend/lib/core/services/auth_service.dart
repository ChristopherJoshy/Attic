/// Authentication Service
///
/// Handles Firebase authentication and Google Sign-In (v7.x API).
library;

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'domain_config_service.dart';

/// Result of authentication
class AuthResult {
  final bool success;
  final String? error;
  final String? errorCode;
  final User? user;

  AuthResult({required this.success, this.error, this.errorCode, this.user});

  factory AuthResult.success(User user) =>
      AuthResult(success: true, user: user);

  factory AuthResult.failure(String error, {String? code}) =>
      AuthResult(success: false, error: error, errorCode: code);
}

/// Authentication service using google_sign_in v7 API
class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  DomainConfigService? _domainConfigService;

  bool _initialized = false;
  StreamSubscription<GoogleSignInAuthenticationEvent>? _authEventSubscription;
  final Completer<void> _initCompleter = Completer<void>();

  /// Current Firebase user
  User? get currentUser => _auth.currentUser;

  /// Stream of auth state changes
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// Check if user is signed in
  bool get isSignedIn => currentUser != null;

  /// Get current user's email
  String? get userEmail => currentUser?.email;

  /// Get Firebase ID token for backend authentication
  Future<String?> getIdToken({bool forceRefresh = false}) async {
    try {
      return await currentUser?.getIdToken(forceRefresh);
    } catch (e) {
      return null;
    }
  }

  /// Initialize Google Sign-In (must be called once at app startup)
  Future<void> initialize() async {
    if (_initialized) return;

    try {
      // Server client ID from google-services.json (web client type 3)
      const serverClientId =
          '459947531477-pj2b20unfl7mpbdvkheg7g469tgt7i87.apps.googleusercontent.com';

      await GoogleSignIn.instance.initialize(serverClientId: serverClientId);
      _initialized = true;

      // Listen for authentication events
      _authEventSubscription = GoogleSignIn.instance.authenticationEvents
          .listen(_handleAuthEvent, onError: _handleAuthError);

      // NOTE: Removed attemptLightweightAuthentication() call
      // This was triggering the Google account picker popup on app startup
      // which confused users. The popup should only appear when user
      // explicitly taps "Continue with Google" button.

      if (!_initCompleter.isCompleted) {
        _initCompleter.complete();
      }
    } catch (e) {
      if (!_initCompleter.isCompleted) {
        _initCompleter.completeError(e);
      }
    }
  }

  void _handleAuthEvent(GoogleSignInAuthenticationEvent event) {
    // Events handled via Firebase Auth state changes
    // The GoogleSignInAccount is used to create Firebase credential
  }

  void _handleAuthError(Object error) {
    // Authentication errors are handled in signInWithGoogle
  }

  /// Ensure initialization is complete
  Future<void> _ensureInitialized() async {
    if (!_initialized) {
      await initialize();
    }
    await _initCompleter.future;
  }

  /// Set domain config service for dynamic domain validation
  void setDomainConfigService(DomainConfigService service) {
    _domainConfigService = service;
  }

  /// Check if email domain is allowed using DomainConfigService
  bool _isEmailDomainAllowed(String email) {
    if (_domainConfigService != null) {
      return _domainConfigService!.isEmailDomainAllowed(email);
    }
    // Fallback to hardcoded domain if service not available
    const fallbackDomain = 'sjcetpalai.ac.in';
    final domain = email.split('@').last.toLowerCase();
    return domain == fallbackDomain || domain.endsWith('.$fallbackDomain');
  }

  /// Sign in with Google (v7 API)
  Future<AuthResult> signInWithGoogle() async {
    try {
      await _ensureInitialized();

      // Check if authenticate is supported on this platform
      if (!GoogleSignIn.instance.supportsAuthenticate()) {
        return AuthResult.failure(
          'Google Sign-In not supported on this platform',
          code: 'unsupported_platform',
        );
      }

      // Trigger the Google Sign-In flow
      final GoogleSignInAccount googleUser = await GoogleSignIn.instance
          .authenticate();

      // Validate email domain before proceeding
      final email = googleUser.email;
      if (!_isEmailDomainAllowed(email)) {
        // Sign out the Google account since domain is not allowed
        await GoogleSignIn.instance.signOut();
        return AuthResult.failure(
          'Please use your college email',
          code: 'invalid_domain',
        );
      }

      // Get authentication tokens (v7 uses authentication getter)
      final String? idToken = googleUser.authentication.idToken;

      if (idToken == null) {
        return AuthResult.failure('Failed to get ID token');
      }

      // Create Firebase credential using ID token
      // Note: v7 separates authentication from authorization
      // For Firebase Auth, we only need the idToken
      final credential = GoogleAuthProvider.credential(idToken: idToken);

      // Sign in to Firebase
      final userCredential = await _auth.signInWithCredential(credential);

      if (userCredential.user == null) {
        return AuthResult.failure('Failed to sign in to Firebase');
      }

      return AuthResult.success(userCredential.user!);
    } on GoogleSignInException catch (e) {
      // Handle specific Google Sign-In exceptions
      if (e.code == GoogleSignInExceptionCode.canceled) {
        return AuthResult.failure('Sign-in cancelled', code: 'cancelled');
      }
      return AuthResult.failure(
        e.description ?? 'Google Sign-In failed',
        code: e.code.toString(),
      );
    } on FirebaseAuthException catch (e) {
      return AuthResult.failure(
        e.message ?? 'Authentication failed',
        code: e.code,
      );
    } catch (e) {
      // Log for debugging but show user-friendly message
      return AuthResult.failure('Sign-in failed. Please try again.');
    }
  }

  /// Verify phone number using Firebase Auth
  Future<void> verifyPhoneNumber({
    required String phoneNumber,
    required PhoneVerificationCompleted onVerificationCompleted,
    required PhoneVerificationFailed onVerificationFailed,
    required PhoneCodeSent onCodeSent,
    required PhoneCodeAutoRetrievalTimeout onCodeAutoRetrievalTimeout,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: onVerificationCompleted,
      verificationFailed: onVerificationFailed,
      codeSent: onCodeSent,
      codeAutoRetrievalTimeout: onCodeAutoRetrievalTimeout,
      timeout: const Duration(seconds: 60),
    );
  }

  /// Sign out from both Firebase and Google
  Future<void> signOut() async {
    await _auth.signOut();
    if (_initialized) {
      await GoogleSignIn.instance.signOut();
    }
  }

  /// Disconnect - revokes access and signs out
  Future<void> disconnect() async {
    await _auth.signOut();
    if (_initialized) {
      await GoogleSignIn.instance.disconnect();
    }
  }

  /// Delete account
  Future<bool> deleteAccount() async {
    try {
      await currentUser?.delete();
      if (_initialized) {
        await GoogleSignIn.instance.disconnect();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Dispose resources
  void dispose() {
    _authEventSubscription?.cancel();
  }
}
