import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../../core/services/api_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/custom_alert_dialog.dart';
import 'support_service.dart';
import '../../../../core/utils/error_helper.dart';

class TicketChatScreen extends StatefulWidget {
  final String ticketId;

  const TicketChatScreen({super.key, required this.ticketId});

  @override
  State<TicketChatScreen> createState() => _TicketChatScreenState();
}

class _TicketChatScreenState extends State<TicketChatScreen> {
  late SupportService _supportService;
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  SupportTicket? _ticket;
  bool _isLoading = true;
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _supportService = SupportService(context.read<ApiService>());
    _loadTicket();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadTicket() async {
    try {
      final ticket = await _supportService.getTicket(widget.ticketId);
      if (mounted) {
        setState(() {
          _ticket = ticket;
          _isLoading = false;
        });
        // Scroll to bottom after frame
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _scrollToBottom();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorHelper.getUserFriendlyMessage(e))),
        );
      }
    }
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    setState(() => _isSending = true);

    try {
      final updatedTicket = await _supportService.sendMessage(
        widget.ticketId,
        text,
      );
      if (mounted) {
        setState(() {
          _ticket = updatedTicket;
          _messageController.clear();
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorHelper.getUserFriendlyMessage(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_ticket?.subject ?? 'Ticket #${widget.ticketId}'),
        actions: [
          if (_ticket != null && _ticket!.status != 'closed')
            IconButton(
              icon: const Icon(Icons.check_circle_outline),
              tooltip: 'Close Ticket',
              onPressed: () => _confirmCloseTicket(),
            ),
          if (_ticket != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white70),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _ticket!.status.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _ticket?.messages.length ?? 0,
                    itemBuilder: (context, index) {
                      final message = _ticket!.messages[index];
                      return _buildMessageBubble(message);
                    },
                  ),
                ),
                _buildInputArea(),
              ],
            ),
    );
  }

  Widget _buildMessageBubble(TicketMessage message) {
    final isMe = !message.isAdmin;
    final align = isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final color = isMe ? AppColors.primary : AppColors.surfaceVariant;
    final textColor = isMe ? Colors.white : AppColors.textPrimary;
    final timeStr = DateFormat('h:mm a').format(message.timestamp);

    return Column(
      crossAxisAlignment: align,
      children: [
        Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: isMe ? const Radius.circular(16) : Radius.zero,
              bottomRight: isMe ? Radius.zero : const Radius.circular(16),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isMe) ...[
                Text(
                  'Support Agent',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: textColor.withAlphaValue(180),
                  ),
                ),
                const SizedBox(height: 2),
              ],
              Text(
                message.content,
                style: TextStyle(color: textColor, fontSize: 16),
              ),
              const SizedBox(height: 4),
              Text(
                timeStr,
                style: TextStyle(
                  color: textColor.withAlphaValue(170),
                  fontSize: 10,
                ),
                textAlign: TextAlign.end,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _buildInputArea() {
    if (_ticket?.status == 'closed') {
      return Container(
        padding: const EdgeInsets.all(16),
        color: AppColors.surface,
        child: const Center(child: Text('This ticket is closed.')),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlphaValue(10),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _messageController,
                decoration: InputDecoration(
                  hintText: 'Type a message...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                  fillColor: AppColors.background,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                ),
                minLines: 1,
                maxLines: 4,
                textCapitalization: TextCapitalization.sentences,
              ),
            ),
            const SizedBox(width: 8),
            FloatingActionButton(
              onPressed: _isSending ? null : _sendMessage,
              mini: true,
              backgroundColor: AppColors.primary,
              child: _isSending
                  ? const SizedBox(
                      height: 15,
                      width: 15,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.send, color: Colors.white, size: 20),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmCloseTicket() async {
    final confirmed = await CustomAlertDialog.show<bool>(
      context: context,
      title: 'Close Ticket?',
      message:
          'Are you sure you want to close this ticket? You won\'t be able to send more messages.',
      primaryButtonText: 'Close',
      onPrimaryPressed: () => Navigator.pop(context, true),
      secondaryButtonText: 'Cancel',
      onSecondaryPressed: () => Navigator.pop(context, false),
      icon: Icons.check_circle_outline,
      iconColor: AppColors.error,
    );

    if (confirmed == true) {
      if (!mounted) return;
      setState(() => _isLoading = true);

      try {
        final updated = await _supportService.closeTicket(widget.ticketId);
        if (!mounted) return;

        setState(() {
          _ticket = updated;
          _isLoading = false;
        });

        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Ticket closed')));
      } catch (e) {
        if (!mounted) return;

        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ErrorHelper.getUserFriendlyMessage(e))),
        );
      }
    }
  }
}
