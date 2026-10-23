/// Domain Configuration Service
///
/// Fetches and caches allowed college domains from the backend.
library;

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config/api_config.dart';
import '../utils/error_helper.dart';

/// Information about a supported college domain
class DomainInfo {
  final String domain;
  final String name;

  const DomainInfo({required this.domain, required this.name});

  factory DomainInfo.fromJson(Map<String, dynamic> json) {
    return DomainInfo(
      domain: json['domain'] as String,
      name: json['name'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'domain': domain, 'name': name};
}

/// Service to manage allowed domain configuration
class DomainConfigService {
  static const String _cacheKey = 'allowed_domains_cache';
  static const Duration _cacheDuration = Duration(hours: 24);
  static const Duration _timeout = Duration(seconds: 10);

  List<DomainInfo> _domains = [];
  DateTime? _lastFetch;
  bool _isInitialized = false;
  bool _hasNetworkError = false;

  /// Get list of allowed domains
  List<DomainInfo> get domains => List.unmodifiable(_domains);

  /// Check if domains have been loaded
  bool get isInitialized => _isInitialized;

  /// Check if there was a network error fetching domains
  bool get hasNetworkError => _hasNetworkError;

  /// Initialize the service - fetch domains from backend or cache
  Future<void> initialize() async {
    if (_isInitialized && _domains.isNotEmpty) return;

    // Try loading from cache first
    await _loadFromCache();

    // Fetch from backend if cache is stale or empty
    final cacheExpired =
        _lastFetch == null ||
        DateTime.now().difference(_lastFetch!) > _cacheDuration;
    if (cacheExpired || _domains.isEmpty) {
      await _fetchFromBackend();
    }
  }

  /// Load domains from local cache
  Future<void> _loadFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString(_cacheKey);

      if (cached != null) {
        final data = jsonDecode(cached) as Map<String, dynamic>;
        final timestamp = DateTime.parse(data['timestamp'] as String);
        final domainsList = data['domains'] as List<dynamic>;

        _domains = domainsList
            .map((d) => DomainInfo.fromJson(d as Map<String, dynamic>))
            .toList();
        _lastFetch = timestamp;
        _isInitialized = true;
      }
    } catch (e) {
      ErrorHelper.logError(e, null, 'Domain cache load');
    }
  }

  /// Fetch domains from backend and update cache
  Future<void> _fetchFromBackend() async {
    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/api/v1/auth/config');
      final response = await http.get(uri).timeout(_timeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final domainsList = data['allowed_domains'] as List<dynamic>;

        _domains = domainsList
            .map((d) => DomainInfo.fromJson(d as Map<String, dynamic>))
            .toList();
        _lastFetch = DateTime.now();
        _isInitialized = true;
        _hasNetworkError = false;

        await _saveToCache();
      } else {
        _hasNetworkError = true;
      }
    } catch (e) {
      _hasNetworkError = true;
      // Don't use hardcoded fallback - show network error to user
      _isInitialized = true;
    }
  }

  /// Save domains to local cache
  Future<void> _saveToCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = {
        'timestamp': DateTime.now().toIso8601String(),
        'domains': _domains.map((d) => d.toJson()).toList(),
      };
      await prefs.setString(_cacheKey, jsonEncode(data));
    } catch (e) {
      ErrorHelper.logError(e, null, 'Domain cache save');
    }
  }

  /// Force refresh domains from backend
  Future<void> refresh() async {
    await _fetchFromBackend();
  }

  /// Check if email domain is allowed
  bool isEmailDomainAllowed(String email) {
    if (_domains.isEmpty) return false;

    final emailDomain = email.split('@').last.toLowerCase();

    for (final domainInfo in _domains) {
      final allowed = domainInfo.domain.toLowerCase();
      if (emailDomain == allowed || emailDomain.endsWith('.$allowed')) {
        return true;
      }
    }
    return false;
  }

  /// Get formatted list of supported colleges for display
  String getSupportedCollegesText() {
    if (_domains.isEmpty) {
      return 'Loading supported colleges...';
    }

    return _domains.map((d) => '${d.name} (@${d.domain})').join('\n');
  }
}
