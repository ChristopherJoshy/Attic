/// ORIX App Router
///
/// GoRouter configuration with authentication guards and smooth transitions.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import 'page_transitions.dart';
import '../../features/splash/splash_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/onboarding_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/ride/create_ride_screen.dart';
import '../../features/ride/matching_screen.dart';
import '../../features/groups/group_detail_screen.dart';
import '../../features/groups/group_chat_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/profile/edit_profile_screen.dart';
import '../../features/profile/rider_setup_screen.dart';
import '../../features/profile/about_screen.dart';
import '../../features/ride/ride_history_screen.dart';
import '../../features/ride/location_picker_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/notifications/notification_preferences_screen.dart';
import '../../features/system/maintenance_screen.dart';
import '../../features/system/suspended_screen.dart';
import '../../features/system/banned_screen.dart';
import '../../features/profile/help_support/help_support_screen.dart';
import '../../features/profile/help_support/create_ticket_screen.dart';
import '../../features/profile/help_support/ticket_list_screen.dart';
import '../../features/profile/help_support/ticket_chat_screen.dart';
import '../../features/profile/help_support/faq_screen.dart';
import '../../features/profile/terms_screen.dart';

import '../../features/system/network_issue_screen.dart';
import '../../features/system/unsupported_domain_screen.dart';
import '../../features/groups/my_group_screen.dart';

/// Route names
class Routes {
  Routes._();

  static const splash = 'splash';
  static const login = 'login';
  static const onboarding = 'onboarding';
  static const home = 'home';
  static const createRide = 'createRide';
  static const matching = 'matching';
  static const groupDetail = 'groupDetail';
  static const groupChat = 'groupChat';
  static const profile = 'profile';
  static const editProfile = 'editProfile';
  static const riderSetup = 'riderSetup';
  static const rideHistory = 'rideHistory';
  static const notifications = 'notifications';
  static const notificationPreferences = 'notificationPreferences';
  static const maintenance = 'maintenance';
  static const suspended = 'suspended';
  static const banned = 'banned';

  static const networkIssue = 'networkIssue';
  static const unsupportedDomain = 'unsupportedDomain';
  static const myGroup = 'myGroup';
  static const about = 'about';
  static const helpSupport = 'helpSupport';
  static const faq = 'faq';
  static const createTicket = 'createTicket';
  static const ticketList = 'ticketList';
  static const ticketChat = 'ticketChat';
  static const termsAndConditions = 'termsAndConditions';
}

/// Route paths
class RoutePaths {
  RoutePaths._();

  static const splash = '/';
  static const login = '/login';
  static const onboarding = '/onboarding';
  static const home = '/home';
  static const createRide = '/ride/create';
  static const matching = '/ride/matching';
  static const groupDetail = '/groups/:groupId';
  static const myGroup = '/my-group';
  static const groupChat = '/groups/:groupId/chat';
  static const profile = '/profile';
  static const editProfile = '/profile/edit';
  static const riderSetup = '/profile/rider';
  static const rideHistory = '/history';
  static const locationPicker = '/picker';
  static const notifications = '/notifications';
  static const notificationPreferences = '/notifications/preferences';
  static const maintenance = '/maintenance';
  static const suspended = '/suspended';
  static const banned = '/banned';

  static const networkIssue = '/network-issue';
  static const unsupportedDomain = '/unsupported-domain';
  static const about = '/about';
  static const helpSupport = '/profile/support';
  static const faq = '/profile/support/faq';
  static const createTicket = '/profile/support/create';
  static const ticketList = '/profile/support/tickets';
  static const ticketChat = '/profile/support/tickets/:ticketId';
  static const termsAndConditions = '/profile/terms';
}

/// App router configuration
class AppRouter {
  AppRouter._();

  static final GlobalKey<NavigatorState> rootNavigatorKey =
      GlobalKey<NavigatorState>();

