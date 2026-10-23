/// Ad Service
///
/// Firebase AdMob integration for Banner, Interstitial, and App Open ads.
library;

import 'dart:io';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../utils/error_helper.dart';

class AdService {
  static final AdService _instance = AdService._internal();
  factory AdService() => _instance;
  AdService._internal();

  bool _initialized = false;
  // BannerAd? _bannerAd; // Removed as widget manages lifecycle
  InterstitialAd? _interstitialAd;
  AppOpenAd? _appOpenAd;
  bool _isShowingAppOpenAd = false;
  DateTime? _appOpenAdLoadTime;

  // ==========================================================================
  // AD UNIT IDs
  // ==========================================================================
  //
  // HOW TO GET YOUR AD UNIT IDs:
  //
  // 1. Go to https://admob.google.com/
  // 2. Sign in with your Google account
  // 3. Click "Apps" in the left sidebar
  // 4. Select your app (or add it if not exists)
  // 5. Click "Ad units" in the left sidebar
  // 6. Click "Add ad unit" button
  // 7. Choose the ad type (Banner, Interstitial, or App Open)
  // 8. Name your ad unit and configure settings
  // 9. Copy the Ad Unit ID (format: ca-app-pub-XXXXXXXX/YYYYYYYY)
  // 10. Replace the production IDs below with your IDs
  //
  // IMPORTANT: Keep using test IDs during development!
  // Only switch to production IDs when publishing to store.
  // ==========================================================================

  // --------------------------------------------------------------------------
  // BANNER AD IDs
  // --------------------------------------------------------------------------
  // PRODUCTION Ad Unit IDs
  static const String _androidBannerAdUnitId =
      'ca-app-pub-8560243090052250/6046468283';
  static const String _iosBannerAdUnitId =
      'ca-app-pub-8560243090052250/6046468283';

  static String get bannerAdUnitId {
    if (Platform.isAndroid) return _androidBannerAdUnitId;
    if (Platform.isIOS) return _iosBannerAdUnitId;
    return '';
  }

  // --------------------------------------------------------------------------
  // INTERSTITIAL AD IDs
  // --------------------------------------------------------------------------
  static const String _androidInterstitialAdUnitId =
      'ca-app-pub-8560243090052250/6122489906';
  static const String _iosInterstitialAdUnitId =
      'ca-app-pub-8560243090052250/6122489906';

  static String get interstitialAdUnitId {
    if (Platform.isAndroid) return _androidInterstitialAdUnitId;
    if (Platform.isIOS) return _iosInterstitialAdUnitId;
    return '';
  }

  // --------------------------------------------------------------------------
  // APP OPEN AD IDs
  // --------------------------------------------------------------------------
  static const String _androidAppOpenAdUnitId =
      'ca-app-pub-8560243090052250/8884384614';
  static const String _iosAppOpenAdUnitId =
      'ca-app-pub-8560243090052250/8884384614';

  static String get appOpenAdUnitId {
    if (Platform.isAndroid) return _androidAppOpenAdUnitId;
    if (Platform.isIOS) return _iosAppOpenAdUnitId;
    return '';
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  Future<void> initialize() async {
    if (_initialized) return;

    try {
      await MobileAds.instance.initialize();

      // Set strict content rating to filtered out NSFW/Mature content
      await MobileAds.instance.updateRequestConfiguration(
        RequestConfiguration(
          maxAdContentRating: MaxAdContentRating.g,
          tagForChildDirectedTreatment: TagForChildDirectedTreatment.no,
          tagForUnderAgeOfConsent: TagForUnderAgeOfConsent.no,
        ),
      );

      _initialized = true;

      // Preload app open ad
      loadAppOpenAd();
    } catch (e) {
      ErrorHelper.logError(e, null, 'AdMob initialization');
    }
  }

  // ==========================================================================
  // BANNER ADS
  // ==========================================================================

  Future<BannerAd?> loadBannerAd({
    AdSize size = AdSize.banner,
    void Function(Ad)? onAdLoaded,
    void Function(Ad, LoadAdError)? onAdFailedToLoad,
  }) async {
    if (!_initialized) await initialize();

    final bannerAd = BannerAd(
      adUnitId: bannerAdUnitId,
      size: size,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (ad) {
          onAdLoaded?.call(ad);
        },
        onAdFailedToLoad: (ad, error) {
          // Do NOT dispose here immediately if we want to bubble up the error safely
          // or at least ensure no other async ops try to use it.
          // However, standard practice is to dispose.
          // The error "Ad with id ... not available" usually means it was ALREADY disposed
          // or never fully created on native side before failure.

          ad.dispose();
          onAdFailedToLoad?.call(ad, error);
        },
        onAdOpened: (ad) {},
        onAdClosed: (ad) {},
      ),
    );

    await bannerAd.load();
    // Do not store reference here as widget manages lifecycle
    return bannerAd;
  }

