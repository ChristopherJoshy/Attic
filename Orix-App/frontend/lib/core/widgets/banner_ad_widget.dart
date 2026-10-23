/// Banner Ad Widget
///
/// Full-width adaptive banner ad for bottom placement.
/// Optimized to prevent double setState and unnecessary rebuilds.
library;

import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../services/ad_service.dart';
import '../utils/error_helper.dart';

class BannerAdWidget extends StatefulWidget {
  const BannerAdWidget({super.key});

  @override
  State<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends State<BannerAdWidget>
    with AutomaticKeepAliveClientMixin {
  BannerAd? _bannerAd;
  bool _isLoaded = false;
  bool _isLoading = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bannerAd == null && !_isLoading) {
      _loadAd();
    }
  }

  Future<void> _loadAd() async {
    if (_isLoading) return;
    _isLoading = true;

    final screenWidth = MediaQuery.of(context).size.width.truncate();

    final adSize = await AdSize.getAnchoredAdaptiveBannerAdSize(
      Orientation.portrait,
      screenWidth,
    );

    if (adSize == null || !mounted) {
      _isLoading = false;
      return;
    }

    try {
      final ad = await AdService().loadBannerAd(
        size: adSize,
        onAdLoaded: (ad) {
          // Only use callback if we haven't already set state
          if (mounted && !_isLoaded) {
            setState(() {
              _bannerAd = ad as BannerAd;
              _isLoaded = true;
            });
          }
        },
        onAdFailedToLoad: (ad, error) {
          _isLoading = false;
          // Ensure we dispose the ad that failed to load since we won't use it
          ad.dispose();
        },
      );

      // Ad loads synchronously in some cases - handle if callback didn't fire
      if (ad != null && mounted && !_isLoaded) {
        setState(() {
          _bannerAd = ad;
          _isLoaded = true;
        });
      }
    } catch (e) {
      ErrorHelper.logError(e, null, 'Banner ad load');
    } finally {
      _isLoading = false;
    }
  }

  @override
  void dispose() {
    _bannerAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    if (!_isLoaded || _bannerAd == null) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      width: double.infinity,
      height: _bannerAd!.size.height.toDouble(),
      child: AdWidget(ad: _bannerAd!),
    );
  }
}

/// Alias for SmallBannerAd - kept for backwards compatibility
class SmallBannerAd extends StatelessWidget {
  const SmallBannerAd({super.key});

  @override
  Widget build(BuildContext context) {
    return const BannerAdWidget();
  }
}
