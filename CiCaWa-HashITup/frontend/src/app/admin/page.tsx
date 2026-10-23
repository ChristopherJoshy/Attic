'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { Users, DollarSign, Settings, Shield, Edit3 } from 'lucide-react';
import { api, User as ApiUser, WastePriceUpdate } from '@/lib/api';

export default function AdminPage() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [roleUpdateStatus, setRoleUpdateStatus] = useState<string | null>(null);
  const [priceUpdateStatus, setPriceUpdateStatus] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ type: string; price: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<ApiUser[]>([]);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/auth/login');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    
    // Check if user is admin
    if (parsedUser.role !== 'admin') {
      alert('Access denied. Admin privileges required.');
      router.push('/dashboard');
      return;
    }
    
    setUser(parsedUser);
    
    // Load admin data
    const loadData = async () => {
      try {
        const userProfile = await api.getCurrentUser();
        console.log('✅ Admin authenticated:', userProfile);
        
        const [wastePrices, usersList] = await Promise.all([
          api.getWastePrices(),
          api.getAllUsers(),
        ]);
        setPrices(wastePrices);
        setUsers(usersList);
        setFilteredUsers(usersList);
      } catch (error) {
        console.error('❌ Admin API Error:', error);
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

  // Filter users based on search
  const handleSearchChange = (email: string) => {
    setSearchEmail(email);
    if (email.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(u => 
        u.email.toLowerCase().includes(email.toLowerCase()) ||
        u.name.toLowerCase().includes(email.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-caption text-emerald-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div>Loading...</div>;
  }

  const handleRoleUpdate = async (email: string, role: string) => {
    setIsUpdating(true);
    setRoleUpdateStatus(null);
    try {
      await api.updateUserRole(email, role);
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, role } : u))
      );
      setRoleUpdateStatus('Role updated successfully');
    } catch (error) {
      console.error('Failed to update role', error);
      setRoleUpdateStatus('Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePriceUpdate = async (payload: WastePriceUpdate) => {
    setIsUpdating(true);
    setPriceUpdateStatus(null);
    try {
      await api.updateWastePrice(payload);
      setPrices((prev) => ({ ...prev, [payload.waste_type]: payload.price_per_kg }));
      setPriceUpdateStatus('Price updated successfully');
      setEditingPrice(null);
    } catch (error) {
      console.error('Failed to update price', error);
      setPriceUpdateStatus('Failed to update price');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AppLayout title="Admin Panel" user={user} showBottomNav={false}>
      <div className="container py-6">
        {/* Admin Header */}
        {/* Admin Header */}
        <div 
          className="card mb-6 text-white" 
          style={{
            background: 'linear-gradient(135deg, #059669, #10b981, #34d399)'
          }}
        >
          <div className="flex items-center space-x-3">
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <Shield className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-title mb-2">Admin Panel</h1>
              <p className="text-body opacity-90">Welcome back, {user.name}!</p>
            </div>
          </div>
        </div>        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card card-compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption">Total Users</p>
                <p className="text-title">{users.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-caption">
                <span>Workers:</span>
                <span className="badge badge-info">{users.filter(u => u.role === 'worker').length}</span>
              </div>
              <div className="flex justify-between text-caption">
                <span>NGOs:</span>
                <span className="badge badge-success">{users.filter(u => u.role === 'ngo').length}</span>
              </div>
              <div className="flex justify-between text-caption">
                <span>Regular:</span>
                <span className="badge">{users.filter(u => u.role === 'user').length}</span>
              </div>
            </div>
          </div>
          
          <div className="card card-compact">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption">Waste Types</p>
                <p className="text-title">{Object.keys(prices).length}</p>
              </div>
              <div className="bg-emerald-100 p-3 rounded-lg">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="space-y-6">
          <section className="card bg-gradient-to-r from-emerald-50 to-green-50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-heading text-emerald-800">User Role Management</h2>
              {roleUpdateStatus && (
                <span className={`text-caption font-medium ${
                  roleUpdateStatus.includes('successfully') ? 'text-emerald-600' : 'text-red-600'
                }`}>{roleUpdateStatus}</span>
              )}
            </div>
            
            {/* Search Users */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-emerald-700 mb-2">
                Search Users by Email or Name
              </label>
              <input
                type="text"
                placeholder="Enter email or name to search..."
                value={searchEmail}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-emerald-600 mt-1">
                Found {filteredUsers.length} user(s) | Available roles: User, Worker, NGO, Haritha Karma, Admin
              </p>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-emerald-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-body text-emerald-700 mb-2">No users found</p>
                <p className="text-caption text-emerald-500">
                  {searchEmail ? 'Try adjusting your search terms' : 'No users available for management'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((userItem) => (
                  <div key={userItem.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-emerald-200 hover:border-emerald-300 transition-colors shadow-sm">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="bg-emerald-100 rounded-full p-2">
                          <Users className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-emerald-900">{userItem.name}</p>
                          <p className="text-sm text-emerald-700">{userItem.email}</p>
                          {userItem.phone && (
                            <p className="text-xs text-emerald-500">{userItem.phone}</p>
                          )}
                        </div>
                      </div>
                      {userItem.address && (
                        <p className="text-xs text-emerald-500 mt-2 truncate pl-11">{userItem.address}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          userItem.role === 'admin' ? 'bg-red-100 text-red-800 border-red-200' :
                          userItem.role === 'worker' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          userItem.role === 'ngo' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          userItem.role === 'haritha_karma' ? 'bg-green-100 text-green-800 border-green-200' :
                          'bg-gray-100 text-gray-800 border-gray-200'
                        }`}>
                          {userItem.role === 'haritha_karma' ? 'Haritha Karma' : userItem.role.toUpperCase()}
                        </span>
                        <p className="text-xs text-emerald-500 mt-1">
                          ID: {userItem.id}
                        </p>
                      </div>
                      <select
                        className="border border-emerald-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        value={userItem.role}
                        onChange={(event) => handleRoleUpdate(userItem.email, event.target.value)}
                        disabled={isUpdating}
                      >
                        <option value="user">User</option>
                        <option value="worker">Worker</option>
                        <option value="ngo">NGO</option>
                        <option value="haritha_karma">Haritha Karma</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Waste Price Management</h2>
              {priceUpdateStatus && (
                <span className="text-sm text-gray-600">{priceUpdateStatus}</span>
              )}
            </div>
            {Object.keys(prices).length === 0 ? (
              <p className="text-sm text-gray-600">No waste prices available.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(prices).map(([type, price]) => (
                  <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{type}</p>
                      <p className="text-sm text-gray-600">Current rate</p>
                    </div>
                    {editingPrice?.type === type ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const formData = new FormData(event.currentTarget);
                          const priceValue = parseFloat(formData.get('price') as string);
                          handlePriceUpdate({ waste_type: type, price_per_kg: priceValue });
                        }}
                        className="flex items-center space-x-2"
                      >
                        <input
                          name="price"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={editingPrice.price}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24"
                          required
                        />
                        <button
                          type="submit"
                          className="px-3 py-2 text-sm font-semibold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600"
                          disabled={isUpdating}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPrice(null)}
                          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <p className="text-lg font-semibold text-emerald-600">${price}/kg</p>
                        <button
                          onClick={() => setEditingPrice({ type, price })}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <Edit3 className="h-4 w-4" />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* System Monitoring */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">System Monitoring</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Pickup Oversight</h3>
              <p className="text-sm text-blue-700 mb-3">Monitor waste collection activities</p>
              <button
                onClick={async () => {
                  try {
                    const requests = await api.getWasteRequests();
                    alert(`Active Requests: ${requests.filter(r => r.status === 'pending').length}\nIn Progress: ${requests.filter(r => r.status === 'in_progress').length}\nCompleted: ${requests.filter(r => r.status === 'completed').length}`);
                  } catch (error) {
                    alert('Failed to load pickup data');
                  }
                }}
                className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700"
              >
                View Status
              </button>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">User Activity</h3>
              <p className="text-sm text-green-700 mb-3">Track user engagement</p>
              <div className="text-xs text-green-600">
                <div>Total Users: {users.length}</div>
                <div>Active Roles: {new Set(users.map(u => u.role)).size}</div>
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium text-purple-900 mb-2">Price Management</h3>
              <p className="text-sm text-purple-700 mb-3">Control waste pricing</p>
              <div className="text-xs text-purple-600">
                <div>Configured Types: {Object.keys(prices).length}</div>
                <div>Avg Price: ${Object.keys(prices).length > 0 ? (Object.values(prices).reduce((a, b) => a + b, 0) / Object.values(prices).length).toFixed(2) : '0.00'}/kg</div>
              </div>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">System Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Settings className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Quick Actions</h3>
                <p className="text-sm text-gray-600">Administrative tools and system management</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={async () => {
                  try {
                    const allRequests = await api.getWasteRequests();
                    const donations = await api.getDonations();
                    const listings = await api.getMarketplaceListings();
                    
                    const report = `
System Report:
- Total Users: ${users.length}
- Waste Requests: ${allRequests.length}
- Donations: ${donations.length}
- Marketplace Listings: ${listings.length}
- Configured Waste Types: ${Object.keys(prices).length}
                    `;
                    alert(report);
                  } catch (error) {
                    alert('Failed to generate system report');
                  }
                }}
                className="p-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-left border"
              >
                <div className="font-medium text-blue-900">Generate System Report</div>
                <div className="text-sm text-blue-700">View comprehensive system statistics</div>
              </button>
              
              <button
                onClick={() => {
                  const confirm = window.confirm('This will reload all system data. Continue?');
                  if (confirm) {
                    window.location.reload();
                  }
                }}
                className="p-3 bg-green-50 hover:bg-green-100 rounded-lg text-left border"
              >
                <div className="font-medium text-green-900">Refresh System Data</div>
                <div className="text-sm text-green-700">Reload all administrative information</div>
              </button>
              
              <button
                onClick={() => {
                  const message = `
Admin Access Instructions:
1. Only designated admins can access this panel
2. Role changes take effect immediately
3. Price updates affect all new requests
4. Monitor pickup activities regularly
5. System reports provide comprehensive insights
                  `;
                  alert(message);
                }}
                className="p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg text-left border"
              >
                <div className="font-medium text-yellow-900">Admin Guidelines</div>
                <div className="text-sm text-yellow-700">View administrative best practices</div>
              </button>
              
              <button
                onClick={() => {
                  const confirm = window.confirm('Are you sure you want to log out?');
                  if (confirm) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    router.push('/auth/login');
                  }
                }}
                className="p-3 bg-red-50 hover:bg-red-100 rounded-lg text-left border"
              >
                <div className="font-medium text-red-900">Admin Logout</div>
                <div className="text-sm text-red-700">Securely end admin session</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}