/// API Service
///
/// HTTP client for backend communication.
library;

import 'dart:convert';
import 'dart:io' show SocketException, HttpException, File;

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'package:flutter/widgets.dart';

import '../utils/error_helper.dart';

import 'package:go_router/go_router.dart';
import '../router/app_router.dart';
import 'auth_service.dart';
import '../config/api_config.dart';

// ApiConfig is imported from ../config/api_config.dart

/// API response wrapper
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? error;
  final String? errorCode;
  final int statusCode;

  ApiResponse({
    required this.success,
    this.data,
    this.error,
    this.errorCode,
    required this.statusCode,
  });

  factory ApiResponse.success(T data, int statusCode) =>
      ApiResponse(success: true, data: data, statusCode: statusCode);

  factory ApiResponse.failure(
    String error,
    int statusCode, {
    String? errorCode,
  }) => ApiResponse(
    success: false,
    error: error,
    errorCode: errorCode,
    statusCode: statusCode,
  );
}

/// Cache entry with expiration
class _CacheEntry {
  final dynamic data;
  final DateTime expiresAt;

  _CacheEntry(this.data, Duration ttl) : expiresAt = DateTime.now().add(ttl);

  bool get isValid => DateTime.now().isBefore(expiresAt);
}

/// API service for backend communication
class ApiService {
  final http.Client _client = http.Client();
  AuthService? _authService;

  /// Response cache for GET requests
  final Map<String, _CacheEntry> _cache = {};

  /// Max retries for network errors
  static const int _maxRetries = 2;

  /// Retry delay multiplier (exponential backoff)
  static const Duration _retryDelayBase = Duration(milliseconds: 500);

  /// Cache TTL per endpoint pattern (in seconds)
  static const Map<String, int> _cacheTtl = {
    // Ride status changes frequently and should always be fresh
    // to avoid stale data reappearing after completion
    '/users/me/rider': 30, // Rider info changes rarely
  };

  /// Set auth service reference
  void setAuthService(AuthService authService) {
    _authService = authService;
  }

  /// Retry with exponential backoff for transient errors
  Future<T> _retryWithBackoff<T>(
    Future<T> Function() operation, {
    int retries = _maxRetries,
  }) async {
    int attempt = 0;
    while (true) {
      try {
        return await operation();
      } on SocketException {
        attempt++;
        if (attempt >= retries) {
          rethrow;
        }
        await Future.delayed(_retryDelayBase * attempt);
      } on http.ClientException {
        attempt++;
        if (attempt >= retries) {
          rethrow;
        }
        await Future.delayed(_retryDelayBase * attempt);
      }
    }
  }

  /// Get cache TTL for endpoint
  Duration _getCacheTtl(String endpoint) {
    for (final entry in _cacheTtl.entries) {
      if (endpoint.contains(entry.key)) {
        return Duration(seconds: entry.value);
      }
    }
    return Duration.zero; // No caching by default
  }

  /// Check cache for valid entry
  dynamic _getCached(String cacheKey) {
    final entry = _cache[cacheKey];
    if (entry != null && entry.isValid) {
      return entry.data;
    }
    _cache.remove(cacheKey); // Clean up expired
    return null;
  }

  /// Store in cache
  void _setCache(String cacheKey, dynamic data, Duration ttl) {
    if (ttl > Duration.zero) {
      _cache[cacheKey] = _CacheEntry(data, ttl);
    }
  }

  /// Invalidate cached GET responses whose URL contains the given prefix.
  void invalidateCacheByPrefix(String prefix) {
    _cache.removeWhere((key, _) => key.contains(prefix));
  }

  /// Base URL for API
  String get baseUrl => '${ApiConfig.baseUrl}/api/${ApiConfig.apiVersion}';

