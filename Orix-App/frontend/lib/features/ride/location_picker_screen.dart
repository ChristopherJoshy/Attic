/// Location Picker Screen
///
/// Select a location on the map using OpenStreetMap.
library;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_cancellable_tile_provider/flutter_map_cancellable_tile_provider.dart';
import 'package:latlong2/latlong.dart';

import 'package:geolocator/geolocator.dart'; // For current location
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

import 'dart:async'; // For Debounce
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/theme/app_theme.dart';
import '../../core/services/map_service.dart';

class LocationResult {
  final LatLng point;
  final String? address;

  LocationResult(this.point, this.address);
}

class LocationPickerScreen extends StatefulWidget {
  const LocationPickerScreen({super.key});

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  Timer? _debounce;
  late final MapController _mapController;
  LatLng _center = const LatLng(
    9.5916,
    76.5222,
  ); // Default (e.g. SJCET Palai area or Kerala)
  bool _isLoading = false;
  String _address = 'Move map to select location';
  bool _mapReady = false;

  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  // Debounce reverse-geocode calls to keep map panning smooth
  Timer? _addressDebounce;
  static const _addressDebounceDuration = Duration(milliseconds: 500);

  List<Map<String, dynamic>> _suggestions = [];
  bool _showSuggestions = false;

  List<Map<String, dynamic>> _history = [];
  bool _showHistory = false;

  final List<Map<String, dynamic>> _recommended = [
    {
      'label':
          "St. Joseph's College of Engineering and Technology, Bharananganam - Pravithanam Road, SC Colony, Choondacherry, Choondachery, Meenachil, Kottayam, Kerala, 686578, India",
      'lat': 9.7266,
      'lng': 76.7261,
    },
    {
      'label':
          "Bharananganam - Pravithanam Road, Bharananganam, Meenachil, Kottayam, Kerala, 686578, India",
      'lat': 9.7000,
      'lng': 76.7300,
    },
  ];

  @override
  void dispose() {
    _debounce?.cancel();
    _addressDebounce?.cancel();
    _searchController.dispose();
    _searchFocusNode.dispose();

    // Clean up map controller
    try {
      final mapService = MapService();
      mapService.unregisterController('location_picker');
    } catch (e) {
      debugPrint('Error cleaning up map: $e');
    }

    super.dispose();
  }

