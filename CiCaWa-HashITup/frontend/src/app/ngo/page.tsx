'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { api, Donation, User } from '@/lib/api';
import { Building2, CheckCircle2, Gift, MapPin } from 'lucide-react';

export default function NgoPage() {
  const [user, setUser] = useState<User | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/auth/login');
      return;
    }

    const parsedUser: User = JSON.parse(userData);
    if (parsedUser.role !== 'ngo') {
      router.push('/dashboard');
      return;
    }

    setUser(parsedUser);

    const loadDonations = async () => {
      try {
        const fetchedDonations = await api.getDonations();
        setDonations(fetchedDonations);
      } catch (error) {
        console.error('Failed to load donations', error);
      } finally {
        setLoading(false);
      }
    };

    loadDonations();
  }, [router]);

  const pendingDonations = useMemo(
    () => donations.filter((donation) => donation.status === 'pending'),
    [donations]
  );

  const acceptedDonations = useMemo(
    () => donations.filter((donation) => donation.status !== 'pending'),
    [donations]
  );

  const refreshDonations = async () => {
    const fetchedDonations = await api.getDonations();
    setDonations(fetchedDonations);
  };

  const handleAccept = async (donationId: number) => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      await api.acceptDonation(donationId);
      await refreshDonations();
      setStatusMessage('Donation accepted successfully.');
    } catch (error) {
      console.error('Failed to accept donation', error);
      setStatusMessage('Failed to accept donation.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p>Loading NGO dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="NGO Hub" user={user} showBottomNav={false}>
      <div className="p-4 space-y-6">
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-emerald-100 p-3 rounded-lg">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Available Donations</h2>
              <p className="text-sm text-gray-600">Match surplus goods with organizations in need.</p>
            </div>
          </div>

          {statusMessage && (
            <div className="mb-4 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-4 py-3">
              {statusMessage}
            </div>
          )}

          {pendingDonations.length === 0 ? (
            <p className="text-sm text-gray-600">No pending donations right now. Check back soon!</p>
          ) : (
            <div className="space-y-3">
              {pendingDonations.map((donation) => (
                <div key={donation.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 capitalize">{donation.donation_type}</p>
                      <p className="text-xs text-gray-500">Offered {new Date(donation.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      pending
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{donation.description}</p>
                  <div className="text-sm text-gray-600 mt-2 flex items-center space-x-2">
                    <MapPin className="h-4 w-4" />
                    <span>{donation.pickup_address}</span>
                  </div>
                  <button
                    onClick={() => handleAccept(donation.id)}
                    className="mt-3 w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200"
                    disabled={isUpdating}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Accept Donation</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Gift className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Accepted Donations</h2>
              <p className="text-sm text-gray-600">Track commitments and coordinate logistics.</p>
            </div>
          </div>

          {acceptedDonations.length === 0 ? (
            <p className="text-sm text-gray-600">No active commitments yet.</p>
          ) : (
            <div className="space-y-3">
              {acceptedDonations.map((donation) => (
                <div key={donation.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 capitalize">{donation.donation_type}</p>
                    <span className="text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      {donation.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{donation.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-600 mt-3">
                    <span>{donation.source}</span>
                    <span>{new Date(donation.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