  /// Get authorization headers
  Future<Map<String, String>> _getHeaders({bool withAuth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (withAuth && _authService != null) {
      final token = await _authService!.getIdToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    return headers;
  }

  /// Parse response
  ApiResponse<T> _parseResponse<T>(
    http.Response response,
    T Function(dynamic json)? parser,
  ) {
    try {
      final body = response.body.isEmpty ? null : jsonDecode(response.body);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = parser != null && body != null ? parser(body) : body as T?;
        return ApiResponse.success(data as T, response.statusCode);
      } else {
        String error = 'Request failed';
        String? errorCode;

        if (body is Map) {
          // FastAPI wraps errors in 'detail' which can be a string or dict
          final detail = body['detail'];
          if (detail is Map) {
            // Nested structure: {detail: {error: "...", message: "..."}}
            error = detail['message']?.toString() ?? error;
            errorCode = detail['error']?.toString();
          } else if (detail is String) {
            error = detail;
          }

          // Also check top-level error/message for other backends
          errorCode ??= body['error']?.toString();
          if (error == 'Request failed') {
            error = body['message']?.toString() ?? error;
          }
        }

        // Convert to user-friendly message
        final userFriendlyError = ErrorMessages.getFriendly(
          error,
          statusCode: response.statusCode,
        );

        // Handle account status errors globally - redirect immediately
        if (errorCode != null) {
          _handleAccountStatusError(errorCode);
        }

        return ApiResponse.failure(
          userFriendlyError,
          response.statusCode,
          errorCode: errorCode,
        );
      }
    } catch (e) {
      return ApiResponse.failure(
        ErrorMessages.parseFailed,
        response.statusCode,
      );
    }
  }

  /// Handle account status errors (ban, suspension, maintenance) globally
  void _handleAccountStatusError(String errorCode) {
    try {
      final context = AppRouter.rootNavigatorKey.currentContext;
      if (context == null) {
        return;
      }

      String? targetPath;
      switch (errorCode) {
        case 'account_banned':
          targetPath = RoutePaths.banned;
          break;
        case 'account_suspended':
          targetPath = RoutePaths.suspended;
          break;
        case 'maintenance_mode':
          targetPath = RoutePaths.maintenance;
          break;
      }

      if (targetPath == null) {
        return;
      }

      // Use SchedulerBinding to avoid calling during build
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          final ctx = AppRouter.rootNavigatorKey.currentContext;
          if (ctx != null) {
            GoRouter.of(ctx).go(targetPath!);
          }
        } catch (e) {
          ErrorHelper.logError(e, null, 'Navigation callback error');
        }
      });
    } catch (e) {
      ErrorHelper.logError(e, null, 'Account status error handler');
    }
  }

  void _handleNetworkError() {
    final context = AppRouter.rootNavigatorKey.currentContext;
    if (context != null) {
      // Check if already on network error screen to avoid loop
      final location = GoRouterState.of(context).uri.path;
      if (location != RoutePaths.networkIssue) {
        context.push(RoutePaths.networkIssue);
      }
    }
  }

  /// GET request with optional caching and retry logic
  Future<ApiResponse<T>> get<T>(
    String endpoint, {
    Map<String, String>? queryParams,
    T Function(dynamic json)? parser,
    bool withAuth = true,
    bool forceRefresh = false,
  }) async {
    try {
      var uri = Uri.parse('$baseUrl$endpoint');
      if (queryParams != null) {
        uri = uri.replace(queryParameters: queryParams);
      }

      // Check cache first (unless force refresh)
      final cacheKey = uri.toString();
      final ttl = _getCacheTtl(endpoint);

      if (!forceRefresh && ttl > Duration.zero) {
        final cached = _getCached(cacheKey);
        if (cached != null) {
          final data = parser != null ? parser(cached) : cached as T?;
          return ApiResponse.success(data as T, 200);
        }
      }

      // Perform request with retry logic
      final response = await _retryWithBackoff(() async {
        return await _client
            .get(uri, headers: await _getHeaders(withAuth: withAuth))
            .timeout(ApiConfig.timeout);
      });

      final result = _parseResponse(response, parser);

      // Cache successful responses
      if (result.success && result.data != null) {
        // Store raw body for caching (before parsing)
        final rawBody = response.body.isEmpty
            ? null
            : jsonDecode(response.body);
        _setCache(cacheKey, rawBody, ttl);
      }

      return result;
    } on SocketException {
      _handleNetworkError();
      return ApiResponse.failure(ErrorMessages.noInternet, 0);
    } on http.ClientException {
      _handleNetworkError();
      return ApiResponse.failure(ErrorMessages.connectionFailed, 0);
    } on HttpException {
      return ApiResponse.failure(ErrorMessages.connectionFailed, 0);
    } catch (e) {
      return ApiResponse.failure(ErrorMessages.unknownError, 0);
    }
  }

  /// POST request
  Future<ApiResponse<T>> post<T>(
    String endpoint, {
    Map<String, dynamic>? body,
    T Function(dynamic json)? parser,
    bool withAuth = true,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');
      final response = await _client
          .post(
            uri,
            headers: await _getHeaders(withAuth: withAuth),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(ApiConfig.timeout);

      return _parseResponse(response, parser);
    } on SocketException {
      _handleNetworkError();
      return ApiResponse.failure('No internet connection', 0);
    } on http.ClientException {
      _handleNetworkError();
      return ApiResponse.failure('Connection failed', 0);
    } catch (e) {
      return ApiResponse.failure(ErrorHelper.getApiErrorMessage(e), 0);
    }
  }

  /// POST Multipart request (file upload)
  Future<ApiResponse<T>> postMultipart<T>(
    String endpoint, {
    required File file,
    required String fileField,
    String? mediaType,
    Map<String, String>? fields,
    T Function(dynamic json)? parser,
    bool withAuth = true,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');

      // CREATE MULTIPART REQUEST
      final request = http.MultipartRequest('POST', uri);

      // HEADERS
      final headers = await _getHeaders(withAuth: withAuth);
      // Remove Content-Type (MultipartRequest sets it automatically with boundary)
      headers.remove('Content-Type');
      request.headers.addAll(headers);

      // FIELDS
      if (fields != null) {
        request.fields.addAll(fields);
      }

      // FILE
      var multipartFile = await http.MultipartFile.fromPath(
        fileField,
        file.path,
      );

      // Explicitly set content type if provided
      if (mediaType != null) {
        final typeData = mediaType.split('/');
        if (typeData.length == 2) {
          multipartFile = await http.MultipartFile.fromPath(
            fileField,
            file.path,
            contentType: MediaType(typeData[0], typeData[1]),
          );
        }
      }

      request.files.add(multipartFile);
      // SEND
      final streamedResponse = await request.send().timeout(ApiConfig.timeout);
      final response = await http.Response.fromStream(streamedResponse);

      return _parseResponse(response, parser);
    } on SocketException {
      _handleNetworkError();
      return ApiResponse.failure('No internet connection', 0);
    } on http.ClientException {
      _handleNetworkError();
      return ApiResponse.failure('Connection failed', 0);
    } catch (e) {
      return ApiResponse.failure(ErrorHelper.getApiErrorMessage(e), 0);
    }
  }

  /// PUT request
  Future<ApiResponse<T>> put<T>(
    String endpoint, {
    Map<String, dynamic>? body,
    T Function(dynamic json)? parser,
    bool withAuth = true,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');
      final response = await _client
          .put(
            uri,
            headers: await _getHeaders(withAuth: withAuth),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(ApiConfig.timeout);

      return _parseResponse(response, parser);
    } on SocketException {
      _handleNetworkError();
      return ApiResponse.failure('No internet connection', 0);
    } on http.ClientException {
      _handleNetworkError();
      return ApiResponse.failure('Connection failed', 0);
    } catch (e) {
      return ApiResponse.failure(ErrorHelper.getApiErrorMessage(e), 0);
    }
  }

  /// DELETE request
  Future<ApiResponse<T>> delete<T>(
    String endpoint, {
    T Function(dynamic json)? parser,
    bool withAuth = true,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');
      final response = await _client
          .delete(uri, headers: await _getHeaders(withAuth: withAuth))
          .timeout(ApiConfig.timeout);

      return _parseResponse(response, parser);
    } on SocketException {
      _handleNetworkError();
      return ApiResponse.failure('No internet connection', 0);
    } on http.ClientException {
      _handleNetworkError();
      return ApiResponse.failure('Connection failed', 0);
    } catch (e) {
      return ApiResponse.failure(ErrorHelper.getApiErrorMessage(e), 0);
    }
  }

  /// Dispose client
  void dispose() {
    _client.close();
  }
}
