'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { api, User } from '@/lib/api';
import { LogOut, Mail, MapPin, Phone, Settings, ShieldCheck, UserCircle2 } from 'lucide-react';

interface ProfileDetails extends User {
  address?: string;
  phone?: string;
  is_business?: boolean;
}

export default function ProfilePage() {
  const [user, setUser] = useState<ProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/auth/login');
      return;
    }

    const parsedUser: User = JSON.parse(userData);
    const loadProfile = async () => {
      try {
        const [profile, debug] = await Promise.all([
          api.getCurrentUser(),
          api.getDebugInfo(),
        ]);
        setUser({ ...parsedUser, ...profile });
        setDebugInfo(debug);
      } catch (error) {
        console.error('Failed to load profile', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleLogout = () => {
    api.logout();
    router.push('/auth/login');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-emerald-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="Profile" user={user}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-lg p-6 shadow-lg border border-emerald-200">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 p-3 rounded-lg shadow-sm">
              <UserCircle2 className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-800">Account Overview</h2>
              <p className="text-emerald-600">Manage your CiCaWa identity and security settings.</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="font-medium capitalize">Role: {user.role}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-emerald-500" />
              <span>{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-emerald-500" />
                <span>{user.phone}</span>
              </div>
            )}
            {user.address && (
              <div className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 text-emerald-500 mt-1" />
                <span>{user.address}</span>
              </div>
            )}
            {typeof user.is_business === 'boolean' && (
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-emerald-500" />
                <span>{user.is_business ? 'Business account' : 'Personal account'}</span>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Platform Diagnostics</h2>
          {debugInfo ? (
            <div className="grid grid-cols-1 gap-3 text-sm text-gray-700">
              <div>
                <p className="font-medium">Environment</p>
                <p>{debugInfo.server?.environment}</p>
              </div>
              <div>
                <p className="font-medium">Database URL</p>
                <p className="truncate">{debugInfo.server?.database_url}</p>
              </div>
              <div>
                <p className="font-medium">App Version</p>
                <p>{debugInfo.server?.port ? `Port ${debugInfo.server.port}` : 'N/A'}</p>
              </div>
              <div>
                <p className="font-medium">System</p>
                <p>{debugInfo.system?.platform}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Diagnostics unavailable.</p>
          )}
        </section>

        <button
          onClick={handleLogout}
          className="w-full inline-flex items-center justify-center space-x-2 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 focus:ring-4 focus:ring-red-200"
        >
          <LogOut className="h-5 w-5" />
          <span>Log out</span>
        </button>
      </div>
    </AppLayout>
  );
}
