'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import {
  api,
  User,
  MarketplaceListing,
  MarketplaceListingPayload,
} from '@/lib/api';
import {
  DollarSign,
  Loader2,
  MessageCircle,
  ShoppingBag,
  ShoppingCart,
  Tag,
} from 'lucide-react';

interface ListingFormState {
  title: string;
  description: string;
  price: number;
  category: string;
}

const DEFAULT_CATEGORIES = [
  'recycled-materials',
  'upcycled-goods',
  'scrap-metal',
  'organic-compost',
  'paper-products',
  'plastic-regrind',
];

export default function MarketplacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [categories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [form, setForm] = useState<ListingFormState>({
    title: '',
    description: '',
    price: 0,
    category: DEFAULT_CATEGORIES[0],
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/auth/login');
      return;
    }

    const parsedUser: User = JSON.parse(userData);
    setUser(parsedUser);

    const loadListings = async () => {
      try {
        const [existingListings] = await Promise.all([
          api.getMarketplaceListings(),
        ]);
        setListings(existingListings);
      } catch (error) {
        console.error('Failed to load marketplace', error);
      } finally {
        setLoading(false);
      }
    };

    loadListings();
  }, [router]);

  const myListings = useMemo(() => {
    if (!user) return [];
    return listings.filter((listing) => listing.seller_name === user.name);
  }, [listings, user]);

  const handleChange = (field: keyof ListingFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === 'price' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const payload: MarketplaceListingPayload = {
        title: form.title,
        description: form.description,
        price: form.price,
        category: form.category,
      };

      await api.createMarketplaceListing(payload);
      setMessage('Listing published successfully.');
      setForm({ title: '', description: '', price: 0, category: form.category });
      const refreshed = await api.getMarketplaceListings();
      setListings(refreshed);
    } catch (error) {
      console.error('Failed to create listing', error);
      setMessage('Failed to create listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkSold = async (listingId: number) => {
    try {
      await api.markListingSold(listingId);
      const refreshed = await api.getMarketplaceListings();
      setListings(refreshed);
    } catch (error) {
      console.error('Failed to mark listing as sold', error);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-emerald-600">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="Marketplace" user={user}>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-lg p-6 shadow-lg border border-emerald-200">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 p-3 rounded-lg shadow-sm">
              <ShoppingCart className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-800">Post New Listing</h2>
              <p className="text-emerald-600">Connect recycled goods with buyers and circular partners.</p>
            </div>
          </div>

          {message && (
            <div className="mb-6 text-body bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-800">
              {message}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="form-label">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(event) => handleChange('title', event.target.value)}
                className="form-input"
                placeholder="Eg. Recycled PET Flakes"
                required
              />
            </div>

            <div>
              <label className="form-label">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => handleChange('description', event.target.value)}
                className="form-input"
                rows={3}
                placeholder="Share material details, quality, and delivery options"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Price (USD)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={(event) => handleChange('price', event.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select
                  value={form.category}
                  onChange={(event) => handleChange('category', event.target.value)}
                  className="form-input"
                  required
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category.replace('-', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner"></div>
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" />
                  <span>Publish Listing</span>
                </>
              )}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Tag className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-heading">Available Listings</h2>
              <p className="text-caption">Discover circular goods shared by the community.</p>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Tag className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-body mb-2">No listings available yet</p>
              <p className="text-caption">Be the first to create one!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {listings.map((listing) => (
                <div key={listing.id} className="card card-compact border hover:transform hover:-translate-y-1 transition-smooth">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-subheading">{listing.title}</h3>
                      <p className="text-small">Posted {new Date(listing.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-subheading text-emerald-600 font-semibold">${listing.price}</span>
                  </div>
                  <p className="text-body mt-3 text-gray-700">{listing.description}</p>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4">
                      <span className="badge badge-info">{listing.category.replace('-', ' ')}</span>
                      <span className="text-caption">by {listing.seller_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    {user && listing.seller_name !== user.name && (
                      <button
                        onClick={() => {
                          setSelectedListing(listing);
                          setShowChat(true);
                        }}
                        className="btn btn-outline btn-sm"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Contact Seller</span>
                      </button>
                    )}
                    {user && listing.seller_name === user.name && (
                      <button
                        onClick={() => handleMarkSold(listing.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        <DollarSign className="h-4 w-4" />
                        <span>Mark as sold</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {myListings.length > 0 && (
          <section className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-indigo-100 p-3 rounded-lg">
                <ShoppingBag className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Your Listings</h2>
                <p className="text-sm text-gray-600">Quick access to manage listings you created.</p>
              </div>
            </div>

            <div className="space-y-3">
              {myListings.map((listing) => (
                <div key={listing.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{listing.title}</p>
                    <span className="text-sm text-gray-600">${listing.price}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2 line-clamp-2">{listing.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Chat Modal */}
      {showChat && selectedListing && (
        <MarketplaceChat
          listing={selectedListing}
          currentUser={user!}
          onClose={() => {
            setShowChat(false);
            setSelectedListing(null);
          }}
        />
      )}
    </AppLayout>
  );
}

// Chat Modal Component
interface MarketplaceChatProps {
  listing: MarketplaceListing;
  currentUser: User;
  onClose: () => void;
}

function MarketplaceChat({ listing, currentUser, onClose }: MarketplaceChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadChatHistory();
  }, [listing.id]);

  const loadChatHistory = async () => {
    try {
      // Load chat history for this listing
      const chatHistory = await api.getChatMessages(listing.seller_id, listing.id);
      setMessages(chatHistory || []);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const messagePayload = {
        message: newMessage,
        receiver_id: listing.seller_id,
        marketplace_listing_id: listing.id,
      };

      await api.sendChatMessage(messagePayload);
      await loadChatHistory(); // Refresh messages
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md h-96 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Chat with {listing.seller_name}</h3>
            <p className="text-sm text-gray-600">{listing.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.sender_id === currentUser.id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
