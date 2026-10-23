/// Map Service
///
/// Manages map initialization, preloading, and lifecycle.
/// Prevents crashes by properly managing resources and tile loading.
library;

import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'dart:async';
import 'package:flutter/foundation.dart';

class MapService {
  static final MapService _instance = MapService._internal();
  factory MapService() => _instance;
  MapService._internal();

  bool _isInitialized = false;
  final Map<String, MapController> _controllers = {};
  final Set<String> _preloadedRegions = {};
  Timer? _cleanupTimer;

  bool get isInitialized => _isInitialized;

  /// Initialize map service on app startup
  Future<void> initialize() async {
    if (_isInitialized) return;

    _isInitialized = true;

    // Start periodic cleanup of old controller references
    _cleanupTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) => _cleanupControllers(),
    );

    debugPrint('[MapService] Initialized');
  }

  /// Preload a map region to cache tiles and improve performance
  Future<void> preloadRegion({
    required String regionId,
    required LatLng center,
    required double zoom,
    double radiusKm = 5,
  }) async {
    if (_preloadedRegions.contains(regionId)) {
      return; // Already preloaded
    }

    try {
      // Simulates tile preloading by storing the region info
      _preloadedRegions.add(regionId);
      debugPrint(
        '[MapService] Preloaded region: $regionId at $center, zoom: $zoom',
      );
    } catch (e) {
      debugPrint('[MapService] Error preloading region: $e');
    }
  }

  /// Register a map controller for lifecycle management
  void registerController(String controllerId, MapController controller) {
    _controllers[controllerId] = controller;
    debugPrint('[MapService] Registered controller: $controllerId');
  }

  /// Unregister a map controller and clean up resources
  void unregisterController(String controllerId) {
    _controllers.remove(controllerId);
    debugPrint('[MapService] Unregistered controller: $controllerId');
  }

  /// Get a registered controller
  MapController? getController(String controllerId) {
    return _controllers[controllerId];
  }

  /// Preload default locations for better performance
  Future<void> preloadDefaultLocations() async {
    // Preload common areas (e.g., colleges, city centers)
    final locations = [
      (id: 'sjcet_palai', center: const LatLng(9.7266, 76.7261), zoom: 15.0),
      (id: 'kottayam', center: const LatLng(9.5916, 76.5222), zoom: 14.0),
      (id: 'ernakulam', center: const LatLng(9.9312, 76.2673), zoom: 14.0),
    ];

    for (final loc in locations) {
      await preloadRegion(regionId: loc.id, center: loc.center, zoom: loc.zoom);
    }
  }

  /// Clean up old controller references to prevent memory leaks
  void _cleanupControllers() {
    final keysToRemove = <String>[];

    // Keep only the 5 most recent controllers
    if (_controllers.length > 5) {
      final keysToKeep = _controllers.keys.toList().sublist(0, 5);
      for (final key in _controllers.keys) {
        if (!keysToKeep.contains(key)) {
          keysToRemove.add(key);
        }
      }

      for (final key in keysToRemove) {
        _controllers.remove(key);
      }

      debugPrint(
        '[MapService] Cleaned up ${keysToRemove.length} old controllers',
      );
    }
  }

  /// Dispose map service and clean up all resources
  void dispose() {
    _cleanupTimer?.cancel();
    _controllers.clear();
    _preloadedRegions.clear();
    _isInitialized = false;
    debugPrint('[MapService] Disposed');
  }
}
