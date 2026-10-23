/// Group Provider
///
/// Manages ride group state, members, and chat.
/// Optimized to minimize unnecessary rebuilds.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../utils/time_utils.dart';

/// Group member
class GroupMember {
  final String userId;
  final String displayName;
  final String? phone;
  final String role;
  final bool readinessConfirmed;
  final bool isMe;
  final double? averageRating;

  GroupMember({
    required this.userId,
    required this.displayName,
    this.phone,
    required this.role,
    required this.readinessConfirmed,
    required this.isMe,
    this.averageRating,
  });

  factory GroupMember.fromJson(Map<String, dynamic> json) {
    return GroupMember(
      userId: json['user_id'] as String,
      displayName: json['display_name'] as String,
      phone: json['phone'] as String?,
      role: json['role'] as String,
      readinessConfirmed: json['readiness_confirmed'] as bool? ?? false,
      isMe: json['is_me'] as bool? ?? false,
      averageRating: (json['average_rating'] as num?)?.toDouble(),
    );
  }
}

/// Ride group
class RideGroup {
  final String groupId;
  final String routeSummary;
  final String pickupSummary;
  final String dropSummary;
  final String status;
  final String? date;
  final String? timeWindowStart;
  final DateTime? confirmationDeadline;
  final bool myReadinessConfirmed;
  final bool allConfirmed;
  final List<GroupMember> members;

  RideGroup({
    required this.groupId,
    required this.routeSummary,
    required this.pickupSummary,
    required this.dropSummary,
    required this.status,
    this.date,
    this.timeWindowStart,
    this.confirmationDeadline,
    required this.myReadinessConfirmed,
    required this.allConfirmed,
    required this.members,
  });