  static GoRouter router(AuthProvider authProvider) {
    return GoRouter(
      navigatorKey: rootNavigatorKey,
      initialLocation: RoutePaths.splash,
      refreshListenable: authProvider,
      redirect: (context, state) => _redirect(authProvider, state),
      routes: [
        // Splash - fade in
        GoRoute(
          name: Routes.splash,
          path: RoutePaths.splash,
          pageBuilder: (context, state) => FadeTransitionPage(
            key: state.pageKey,
            child: const SplashScreen(),
          ),
        ),

        // Auth - scale transition for important screens
        GoRoute(
          name: Routes.login,
          path: RoutePaths.login,
          pageBuilder: (context, state) => ScaleTransitionPage(
            key: state.pageKey,
            child: const LoginScreen(),
          ),
        ),
        GoRoute(
          name: Routes.onboarding,
          path: RoutePaths.onboarding,
          pageBuilder: (context, state) => SlideUpTransitionPage(
            key: state.pageKey,
            child: const OnboardingScreen(),
          ),
        ),

        // Main - fade for home (feels instant)
        GoRoute(
          name: Routes.home,
          path: RoutePaths.home,
          pageBuilder: (context, state) =>
              FadeTransitionPage(key: state.pageKey, child: const HomeScreen()),
        ),

        // Ride - slide transitions
        GoRoute(
          name: Routes.createRide,
          path: RoutePaths.createRide,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const CreateRideScreen(),
          ),
        ),
        GoRoute(
          name: Routes.matching,
          path: RoutePaths.matching,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const MatchingScreen(),
          ),
        ),

        // Groups
        GoRoute(
          name: Routes.groupDetail,
          path: RoutePaths.groupDetail,
          pageBuilder: (context, state) {
            final groupId = state.pathParameters['groupId']!;
            return SlideTransitionPage(
              key: state.pageKey,
              child: GroupDetailScreen(groupId: groupId),
            );
          },
          routes: [
            GoRoute(
              name: Routes.groupChat,
              path: 'chat',
              pageBuilder: (context, state) {
                final groupId = state.pathParameters['groupId']!;
                return SlideTransitionPage(
                  key: state.pageKey,
                  child: GroupChatScreen(groupId: groupId),
                );
              },
            ),
          ],
        ),
        GoRoute(
          name: Routes.myGroup,
          path: RoutePaths.myGroup,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const MyGroupScreen(),
          ),
        ),

