import '../../../core/services/api_service.dart';
import '../../../core/config/api_config.dart';
import '../../../core/utils/time_utils.dart';

class SupportTicket {
  final String ticketId;
  final String userId;
  final String type;
  final String subject;
  final String description;
  final String status;
  final List<TicketMessage> messages;
  final DateTime createdAt;
  final DateTime updatedAt;

  SupportTicket({
    required this.ticketId,
    required this.userId,
    required this.type,
    required this.subject,
    required this.description,
    required this.status,
    required this.messages,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    return SupportTicket(
      ticketId: json['ticket_id'],
      userId: json['user_id'],
      type: json['type'],
      subject: json['subject'],
      description: json['description'],
      status: json['status'],
      messages: (json['messages'] as List)
          .map((m) => TicketMessage.fromJson(m))
          .toList(),
      createdAt: TimeUtils.parseUtc(json['created_at']),
      updatedAt: TimeUtils.parseUtc(json['updated_at']),
    );
  }
}

class TicketMessage {
  final String senderId;
  final String? senderName;
  final String content;
  final DateTime timestamp;
  final bool isAdmin;

  TicketMessage({
    required this.senderId,
    this.senderName,
    required this.content,
    required this.timestamp,
    required this.isAdmin,
  });

  factory TicketMessage.fromJson(Map<String, dynamic> json) {
    return TicketMessage(
      senderId: json['sender_id'],
      senderName: json['sender_name'],
      content: json['content'],
      timestamp: TimeUtils.parseUtc(json['timestamp']),
      isAdmin: json['is_admin'] ?? false,
    );
  }
}

class SupportService {
  final ApiService _apiService;

  SupportService(this._apiService);

  Future<SupportTicket> createTicket({
    required String type,
    required String subject,
    required String description,
    String? reportedUserId,
  }) async {
    final response = await _apiService.post(
      '/support/tickets',
      body: {
        'type': type,
        'subject': subject,
        'description': description,
        'reported_user_id': reportedUserId,
      },
    );

    if (!response.success || response.data == null) {
      throw Exception(response.error ?? 'Failed to create ticket');
    }

    return SupportTicket.fromJson(response.data);
  }

  Future<List<SupportTicket>> getUserTickets() async {
    final response = await _apiService.get('/support/tickets');

    if (!response.success || response.data == null) {
      throw Exception(response.error ?? 'Failed to fetch tickets');
    }

    return (response.data as List)
        .map((t) => SupportTicket.fromJson(t))
        .toList();
  }

  Future<SupportTicket> getTicket(String ticketId) async {
    final response = await _apiService.get('/support/tickets/$ticketId');

    if (!response.success || response.data == null) {
      throw Exception(response.error ?? 'Failed to fetch ticket details');
    }

    return SupportTicket.fromJson(response.data);
  }

  Future<SupportTicket> sendMessage(String ticketId, String content) async {
    final response = await _apiService.post(
      '/support/tickets/$ticketId/message',
      body: {'content': content},
    );

    if (!response.success || response.data == null) {
      throw Exception(response.error ?? 'Failed to send message');
    }

    return SupportTicket.fromJson(response.data);
  }

  Future<SupportTicket> closeTicket(String ticketId) async {
    final response = await _apiService.post(
      '/support/tickets/$ticketId/close',
      body: {},
    );

    if (!response.success || response.data == null) {
      throw Exception(response.error ?? 'Failed to close ticket');
    }

    return SupportTicket.fromJson(response.data);
  }

  Future<List<UserSearchResult>> searchUsers(String query) async {
    final response = await _apiService.get('/users/search?query=$query');

    if (!response.success || response.data == null) {
      return [];
    }

    return (response.data as List)
        .map((u) => UserSearchResult.fromJson(u))
        .toList();
  }
}

class UserSearchResult {
  final String userId;
  final String displayName;
  final String email;
  final String? photoUrl;

  UserSearchResult({
    required this.userId,
    required this.displayName,
    required this.email,
    this.photoUrl,
  });

  factory UserSearchResult.fromJson(Map<String, dynamic> json) {
    String? photoUrl = json['photo_url'] ?? json['photoUrl'];
    if (photoUrl != null && photoUrl.startsWith('/')) {
      photoUrl = '${ApiConfig.baseUrl}$photoUrl';
    }

    return UserSearchResult(
      userId: json['user_id'] ?? json['userId'] ?? '',
      displayName: json['display_name'] ?? json['displayName'] ?? 'Unknown',
      email: json['email'] ?? 'No Email',
      photoUrl: photoUrl,
    );
  }
}