  factory RideGroup.fromJson(Map<String, dynamic> json) {
    String? timeStart;
    if (json['time_window'] != null) {
      timeStart =
          (json['time_window'] as Map<String, dynamic>)['start'] as String?;
    }

    return RideGroup(
      groupId: json['group_id'] as String,
      routeSummary: json['route_summary'] as String,
      pickupSummary: json['pickup_summary'] as String,
      dropSummary: json['drop_summary'] as String,
      status: json['status'] as String,
      date: json['date'] as String?,
      timeWindowStart: timeStart,
      confirmationDeadline: json['confirmation_deadline'] != null
          ? TimeUtils.parseUtc(json['confirmation_deadline'] as String)
          : null,
      myReadinessConfirmed: json['my_readiness_confirmed'] as bool? ?? false,
      allConfirmed: json['all_confirmed'] as bool? ?? false,
      members:
          (json['members'] as List<dynamic>?)
              ?.map((m) => GroupMember.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

/// Chat message
class ChatMessage {
  final String messageId;
  final String? userId;
  final String? userDisplayName;
  final String messageType;
  final String content;
  final DateTime createdAt;
  final bool isMine;
  final bool isPending; // True for optimistic messages not yet confirmed

  ChatMessage({
    required this.messageId,
    this.userId,
    this.userDisplayName,
    required this.messageType,
    required this.content,
    required this.createdAt,
    required this.isMine,
    this.isPending = false,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      messageId: json['message_id'] as String,
      userId: json['user_id'] as String?,
      userDisplayName: json['user_display_name'] as String?,
      messageType: json['message_type'] as String,
      content: json['content'] as String,
      createdAt: TimeUtils.parseUtc(json['created_at'] as String),
      isMine: json['is_mine'] as bool? ?? false,
      isPending: false,
    );
  }

  /// Create a copy with different pending status
  ChatMessage copyWith({bool? isPending}) {
    return ChatMessage(
      messageId: messageId,
      userId: userId,
      userDisplayName: userDisplayName,
      messageType: messageType,
      content: content,
      createdAt: createdAt,
      isMine: isMine,
      isPending: isPending ?? this.isPending,
    );
  }
}

/// Group provider
class GroupProvider extends ChangeNotifier {
  final ApiService _apiService;
  final WebSocketService _webSocketService;

  bool _isLoading = false;
  String? _error;
  RideGroup? _currentGroup;
  List<ChatMessage> _messages = [];
  bool _isSendingMessage = false;
  bool _isConfirming = false;
  List<RideGroup> _activeGroups = [];

  GroupProvider(this._apiService, this._webSocketService);

  bool get isLoading => _isLoading;
  String? get error => _error;
  RideGroup? get currentGroup => _currentGroup;
  List<ChatMessage> get messages => _messages;
  bool get isSendingMessage => _isSendingMessage;
  bool get isConfirming => _isConfirming;
  List<RideGroup> get activeGroups => _activeGroups;
  bool get hasActiveGroup => _activeGroups.isNotEmpty;

  /// Fetch user's active groups
  Future<void> fetchActiveGroups() async {
    // Force refresh to avoid any stale cached data showing old groups
    final response = await _apiService.get<List<dynamic>>(
      '/groups',
      forceRefresh: true,
    );

    if (response.success && response.data != null) {
      final newGroups = response.data!
          .map((json) => RideGroup.fromJson(json as Map<String, dynamic>))
          .toList();

      // Only notify if groups changed
      final oldIds = _activeGroups.map((g) => g.groupId).toList();
      final newIds = newGroups.map((g) => g.groupId).toList();
      if (!listEquals(oldIds, newIds)) {
        _activeGroups = newGroups;
        notifyListeners();
      }
    } else {
      _error = response.error;
      notifyListeners();
    }
  }

  /// Fetch group details with retry logic for newly created groups
  Future<void> fetchGroup(String groupId) async {
    _isLoading = true;
    _error = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      notifyListeners();
    });

    try {
      // Retry up to 3 times with exponential backoff for newly created groups
      // that might not be immediately available
      dynamic lastError;
      for (int attempt = 0; attempt < 3; attempt++) {
        try {
          final response = await _apiService.get<Map<String, dynamic>>(
            '/groups/$groupId',
          );

          if (response.success && response.data != null) {
            _currentGroup = RideGroup.fromJson(response.data!);
            _error = null;
            return;
          } else if (response.statusCode == 404 && attempt < 2) {
            // Retry on 404 (group might not be queryable yet)
            lastError = response.error;
            final delayMs = 500 * (attempt + 1); // 500ms, 1000ms
            await Future.delayed(Duration(milliseconds: delayMs));
          } else {
            _error = response.error;
            return;
          }
        } on Exception catch (e) {
          lastError = e;
          if (attempt < 2) {
            final delayMs = 500 * (attempt + 1);
            await Future.delayed(Duration(milliseconds: delayMs));
          }
        }
      }

      // All retries failed
      _error = 'Failed to load group: $lastError';
    } catch (e) {
      _error = 'Failed to load group: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Confirm readiness
  Future<bool> confirmReadiness(String groupId) async {
    _isConfirming = true;
    notifyListeners();

    try {
      final response = await _apiService.post<Map<String, dynamic>>(
        '/groups/$groupId/confirm',
        body: {'confirmed': true},
      );

      _isConfirming = false;

      if (response.success && _currentGroup != null) {
        final data = response.data!;
        final newStatus = data['group_status'] as String?;
        final allConfirmed = data['all_confirmed'] as bool? ?? false;

        if (_currentGroup!.groupId == groupId) {
          final updatedMembers = _currentGroup!.members.map((m) {
            if (m.isMe) {
              return GroupMember(
                userId: m.userId,
                displayName: m.displayName,
                phone: m.phone,
                role: m.role,
                readinessConfirmed: true,
                isMe: true,
              );
            }
            return m;
          }).toList();

          _currentGroup = RideGroup(
            groupId: _currentGroup!.groupId,
            routeSummary: _currentGroup!.routeSummary,
            pickupSummary: _currentGroup!.pickupSummary,
            dropSummary: _currentGroup!.dropSummary,
            status:
                newStatus ?? (allConfirmed ? 'active' : _currentGroup!.status),
            date: _currentGroup!.date,
            timeWindowStart: _currentGroup!.timeWindowStart,
            confirmationDeadline: _currentGroup!.confirmationDeadline,
            myReadinessConfirmed: true,
            allConfirmed: allConfirmed,
            members: updatedMembers,
          );
        }

        notifyListeners();
        return true;
      } else {
        _error = response.error;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _error = 'Failed to confirm: $e';
      _isConfirming = false;
      notifyListeners();
      return false;
    }
  }

  /// Fetch messages - merges with local optimistic messages properly
  Future<void> fetchMessages(String groupId) async {
    try {
      final response = await _apiService.get<List<dynamic>>(
        '/groups/$groupId/chat',
      );

      if (response.success && response.data != null) {
        final serverMessages = response.data!
            .map((json) => ChatMessage.fromJson(json as Map<String, dynamic>))
            .toList();

        // Build a set of server message content+isMine for matching optimistic messages
        final serverContentKeys = serverMessages
            .where((m) => m.isMine)
            .map((m) => m.content.trim())
            .toSet();

        // Keep only pending optimistic messages that haven't arrived from server yet
        final now = DateTime.now().toUtc();
        final pendingOptimistic = _messages.where((m) {
          if (!m.messageId.startsWith('local-')) return false;
          // Check if too old (> 30 seconds = definitely failed)
          if (now.difference(m.createdAt).inSeconds > 30) return false;
          // Check if server has a matching message (by content for our messages)
          if (serverContentKeys.contains(m.content.trim())) return false;
          return true;
        }).toList();

        // Combine: server messages first (sorted by createdAt), then pending optimistic
        final merged = [...serverMessages, ...pendingOptimistic];
        merged.sort((a, b) => a.createdAt.compareTo(b.createdAt));

        // Only update if actually changed to avoid unnecessary rebuilds
        final oldIds = _messages.map((m) => m.messageId).join(',');
        final newIds = merged.map((m) => m.messageId).join(',');
        if (oldIds != newIds) {
          _messages = merged;
          notifyListeners();
        }
      }
    } catch (e) {
      // Silent failure for chat refresh
      debugPrint('Error fetching messages: $e');
    }
  }

  /// Add a single message from WebSocket (avoids full refetch flicker)
  void addMessageFromWebSocket(Map<String, dynamic> data) {
    final newMessage = ChatMessage.fromJson(data);

    // Check if we already have this message (by ID)
    if (_messages.any((m) => m.messageId == newMessage.messageId)) {
      return; // Already have it
    }

    // If this is our own message, find and replace the optimistic version
    if (newMessage.isMine) {
      final optimisticIndex = _messages.indexWhere(
        (m) =>
            m.messageId.startsWith('local-') &&
            m.content.trim() == newMessage.content.trim(),
      );
      if (optimisticIndex != -1) {
        // Replace optimistic with confirmed server message
        _messages = [
          ..._messages.sublist(0, optimisticIndex),
          newMessage,
          ..._messages.sublist(optimisticIndex + 1),
        ];
        notifyListeners();
        return;
      }
    }

    // Otherwise, just append the new message
    _messages = [..._messages, newMessage];
    notifyListeners();
  }

  /// Send message
  Future<bool> sendMessage(String groupId, String content) async {
    _isSendingMessage = true;
    notifyListeners();

    try {
      // Optimistically show the message immediately with pending flag
      final tempId = 'local-${DateTime.now().microsecondsSinceEpoch}';
      final now = DateTime.now().toUtc();
      final optimistic = ChatMessage(
        messageId: tempId,
        userId: null,
        userDisplayName: null,
        messageType: 'user',
        content: content,
        createdAt: now,
        isMine: true,
        isPending: true,
      );
      _messages = [..._messages, optimistic];
      notifyListeners();

      // Send via WebSocket for instant delivery
      _webSocketService.send({
        'type': 'chat_message',
        'group_id': groupId,
        'content': content,
      });

      // Force a quick refresh to ensure we reflect any missed socket events
      // and get the definitive server message/ordering
      fetchMessages(groupId);

      // WebSocket will handle the confirmation, but for now assume success
      _isSendingMessage = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Failed to send message: $e';
      _isSendingMessage = false;
      notifyListeners();
      return false;
    }
  }

  /// Leave group
  Future<bool> leaveGroup(String groupId) async {
    if (_isLoading) return false;
    _isLoading = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      notifyListeners();
    });

    try {
      final response = await _apiService.delete<Map<String, dynamic>>(
        '/groups/$groupId/leave',
      );

      if (response.success) {
        _currentGroup = null;
        _activeGroups.removeWhere((g) => g.groupId == groupId);
        await fetchActiveGroups();
        notifyListeners();
        return true;
      } else {
        _error = response.error;
        return false;
      }
    } catch (e) {
      _error = 'Failed to leave group: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Clear current group
  void clearGroup() {
    _currentGroup = null;
    _messages = [];
    notifyListeners();
  }

  /// Check for pending ratings
  Future<List<String>> checkPendingRatings() async {
    try {
      final response = await _apiService.get<List<dynamic>>('/ratings/pending');

      if (response.success && response.data != null) {
        return response.data!.map((e) => e.toString()).toList();
      }
    } catch (e) {
      debugPrint('Error checking pending ratings: $e');
    }
    return [];
  }
}
