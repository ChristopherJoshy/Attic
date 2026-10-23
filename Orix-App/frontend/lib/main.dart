/// ORIX App - Main Entry Point
///
/// College ride coordination platform for safe, affordable commuting.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';

import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'core/services/auth_service.dart';
import 'core/services/api_service.dart';
import 'core/services/notification_service.dart';
import 'core/services/websocket_service.dart';
import 'core/services/domain_config_service.dart';
import 'core/services/ad_service.dart';
import 'core/services/app_version_service.dart';
import 'core/services/map_service.dart';
import 'core/providers/auth_provider.dart';
import 'core/providers/user_provider.dart';
import 'core/providers/ride_provider.dart';
import 'core/providers/group_provider.dart';
import 'core/providers/notification_provider.dart';
import 'core/providers/connectivity_provider.dart';
import 'features/groups/catch_your_ride_screen.dart';
import 'firebase_options.dart';

final adService = AdService();

/// Initialize map service for preloading
Future<void> _initializeMapService() async {
  try {
    final mapService = MapService();
    await mapService.initialize();
    await mapService.preloadDefaultLocations();
    debugPrint('MapService initialized and preloaded');
  } catch (e) {
    debugPrint('Error initializing MapService: $e');
    // Don't fail app startup if maps fail
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock orientation to portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Set system UI style for dark theme
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF010101),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize Firebase first (required for other services)
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Initialize services (instances created immediately)
  final authService = AuthService();
  final apiService = ApiService();
  final notificationService = NotificationService();
  final webSocketService = WebSocketService();
  final domainConfigService = DomainConfigService();
  final appVersionService = AppVersionService(apiService);

  // Run initializations in parallel for faster startup
  await Future.wait([
    authService.initialize(),
    notificationService.initialize(),
    domainConfigService.initialize(),
    _initializeMapService(), // Preload maps for smoother experience
  ]);
  authService.setDomainConfigService(domainConfigService);

  // Initialize AdMob lazily (don't block app launch)
  // adService.initialize(); // DISABLED: Crashing on Emulator

  // Set up FCM token refresh callback to sync with backend
  // Handled internally by UserProvider now

  runApp(
    OrixApp(
      authService: authService,
      apiService: apiService,
      notificationService: notificationService,
      webSocketService: webSocketService,
      domainConfigService: domainConfigService,
      appVersionService: appVersionService,
    ),
  );
}

/// Root application widget
class OrixApp extends StatefulWidget {
  final AuthService authService;
  final ApiService apiService;
  final NotificationService notificationService;
  final WebSocketService webSocketService;
  final DomainConfigService domainConfigService;
  final AppVersionService appVersionService;

  const OrixApp({
    super.key,
    required this.authService,
    required this.apiService,
    required this.notificationService,
    required this.webSocketService,
    required this.domainConfigService,
    required this.appVersionService,
  });

  @override
  State<OrixApp> createState() => _OrixAppState();
}

class _OrixAppState extends State<OrixApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Preload interstitial ad
    // adService.loadInterstitialAd(); // DISABLED: Crashing on Emulator
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Show app open ad when returning to foreground
      // adService.showAppOpenAd(); // DISABLED: Crashing on Emulator
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // Services
        Provider<AuthService>.value(value: widget.authService),
        Provider<ApiService>.value(value: widget.apiService),
        Provider<NotificationService>.value(value: widget.notificationService),
        Provider<WebSocketService>.value(value: widget.webSocketService),
        Provider<DomainConfigService>.value(value: widget.domainConfigService),
        Provider<AppVersionService>.value(value: widget.appVersionService),
        // Connectivity monitoring
        ChangeNotifierProvider(create: (_) => ConnectivityProvider()),

        // State Providers
        ChangeNotifierProvider(
          create: (_) => AuthProvider(
            widget.authService,
            widget.apiService,
            widget.webSocketService,
          ),
        ),
        ChangeNotifierProxyProvider<AuthProvider, UserProvider>(
          create: (_) =>
              UserProvider(widget.apiService, widget.notificationService),
          update: (_, auth, user) => user!..updateAuth(auth),
        ),
        ChangeNotifierProvider(create: (_) => RideProvider(widget.apiService)),
        ChangeNotifierProvider(
          create: (_) =>
              GroupProvider(widget.apiService, widget.webSocketService),
        ),
        ChangeNotifierProvider(
          create: (_) => NotificationProvider(
            widget.apiService,
            widget.notificationService,
          ),
        ),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          return _AlarmListener(
            child: MaterialApp.router(
              title: 'ORIX',
              debugShowCheckedModeBanner: false,
              theme: AppTheme.darkTheme,
              darkTheme: AppTheme.darkTheme,
              themeMode: ThemeMode.dark,
              routerConfig: AppRouter.router(authProvider),
            ),
          );
        },
      ),
    );
  }
}

/// Widget that listens for pending ride alarms and shows them
class _AlarmListener extends StatefulWidget {
  final Widget child;

  const _AlarmListener({required this.child});

  @override
  State<_AlarmListener> createState() => _AlarmListenerState();
}

class _AlarmListenerState extends State<_AlarmListener> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _listenForAlarms();
    });
  }

  void _listenForAlarms() {
    final notificationProvider = Provider.of<NotificationProvider>(
      context,
      listen: false,
    );
    notificationProvider.addListener(_handlePendingAlarm);

    // Also check if notification service has pending alarm data (from tapping notification)
    _checkNotificationServicePendingAlarm();
  }

  void _checkNotificationServicePendingAlarm() async {
    // Wait a moment for notification service to be ready
    await Future.delayed(const Duration(milliseconds: 500));

    if (!mounted) return;

    final notificationService = Provider.of<NotificationService?>(
      context,
      listen: false,
    );
    final notificationProvider = Provider.of<NotificationProvider>(
      context,
      listen: false,
    );

    final pending = notificationService?.pendingAlarmData;
    if (pending != null) {
      notificationProvider.setPendingAlarmFromService(
        groupId: pending['group_id'] ?? '',
        rideTime: pending['ride_time'] ?? '',
        pickupSummary: pending['pickup_summary'] ?? '',
      );
      notificationService?.clearPendingAlarmData();
    }

    if (!mounted) return;
    _handlePendingAlarm();
  }

  void _handlePendingAlarm() {
    final notificationProvider = Provider.of<NotificationProvider>(
      context,
      listen: false,
    );

    if (notificationProvider.pendingAlarmGroupId != null && mounted) {
      // Import and show the alarm
      showCatchYourRideAlarm(
        context: context,
        groupId: notificationProvider.pendingAlarmGroupId!,
        rideTime: notificationProvider.pendingAlarmRideTime ?? '',
        pickupSummary: notificationProvider.pendingAlarmPickupSummary ?? '',
      ).then((_) {
        if (mounted) {
          notificationProvider.clearPendingAlarm();
        }
      });
    }
  }

  @override
  void dispose() {
    final notificationProvider = Provider.of<NotificationProvider>(
      context,
      listen: false,
    );
    notificationProvider.removeListener(_handlePendingAlarm);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
