'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { api, ChatMessage, ChatMessagePayload, User } from '@/lib/api';
import { Loader2, MessageCircle, Send, Users } from 'lucide-react';

interface MessageFormState {
  receiver_id: number | '';
  message: string;
  waste_request_id?: number | '';
  marketplace_listing_id?: number | '';
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [form, setForm] = useState<MessageFormState>({ receiver_id: '', message: '' });
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/auth/login');
      return;
    }

    const parsedUser: User = JSON.parse(userData);
    setUser(parsedUser);

    const loadChats = async () => {
      try {
        const [messages] = await Promise.all([
          api.getChats(),
        ]);
        setChats(messages);
      } catch (error) {
        console.error('Failed to load chats', error);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [router]);

  const conversationPartners = useMemo(() => {
    const partners = new Map<number, ChatMessage>();
    chats.forEach((chat) => {
      const otherId = chat.sender_id === user?.id ? chat.receiver_id : chat.sender_id;
      if (!partners.has(otherId)) {
        partners.set(otherId, chat);
      }
    });
    return Array.from(partners.values());
  }, [chats, user?.id]);

  const handleChange = (field: keyof MessageFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value === '' || field === 'message' ? value : Number(value),
    }));
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.receiver_id === '' || form.message.trim().length === 0) {
      setStatusMessage('Receiver ID and message are required.');
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      const payload: ChatMessagePayload = {
        receiver_id: Number(form.receiver_id),
        message: form.message.trim(),
        waste_request_id:
          form.waste_request_id === '' ? undefined : Number(form.waste_request_id),
        marketplace_listing_id:
          form.marketplace_listing_id === '' ? undefined : Number(form.marketplace_listing_id),
      };

      await api.sendChatMessage(payload);
      setForm({ receiver_id: '', message: '', waste_request_id: '', marketplace_listing_id: '' });
      setStatusMessage('Message sent successfully.');
      const refreshed = await api.getChats();
      setChats(refreshed);
    } catch (error) {
      console.error('Failed to send message', error);
      setStatusMessage('Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="Messages" user={user}>
      <div className="p-4 space-y-6">
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-emerald-100 p-3 rounded-lg">
              <MessageCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
              <p className="text-sm text-gray-600">Send a real-time update to a worker, NGO, or buyer.</p>
            </div>
          </div>

          {statusMessage && (
            <div className="mb-4 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-4 py-3">
              {statusMessage}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSend}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receiver ID</label>
              <input
                type="number"
                min={1}
                value={form.receiver_id}
                onChange={(event) => handleChange('receiver_id', event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                placeholder="Enter the user ID you want to message"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={form.message}
                onChange={(event) => handleChange('message', event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                rows={3}
                placeholder="Type your message"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Waste Request ID (optional)</label>
                <input
                  type="number"
                  min={1}
                  value={form.waste_request_id ?? ''}
                  onChange={(event) => handleChange('waste_request_id', event.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  placeholder="Link to a waste request"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marketplace Listing ID (optional)</label>
                <input
                  type="number"
                  min={1}
                  value={form.marketplace_listing_id ?? ''}
                  onChange={(event) => handleChange('marketplace_listing_id', event.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  placeholder="Link to a listing"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200 disabled:opacity-50"
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Conversations</h2>
              <p className="text-sm text-gray-600">Stay connected with your recycling network.</p>
            </div>
          </div>

          {chats.length === 0 ? (
            <p className="text-sm text-gray-600">No messages yet. Start a conversation above.</p>
          ) : (
            <div className="space-y-4">
              {conversationPartners.map((chat) => {
                const partnerId = chat.sender_id === user.id ? chat.receiver_id : chat.sender_id;
                const conversationHistory = chats.filter(
                  (message) =>
                    (message.sender_id === partnerId && message.receiver_id === user.id) ||
                    (message.sender_id === user.id && message.receiver_id === partnerId)
                );

                return (
                  <div key={partnerId} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">Conversation with user #{partnerId}</p>
                        <p className="text-xs text-gray-500">
                          Last message {new Date(conversationHistory[0].created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        {conversationHistory.length} messages
                      </span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {conversationHistory.map((message) => (
                        <div
                          key={message.id}
                          className={`p-2 rounded-lg text-sm ${
                            message.sender_id === user.id
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-100'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          <p className="font-medium">{message.sender_id === user.id ? 'You' : `User #${message.sender_id}`}</p>
                          <p>{message.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(message.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
