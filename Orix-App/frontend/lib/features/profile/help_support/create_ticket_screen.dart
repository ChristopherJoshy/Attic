import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../../core/services/api_service.dart';
import '../../../../core/theme/app_theme.dart';
import 'support_service.dart';
import '../../../../core/utils/error_helper.dart';

class CreateTicketScreen extends StatefulWidget {
  final String? type; // 'issue', 'feature', 'report_user'

  const CreateTicketScreen({super.key, this.type});

  @override
  State<CreateTicketScreen> createState() => _CreateTicketScreenState();
}

class _CreateTicketScreenState extends State<CreateTicketScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _descriptionController = TextEditingController();
  late SupportService _supportService;
  bool _isLoading = false;

  late String _selectedType;

  @override
  void initState() {
    super.initState();
    _selectedType = widget.type ?? 'issue';
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Initialize service here to access context
    _supportService = SupportService(context.read<ApiService>());
  }

  @override
  void dispose() {
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      await _supportService.createTicket(
        type: _selectedType,
        subject: _subjectController.text,
        description: _descriptionController.text,
      );

      if (mounted) {
        context.pop(); // Go back
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Ticket created successfully! We will contact you soon.',
            ),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ErrorHelper.getUserFriendlyMessage(e)),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _getTitle() {
    switch (_selectedType) {
      case 'feature':
        return 'Suggest a Feature';
      case 'report_user':
        return 'Report a User';
      case 'issue':
      default:
        return 'Report an Issue';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_getTitle())),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (widget.type == null) ...[
                DropdownButtonFormField<String>(
                  initialValue: _selectedType,
                  decoration: const InputDecoration(
                    labelText: 'Type',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'issue', child: Text('Issue')),
                    DropdownMenuItem(value: 'feature', child: Text('Feature')),
                    DropdownMenuItem(
                      value: 'report_user',
                      child: Text('Report User'),
                    ),
                  ],
                  onChanged: (val) => setState(() => _selectedType = val!),
                ),
                const SizedBox(height: 16),
              ],
              if (_selectedType == 'report_user') ...[
                Autocomplete<UserSearchResult>(
                  displayStringForOption: (option) => option.displayName,
                  optionsBuilder: (textEditingValue) async {
                    if (textEditingValue.text.length < 2) {
                      return const Iterable<UserSearchResult>.empty();
                    }
                    return await _supportService.searchUsers(
                      textEditingValue.text,
                    );
                  },
                  onSelected: (selection) {
                    _descriptionController.text =
                        'Reporting user: ${selection.displayName} (${selection.email})\nID: ${selection.userId}\n\nReason: ';
                  },
                  fieldViewBuilder:
                      (
                        context,
                        textEditingController,
                        focusNode,
                        onFieldSubmitted,
                      ) {
                        return TextFormField(
                          controller: textEditingController,
                          focusNode: focusNode,
                          decoration: const InputDecoration(
                            labelText: 'Search User',
                            hintText: 'Enter name or email',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.search),
                          ),
                        );
                      },
                  optionsViewBuilder: (context, onSelected, options) {
                    return Align(
                      alignment: Alignment.topLeft,
                      child: Material(
                        elevation: 4,
                        child: SizedBox(
                          width: MediaQuery.of(context).size.width - 32,
                          child: ListView.builder(
                            padding: EdgeInsets.zero,
                            shrinkWrap: true,
                            itemCount: options.length,
                            itemBuilder: (context, index) {
                              final option = options.elementAt(index);
                              return ListTile(
                                leading: CircleAvatar(
                                  backgroundImage: option.photoUrl != null
                                      ? NetworkImage(option.photoUrl!)
                                      : null,
                                  child: option.photoUrl == null
                                      ? Text(option.displayName[0])
                                      : null,
                                ),
                                title: Text(option.displayName),
                                // subtitle: Text(option.email), // Removed per request? No, request said show name (and image). Email usually hidden for privacy if possible, but let's show to identify. User said "show user name (and image) only in frontend". Okay, I will hide email or keep it subtle.
                                // "show user name (and image) only in frontend" implies hide other sensitive info.
                                onTap: () => onSelected(option),
                              );
                            },
                          ),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 16),
              ],
              TextFormField(
                controller: _subjectController,
                decoration: const InputDecoration(
                  labelText: 'Subject',
                  hintText: 'Brief summary',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => v?.isEmpty == true ? 'Required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  hintText: 'Please describe in detail...',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
                maxLines: 5,
                validator: (v) => v?.isEmpty == true ? 'Required' : null,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text('Submit'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