  // ==========================================================================
  // INTERSTITIAL ADS
  // ==========================================================================

  Future<void> loadInterstitialAd() async {
    if (!_initialized) await initialize();

    await InterstitialAd.load(
      adUnitId: interstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialAd = ad;
          _interstitialAd!.fullScreenContentCallback =
              FullScreenContentCallback(
                onAdDismissedFullScreenContent: (ad) {
                  ad.dispose();
                  _interstitialAd = null;
                  loadInterstitialAd(); // Preload next
                },
                onAdFailedToShowFullScreenContent: (ad, error) {
                  ad.dispose();
                  _interstitialAd = null;
                },
              );
        },
        onAdFailedToLoad: (error) {
          _interstitialAd = null;
        },
      ),
    );
  }

  Future<bool> showInterstitialAd() async {
    if (_interstitialAd == null) {
      return false;
    }

    await _interstitialAd!.show();
    return true;
  }

  bool get isInterstitialReady => _interstitialAd != null;

  // ==========================================================================
  // APP OPEN ADS
  // ==========================================================================

  Future<void> loadAppOpenAd() async {
    if (!_initialized) await initialize();

    await AppOpenAd.load(
      adUnitId: appOpenAdUnitId,
      request: const AdRequest(),
      adLoadCallback: AppOpenAdLoadCallback(
        onAdLoaded: (ad) {
          _appOpenAd = ad;
          _appOpenAdLoadTime = DateTime.now();
        },
        onAdFailedToLoad: (error) {
          _appOpenAd = null;
        },
      ),
    );
  }

  /// Shows app open ad when app comes to foreground
  /// Call this from your app lifecycle observer
  Future<bool> showAppOpenAd() async {
    if (_appOpenAd == null) {
      loadAppOpenAd(); // Try to load for next time
      return false;
    }

    // Don't show if already showing
    if (_isShowingAppOpenAd) return false;

    // Check if ad is expired (4 hours max)
    if (_appOpenAdLoadTime != null) {
      final elapsed = DateTime.now().difference(_appOpenAdLoadTime!);
      if (elapsed.inHours >= 4) {
        _appOpenAd?.dispose();
        _appOpenAd = null;
        loadAppOpenAd();
        return false;
      }
    }

    _isShowingAppOpenAd = true;

    _appOpenAd!.fullScreenContentCallback = FullScreenContentCallback(
      onAdShowedFullScreenContent: (ad) {},
      onAdDismissedFullScreenContent: (ad) {
        _isShowingAppOpenAd = false;
        ad.dispose();
        _appOpenAd = null;
        loadAppOpenAd(); // Preload next
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        _isShowingAppOpenAd = false;
        ad.dispose();
        _appOpenAd = null;
        loadAppOpenAd();
      },
    );

    await _appOpenAd!.show();
    return true;
  }

  bool get isAppOpenAdReady => _appOpenAd != null;

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  void dispose() {
    // _bannerAd?.dispose(); // Managed by widgets
    _interstitialAd?.dispose();
    _appOpenAd?.dispose();
    // _bannerAd = null;
    _interstitialAd = null;
    _appOpenAd = null;
  }
}
