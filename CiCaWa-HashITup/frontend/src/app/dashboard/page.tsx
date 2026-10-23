'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { Plus, Trash2, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import { api, WasteRequest } from '@/lib/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [requests, setRequests] = useState<WasteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/auth/login');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    
    // Load dashboard data
    const loadData = async () => {
      try {
        // Test authenticated endpoint
        const userProfile = await api.getCurrentUser();
        console.log('✅ Authentication working:', userProfile);
        
        // Load waste prices and requests
        const wastePrices = await api.getWastePrices();
        setPrices(wastePrices);

        const wasteRequests = await api.getWasteRequests();
        setRequests(Array.isArray(wasteRequests) ? wasteRequests : []);
      } catch (error) {
        console.error('❌ API Error:', error);
        // If auth fails, redirect to login
        if (error instanceof Error && error.message.includes('401')) {
          localStorage.removeItem('user');
          localStorage.removeItem('access_token');
          router.push('/auth/login');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-caption text-emerald-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <AppLayout title="Dashboard" user={user}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div 
          className="rounded-lg p-6 mb-8 text-white" 
          style={{
            background: 'linear-gradient(135deg, #059669, #10b981, #34d399)'
          }}
        >
          <h1 className="text-title mb-2">Welcome back, {user.name}!</h1>
          <p className="text-body opacity-90 mb-3">Ready to make a positive environmental impact?</p>
          <div 
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium" 
            style={{
              background: 'rgba(255,255,255,0.25)', 
              color: 'white',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </div>
        </div>

        {/* API Status */}
        {Object.keys(prices).length > 0 && (
          <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-200 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <p className="text-body text-emerald-800 font-medium">Connected to API successfully!</p>
            </div>
            <p className="text-caption text-emerald-600 mt-1">
              Loaded {Object.keys(prices).length} waste price categories
            </p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg p-6 shadow-lg border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption">Active Requests</p>
                <p className="text-title">
                  {requests.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length}
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 p-3 rounded-lg shadow-sm">
                <Trash2 className="h-6 w-6 text-emerald-700" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-lg border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption">Waste Types</p>
                <p className="text-title">{Object.keys(prices).length}</p>
              </div>
              <div className="bg-gradient-to-br from-green-100 to-green-200 p-3 rounded-lg shadow-sm">
                <DollarSign className="h-6 w-6 text-green-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-emerald-800 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={() => router.push('/waste')}
              className="bg-white rounded-lg p-6 shadow-lg border border-emerald-200 text-left transition-all duration-200 hover:transform hover:-translate-y-1 hover:shadow-xl hover:border-emerald-300"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 p-3 rounded-lg shadow-sm">
                  <Plus className="h-6 w-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-subheading">Request Pickup</h3>
                  <p className="text-caption">Schedule waste collection</p>
                </div>
              </div>
            </button>
            
            <button 
              onClick={() => router.push('/marketplace')}
              className="bg-white rounded-lg p-6 shadow-lg border border-emerald-200 text-left transition-all duration-200 hover:transform hover:-translate-y-1 hover:shadow-xl hover:border-emerald-300"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-green-100 to-green-200 p-3 rounded-lg shadow-sm">
                  <ShoppingCart className="h-6 w-6 text-green-700" />
                </div>
                <div>
                  <h3 className="text-subheading">Browse Market</h3>
                  <p className="text-caption">Buy & sell items</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Waste Prices */}
        {Object.keys(prices).length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-lg border border-emerald-200 mb-6">
            <h2 className="text-xl font-bold text-emerald-800 mb-6">Current Waste Prices</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(prices).map(([type, price]) => (
                <div key={type} className="bg-white rounded-lg p-3 transition-smooth hover:bg-gradient-to-br hover:from-emerald-50 hover:to-green-50 border border-gray-200 hover:border-emerald-200 shadow-sm hover:shadow-md">
                  <p className="text-body font-medium capitalize text-emerald-700">{type}</p>
                  <p className="text-caption text-emerald-600 font-bold text-lg">${price}/kg</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-lg p-6 shadow-lg border border-emerald-200">
          <h2 className="text-xl font-bold text-emerald-800 mb-6">Recent Activity</h2>
          {requests.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-gradient-to-br from-emerald-100 to-green-200 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <TrendingUp className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-body mb-2 text-emerald-700">No recent activity</p>
              <p className="text-caption text-emerald-500">Start by creating your first waste pickup request!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests
                .slice()
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5)
                .map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-white rounded-lg transition-smooth hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 border border-gray-200 hover:border-emerald-200 shadow-sm hover:shadow-md">
                    <div>
                      <p className="text-body font-medium capitalize text-emerald-700">{request.waste_type}</p>
                      <p className="text-caption text-emerald-500">{request.quantity} kg • {request.pickup_address}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      request.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                      request.status === 'cancelled' ? 'bg-red-100 text-red-800 border border-red-200' :
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                      'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {request.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}