        // Profile - slide transitions
        GoRoute(
          name: Routes.profile,
          path: RoutePaths.profile,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const ProfileScreen(),
          ),
        ),
        GoRoute(
          name: Routes.editProfile,
          path: RoutePaths.editProfile,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const EditProfileScreen(),
          ),
        ),
        GoRoute(
          name: Routes.riderSetup,
          path: RoutePaths.riderSetup,
          pageBuilder: (context, state) => SlideUpTransitionPage(
            key: state.pageKey,
            child: const RiderSetupScreen(),
          ),
        ),
        GoRoute(
          name: Routes.about,
          path: RoutePaths.about,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const AboutScreen(),
          ),
        ),
        GoRoute(
          name: Routes.helpSupport,
          path: RoutePaths.helpSupport,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const HelpSupportScreen(),
          ),
        ),
        GoRoute(
          name: Routes.faq,
          path: RoutePaths.faq,
          pageBuilder: (context, state) =>
              SlideTransitionPage(key: state.pageKey, child: const FAQScreen()),
        ),
        GoRoute(
          name: Routes.createTicket,
          path: RoutePaths.createTicket,
          pageBuilder: (context, state) => SlideUpTransitionPage(
            key: state.pageKey,
            child: CreateTicketScreen(type: state.extra as String?),
          ),
        ),
        GoRoute(
          name: Routes.ticketList,
          path: RoutePaths.ticketList,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const TicketListScreen(),
          ),
        ),
        GoRoute(
          name: Routes.ticketChat,
          path: RoutePaths.ticketChat,
          pageBuilder: (context, state) {
            final ticketId = state.pathParameters['ticketId']!;
            return SlideTransitionPage(
              key: state.pageKey,
              child: TicketChatScreen(ticketId: ticketId),
            );
          },
        ),
        GoRoute(
          name: Routes.termsAndConditions,
          path: RoutePaths.termsAndConditions,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const TermsScreen(),
          ),
        ),
        GoRoute(
          name: Routes.rideHistory,
          path: RoutePaths.rideHistory,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const RideHistoryScreen(),
          ),
        ),
        GoRoute(
          path: RoutePaths.locationPicker,
          pageBuilder: (context, state) => SlideUpTransitionPage(
            key: state.pageKey,
            child: const LocationPickerScreen(),
          ),
        ),

        // Notifications
        GoRoute(
          name: Routes.notifications,
          path: RoutePaths.notifications,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const NotificationsScreen(),
          ),
        ),
        GoRoute(
          name: Routes.notificationPreferences,
          path: RoutePaths.notificationPreferences,
          pageBuilder: (context, state) => SlideTransitionPage(
            key: state.pageKey,
            child: const NotificationPreferencesScreen(),
          ),
        ),

        // System - fade for system screens
        GoRoute(
          name: Routes.maintenance,
          path: RoutePaths.maintenance,
          pageBuilder: (context, state) => FadeTransitionPage(
            key: state.pageKey,
            child: const MaintenanceScreen(),
          ),
        ),
        GoRoute(
          name: Routes.suspended,
          path: RoutePaths.suspended,
          pageBuilder: (context, state) => FadeTransitionPage(
            key: state.pageKey,
            child: const SuspendedScreen(),
          ),
        ),
        GoRoute(
          name: Routes.banned,
          path: RoutePaths.banned,
          pageBuilder: (context, state) => FadeTransitionPage(
            key: state.pageKey,
            child: const BannedScreen(),
          ),
        ),
        GoRoute(
          name: Routes.networkIssue,
          path: RoutePaths.networkIssue,
          pageBuilder: (context, state) => FadeTransitionPage(
            key: state.pageKey,
            child: const NetworkIssueScreen(),
          ),
        ),
        GoRoute(
          name: Routes.unsupportedDomain,
          path: RoutePaths.unsupportedDomain,
          pageBuilder: (context, state) => FadeTransitionPage(
            key: state.pageKey,
            child: const UnsupportedDomainScreen(),
          ),
        ),
      ],
      errorBuilder: (context, state) => Scaffold(
        body: Center(child: Text('Page not found: ${state.uri.path}')),
      ),
    );
  }

  /// Redirect logic for authentication
  static String? _redirect(AuthProvider auth, GoRouterState state) {
    final path = state.uri.path;

    // System screens bypass normal auth flow
    if (path == RoutePaths.maintenance ||
        path == RoutePaths.suspended ||
        path == RoutePaths.banned ||
        path == RoutePaths.networkIssue ||
        path == RoutePaths.unsupportedDomain) {
      return null;
    }

    // Still loading auth state
    if (auth.isLoading) {
      return null;
    }

    // Check for unsupported domain FIRST - applies even on login screen
    // This must come before login path bypass so users see the unsupported domain screen
    if (auth.isUnsupportedDomain) {
      return RoutePaths.unsupportedDomain;
    }

    // Check for network error during auth verification
    if (auth.hasNetworkError) {
      return RoutePaths.networkIssue;
    }

    // Check for banned/suspended status (requires authenticated user)
    if (auth.isBanned) {
      return RoutePaths.banned;
    }
    if (auth.isSuspended) {
      return RoutePaths.suspended;
    }

    // Not authenticated
    if (!auth.isAuthenticated) {
      // Allow splash and login
      if (path == RoutePaths.splash || path == RoutePaths.login) {
        return null;
      }
      return RoutePaths.login;
    }

    // Authenticated but needs onboarding
    if (!auth.isOnboarded) {
      if (path == RoutePaths.onboarding) {
        return null;
      }
      return RoutePaths.onboarding;
    }

    // Authenticated and onboarded
    if (path == RoutePaths.splash ||
        path == RoutePaths.login ||
        path == RoutePaths.onboarding) {
      return RoutePaths.home;
    }

    return null;
  }
}