  Future<void> _fetchSuggestions(String query) async {
    if (_debounce?.isActive ?? false) _debounce!.cancel();

    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if (query.length < 3) {
        if (mounted) {
          setState(() {
            _suggestions = [];
            _showSuggestions = false;
          });
        }
        return;
      }

      try {
        final url = Uri.parse('https://nominatim.openstreetmap.org/search')
            .replace(
              queryParameters: {
                'q': query,
                'format': 'json',
                'addressdetails': '1',
                'limit': '5',
                'countrycodes': 'in',
              },
            );

        final response = await http.get(
          url,
          headers: {'User-Agent': 'OrixApp/1.0'},
        );

        if (response.statusCode == 200) {
          final List<dynamic> data = jsonDecode(response.body);

          if (!mounted) return;

          final results = data.map((item) {
            return {
              'label': item['display_name'] as String,
              'lat': double.parse(item['lat']),
              'lng': double.parse(item['lon']),
            };
          }).toList();

          setState(() {
            _suggestions = results.cast<Map<String, dynamic>>();
            _showSuggestions = results.isNotEmpty;
          });
        }
      } catch (_) {
        // Ignore network errors
      }
    });
  }

  Future<void> _loadHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final historyJson = prefs.getStringList('location_history') ?? [];

    if (mounted) {
      setState(() {
        _history = historyJson
            .map((e) => jsonDecode(e) as Map<String, dynamic>)
            .toList();
      });
    }
  }

  Future<void> _addToHistory(LocationResult result) async {
    if (result.address == null) return;

    final newItem = {
      'label': result.address!,
      'lat': result.point.latitude,
      'lng': result.point.longitude,
    };

    final prefs = await SharedPreferences.getInstance();

    // Remove duplicates (by label)
    _history.removeWhere((item) => item['label'] == newItem['label']);

    // Add to top
    _history.insert(0, newItem);

    // Limit to 10
    if (_history.length > 10) {
      _history = _history.sublist(0, 10);
    }

    await prefs.setStringList(
      'location_history',
      _history.map((e) => jsonEncode(e)).toList(),
    );
  }

  void _selectSuggestion(Map<String, dynamic> suggestion) {
    final newCenter = LatLng(
      suggestion['lat'] as double,
      suggestion['lng'] as double,
    );
    _mapController.move(newCenter, 15);
    _center = newCenter;
    _searchController.text = suggestion['label'] as String;
    setState(() {
      _showSuggestions = false;
      _address = suggestion['label'] as String;
    });
    _searchFocusNode.unfocus();
  }

  void _selectHistoryItem(Map<String, dynamic> item) {
    _selectSuggestion(item);
    setState(() => _showHistory = false);
  }

  Future<void> _searchLocation(String query) async {
    setState(() => _isLoading = true);
    if (_debounce?.isActive ?? false) _debounce!.cancel();

    try {
      final url = Uri.parse('https://nominatim.openstreetmap.org/search')
          .replace(
            queryParameters: {
              'q': query,
              'format': 'json',
              'limit': '1',
              'countrycodes': 'in',
            },
          );

      final response = await http.get(
        url,
        headers: {'User-Agent': 'OrixApp/1.0'},
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);

        if (data.isNotEmpty) {
          final item = data.first;
          final lat = double.parse(item['lat']);
          final lng = double.parse(item['lon']);
          final newCenter = LatLng(lat, lng);

          _mapController.move(newCenter, 15);
          _center = newCenter;

          if (mounted) {
            setState(() {
              _address = item['display_name'] as String? ?? 'Unknown location';
            });
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('No results found for your search.'),
              ),
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not search for location. Please try again.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _getCurrentLocation();
    _loadHistory();

    // Preload map on startup for smoother experience
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _preloadMap();
    });
  }

  Future<void> _preloadMap() async {
    try {
      final mapService = MapService();
      await mapService.initialize();
      mapService.registerController('location_picker', _mapController);
      await mapService.preloadDefaultLocations();

      if (mounted) {
        setState(() => _mapReady = true);
      }
    } catch (e) {
      debugPrint('Error preloading map: $e');
      if (mounted) {
        setState(() => _mapReady = true); // Continue even if preload fails
      }
    }
  }

  Future<void> _getCurrentLocation() async {
    try {
      bool serviceEnabled;
      LocationPermission permission;

      serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('Location services are disabled.');
        return;
      }

      permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          debugPrint('Location permissions are denied');
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        debugPrint('Location permissions are permanently denied');
        return;
      }

      try {
        final position = await Geolocator.getCurrentPosition();
        if (mounted) {
          setState(() {
            _center = LatLng(position.latitude, position.longitude);
          });

          // Only move map if map is ready
          if (_mapReady) {
            _mapController.move(_center, 15);
          }
          _updateAddress();
        }
      } catch (e) {
        debugPrint('Error getting current position: $e');
        // Continue with default location
        if (mounted && _mapReady) {
          _updateAddress();
        }
      }
    } catch (e) {
      debugPrint('Error in _getCurrentLocation: $e');
    }
  }

  Future<void> _updateAddress() async {
    if (!mounted) return; // Add check
    setState(() => _isLoading = true);
    try {
      final url = Uri.parse('https://nominatim.openstreetmap.org/reverse')
          .replace(
            queryParameters: {
              'lat': _center.latitude.toString(),
              'lon': _center.longitude.toString(),
              'format': 'json',
              'addressdetails': '1',
            },
          );

      final response = await http.get(
        url,
        headers: {'User-Agent': 'OrixApp/1.0'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          setState(() {
            _address = data['display_name'] as String? ?? 'Unknown location';
          });
        }
      } else {
        if (mounted) setState(() => _address = 'Unknown location');
      }
    } catch (e) {
      if (mounted) setState(() => _address = 'Selected Location');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _onMapPositionChanged(MapCamera camera, bool hasGesture) {
    final newCenter = camera.center;
    if (newCenter.latitude != _center.latitude ||
        newCenter.longitude != _center.longitude) {
      _center = newCenter;
    }
  }

  bool _isSatellite = true; // Default to Satellite
  bool _isDragging = false;

  void _onMapEvent(MapEvent event) {
    if (event is MapEventMoveStart) {
      if (!_isDragging && mounted) setState(() => _isDragging = true);
    } else if (event is MapEventMoveEnd) {
      if (_isDragging && mounted) setState(() => _isDragging = false);

      if (event.source != MapEventSource.mapController) {
        _addressDebounce?.cancel();
        _addressDebounce = Timer(_addressDebounceDuration, () {
          if (mounted) {
            _updateAddress();
          }
        });
      }
    }
  }

  void _confirmSelection() {
    final result = LocationResult(_center, _address);
    _addToHistory(result);
    context.pop(result);
  }

  /// Build the map widget with error handling and resource management
  Widget _buildMapWidget() {
    try {
      return FlutterMap(
        mapController: _mapController,
        options: MapOptions(
          initialCenter: _center,
          initialZoom: 16.0,
          maxZoom: 18.0,
          minZoom: 3.0,
          onPositionChanged: _onMapPositionChanged,
          onMapEvent: _onMapEvent,
          interactionOptions: const InteractionOptions(
            flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
          ),
        ),
        children: [
          // Main Tile Layer with error handling
          TileLayer(
            urlTemplate: _isSatellite
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.orix.app',
            tileProvider: CancellableNetworkTileProvider(),
            subdomains: _isSatellite ? const [] : const ['a', 'b', 'c'],
            maxNativeZoom: 18,
          ),
          // Labels overlay for satellite view
          if (_isSatellite)
            TileLayer(
              urlTemplate:
                  'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.orix.app',
              tileProvider: CancellableNetworkTileProvider(),
              subdomains: const ['a', 'b', 'c'],
            ),
          RichAttributionWidget(
            attributions: [
              TextSourceAttribution(
                _isSatellite
                    ? 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    : 'OpenStreetMap contributors',
                onTap: () {},
              ),
            ],
          ),
        ],
      );
    } catch (e) {
      debugPrint('Error building map: $e');
      // Fallback UI if map fails to build
      return Container(
        color: AppColors.surface,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.map_outlined,
                size: 48,
                color: AppColors.textSecondary,
              ),
              const SizedBox(height: 16),
              Text(
                'Unable to load map',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(
                'Please check your connection and try again',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => setState(() {}),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Location'),
        actions: [
          // Satellite Toggle
          IconButton(
            icon: Icon(
              _isSatellite ? Icons.map : Icons.satellite_alt,
              color: AppColors.textPrimary,
            ),
            tooltip: _isSatellite
                ? 'Switch to Street View'
                : 'Switch to Satellite',
            onPressed: () => setState(() => _isSatellite = !_isSatellite),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Map fills the entire space (bottom layer)
          Positioned.fill(child: _buildMapWidget()),

          // Animated Center Marker (Lifting effect)
          Center(
            child: Padding(
              // Animate padding to lift the pin when dragging
              padding: EdgeInsets.only(bottom: _isDragging ? 50 : 35),
              child: AnimatedScale(
                scale: _isDragging ? 1.2 : 1.0,
                duration: const Duration(milliseconds: 150),
                curve: Curves.easeOut,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Pin Head
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.surface.withValues(alpha: 0.8),
                        shape: BoxShape.circle,
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black26,
                            blurRadius: 8,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.location_on,
                        size: 44,
                        color: AppColors.primary,
                      ),
                    ),
                    // Shadow/Point
                    if (_isDragging)
                      Container(
                        width: 6,
                        height: 6,
                        margin: const EdgeInsets.only(top: 4),
                        decoration: const BoxDecoration(
                          color: Colors.black26,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),

          // Search bar at the top with suggestions
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                children: [
                  Material(
                    elevation: 2,
                    borderRadius: BorderRadius.circular(8),
                    child: TextField(
                      controller: _searchController,
                      focusNode: _searchFocusNode,
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: 'Search location',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {
                                    _suggestions = [];
                                    _showSuggestions = false;
                                  });
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 14,
                        ),
                      ),
                      onChanged: (value) {
                        if (value.isEmpty) {
                          setState(() {
                            _showSuggestions = false;
                            _showHistory = true;
                          });
                        } else {
                          setState(() => _showHistory = false);
                          _fetchSuggestions(value);
                        }
                      },
                      onSubmitted: (value) async {
                        if (value.isEmpty) return;
                        setState(() => _showSuggestions = false);
                        await _searchLocation(value);
                      },
                    ),
                  ),
                  // Suggestions dropdown
                  if (_showSuggestions && _suggestions.isNotEmpty)
                    Material(
                      elevation: 4,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        constraints: const BoxConstraints(maxHeight: 200),
                        decoration: BoxDecoration(
                          color: Theme.of(context).cardColor,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: ListView.builder(
                          shrinkWrap: true,
                          padding: EdgeInsets.zero,
                          itemCount: _suggestions.length,
                          itemBuilder: (context, index) {
                            final suggestion = _suggestions[index];
                            return ListTile(
                              dense: true,
                              leading: const Icon(
                                Icons.location_on_outlined,
                                size: 20,
                              ),
                              title: Text(
                                suggestion['label'] as String,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              onTap: () => _selectSuggestion(suggestion),
                            );
                          },
                        ),
                      ),
                    ),

                  // Recommended Locations & History
                  if (!_showSuggestions &&
                      (_showHistory || _recommended.isNotEmpty))
                    Material(
                      elevation: 4,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        constraints: const BoxConstraints(maxHeight: 350),
                        decoration: BoxDecoration(
                          color: Theme.of(context).cardColor,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: SingleChildScrollView(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Recommended Section
                              if (_recommended.isNotEmpty) ...[
                                Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.star,
                                        size: 16,
                                        color: AppColors.primary,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Recommended',
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelMedium
                                            ?.copyWith(
                                              color: AppColors.primary,
                                              fontWeight: FontWeight.bold,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                                ..._recommended.map((item) {
                                  return ListTile(
                                    dense: true,
                                    leading: const Icon(
                                      Icons.school,
                                      size: 20,
                                      color: AppColors.textSecondary,
                                    ),
                                    title: Text(
                                      item['label'] as String,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    onTap: () => _selectSuggestion(item),
                                  );
                                }),
                                const Divider(height: 1),
                              ],

                              // History Section
                              if (_showHistory && _history.isNotEmpty) ...[
                                Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Text(
                                    'Recent Locations',
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelMedium
                                        ?.copyWith(
                                          color: AppColors.textSecondary,
                                          fontWeight: FontWeight.bold,
                                        ),
                                  ),
                                ),
                                ..._history.map((item) {
                                  return ListTile(
                                    dense: true,
                                    leading: const Icon(
                                      Icons.history,
                                      size: 20,
                                      color: AppColors.textTertiary,
                                    ),
                                    title: Text(
                                      item['label'] as String,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    onTap: () => _selectHistoryItem(item),
                                  );
                                }),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Bottom Panel
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _isLoading
                            ? const LinearProgressIndicator()
                            : Text(
                                _address,
                                style: Theme.of(context).textTheme.bodyLarge,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _confirmSelection,
                      child: const Text('Confirm Location'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 160), // Above the bottom sheet
        child: FloatingActionButton(
          onPressed: _getCurrentLocation,
          backgroundColor: AppColors.surface,
          child: const Icon(Icons.my_location, color: AppColors.primary),
        ),
      ),
    );
  }
}
