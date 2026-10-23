const getApiBase = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (process.env.NODE_ENV === 'development' && window.location.hostname.includes('-')) {
    return 'https://' + window.location.hostname.replace('-00-', '-8000-');
  }

  return '/api';
};

const API_BASE = getApiBase();

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  phone?: string;
  address?: string;
  is_business?: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  is_business: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface WasteTypeOption {
  value: string;
  label: string;
}

export interface WasteRequestPayload {
  waste_type: string;
  quantity: number;
  description: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
}

export interface WasteRequest {
  id: number;
  waste_type: string;
  quantity: number;
  description: string;
  status: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  estimated_price: number | null;
  confidence_score: number | null;
  worker_id: number | null;
  worker_name?: string | null;
  created_at: string;
}

export interface MarketplaceListingPayload {
  title: string;
  description: string;
  price: number;
  category: string;
}

export interface MarketplaceListing {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  photo_urls?: string | null;
  seller_id: number;
  seller_name: string;
  created_at: string;
  is_sold?: boolean;
}

export interface ChatMessagePayload {
  message: string;
  receiver_id: number;
  waste_request_id?: number | null;
  marketplace_listing_id?: number | null;
}

export interface ChatMessage {
  id: number;
  message: string;
  sender_id: number;
  receiver_id: number;
  waste_request_id: number | null;
  marketplace_listing_id: number | null;
  created_at: string;
  is_read: boolean;
}

export interface Donation {
  id: number;
  donation_type: string;
  description: string;
  source: string;
  status: string;
  pickup_address: string;
  created_at: string;
}

export interface WastePriceUpdate {
  waste_type: string;
  price_per_kg: number;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  }

  logout() {
    this.clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (!isFormData) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    console.log(`API Request: ${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(errorText || `HTTP Error ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }

      return null;
    } catch (error) {
      console.error(`API Request Failed: ${url}`, error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error - Check if backend server is running and accessible');
      }
      throw error;
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response?.access_token) {
      this.setToken(response.access_token);
    }

    return response;
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response?.access_token) {
      this.setToken(response.access_token);
    }

    return response;
  }

  async getCurrentUser(): Promise<User> {
    return this.request('/auth/me');
  }

  async getWasteTypes(): Promise<WasteTypeOption[]> {
    return this.request('/waste-types');
  }

  async getWastePrices(): Promise<Record<string, number>> {
    return this.request('/waste-prices');
  }

  async getDebugInfo() {
    return this.request('/debug');
  }

  async getAllUsers(): Promise<User[]> {
    return this.request('/admin/users');
  }

  async updateUserRole(email: string, role: string) {
    return this.request('/admin/users/role', {
      method: 'PUT',
      body: JSON.stringify({ email, role }),
    });
  }

  async updateWastePrice(payload: WastePriceUpdate) {
    return this.request('/admin/waste-prices', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getWasteRequests(): Promise<WasteRequest[]> {
    return this.request('/waste-requests');
  }

  async createWasteRequest(payload: WasteRequestPayload) {
    return this.request('/waste-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async acceptWasteRequest(requestId: number) {
    return this.request(`/worker/requests/${requestId}/accept`, {
      method: 'POST',
    });
  }

  async updateWasteRequestStatus(requestId: number, status: string) {
    return this.request(`/worker/requests/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ request_id: requestId, status }),
    });
  }

  async updateWorkerLocation(latitude: number, longitude: number) {
    return this.request('/worker/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    });
  }

  async getDonations(): Promise<Donation[]> {
    return this.request('/donations');
  }

  async createDonation(payload: any) {
    return this.request('/donations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getNGOs() {
    return this.request('/ngos');
  }

  async acceptDonation(donationId: number) {
    return this.request(`/donations/${donationId}/accept`, {
      method: 'POST',
    });
  }

  async getMarketplaceListings(): Promise<MarketplaceListing[]> {
    return this.request('/marketplace');
  }

  async createMarketplaceListing(payload: MarketplaceListingPayload) {
    return this.request('/marketplace', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async markListingSold(listingId: number) {
    return this.request(`/marketplace/${listingId}/sold`, {
      method: 'PUT',
    });
  }

  async getChats(): Promise<ChatMessage[]> {
    return this.request('/chats');
  }

  async getChatMessages(receiverId: number, listingId?: number): Promise<ChatMessage[]> {
    const params = new URLSearchParams();
    params.append('receiver_id', receiverId.toString());
    if (listingId) {
      params.append('marketplace_listing_id', listingId.toString());
    }
    return this.request(`/chats/messages?${params.toString()}`);
  }

  async sendChatMessage(payload: ChatMessagePayload) {
    return this.request('/chats', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async aiClassify(description: string, photo?: File) {
    const formData = new FormData();
    formData.append('description', description);
    if (photo) {
      formData.append('photo', photo);
    }

    return this.request('/ai/classify', {
      method: 'POST',
      body: formData,
    });
  }

  async aiChat(message: string, context = '') {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  }

  async chatWithAI(payload: { message: string }) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient();