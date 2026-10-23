'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { api, User, WasteRequest } from '@/lib/api';
import { CheckCircle, Loader2, MapPin, RefreshCw, Shield, Truck } from 'lucide-react';

export default function WorkerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<WasteRequest[]>([]);
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
    if (parsedUser.role !== 'worker') {
      router.push('/dashboard');
      return;
    }

    setUser(parsedUser);

    const loadRequests = async () => {
      try {
        const fetchedRequests = await api.getWasteRequests();
        setRequests(fetchedRequests);
      } catch (error) {
        console.error('Failed to load worker requests', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [router]);

  const assignedRequests = useMemo(
    () => requests.filter((request) => request.worker_id === user?.id),
    [requests, user?.id]
  );

  const availableRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests]
  );

  const refreshRequests = async () => {
    const fetchedRequests = await api.getWasteRequests();
    setRequests(fetchedRequests);
  };

  const handleAccept = async (requestId: number) => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      await api.acceptWasteRequest(requestId);
      await refreshRequests();
      setStatusMessage('Request assigned successfully.');
    } catch (error) {
      console.error('Failed to accept request', error);
      setStatusMessage('Failed to accept request.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusUpdate = async (requestId: number, status: string) => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      await api.updateWasteRequestStatus(requestId, status);
      await refreshRequests();
      setStatusMessage('Request status updated.');
    } catch (error) {
      console.error('Failed to update request status', error);
      setStatusMessage('Failed to update status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLocationUpdate = () => {
    if (!('geolocation' in navigator)) {
      setStatusMessage('Geolocation is not supported on this device.');
      return;
    }

    setIsUpdating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.updateWorkerLocation(position.coords.latitude, position.coords.longitude);
          setStatusMessage('Location shared with dispatch.');
        } catch (error) {
          console.error('Failed to update location', error);
          setStatusMessage('Failed to update location.');
        } finally {
          setIsUpdating(false);
        }
      },
      (error) => {
        console.error('Geolocation error', error);
        setStatusMessage('Unable to retrieve location.');
        setIsUpdating(false);
      }
    );
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p>Loading worker dispatch...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="Worker Dispatch" user={user} showBottomNav={false}>
      <div className="p-4 space-y-6">
        <section className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-emerald-100 p-3 rounded-lg">
              <Shield className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your Assignments</h2>
              <p className="text-sm text-gray-600">Manage pickups assigned to you and share progress.</p>
            </div>
          </div>

          {statusMessage && (
            <div className="mb-4 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-4 py-3">
              {statusMessage}
            </div>
          )}

          <button
            onClick={handleLocationUpdate}
            className="w-full inline-flex items-center justify-center space-x-2 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 focus:ring-4 focus:ring-blue-200 mb-4"
            disabled={isUpdating}
          >
            <MapPin className="h-5 w-5" />
            <span>Share Live Location</span>
          </button>

          {assignedRequests.length === 0 ? (
            <p className="text-sm text-gray-600">No active assignments yet. Accept a request below to get started.</p>
          ) : (
            <div className="space-y-3">
              {assignedRequests.map((request) => (
                <div key={request.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{request.waste_type}</p>
                      <p className="text-xs text-gray-500">Pickup at {request.pickup_address}</p>
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      {request.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{request.description}</p>
                  <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
                    <span>{request.quantity} kg</span>
                    <span>
                      {request.estimated_price
                        ? `$${request.estimated_price.toFixed(2)}`
                        : 'Pricing pending'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 mt-3">
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'in_progress')}
                      className="flex-1 inline-flex items-center justify-center space-x-2 bg-amber-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-amber-600 focus:ring-4 focus:ring-amber-200"
                      disabled={isUpdating || request.status === 'in_progress'}
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Mark In Progress</span>
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'completed')}
                      className="flex-1 inline-flex items-center justify-center space-x-2 bg-emerald-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200"
                      disabled={isUpdating || request.status === 'completed'}
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Complete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Available Requests</h2>
              <p className="text-sm text-gray-600">Pick up nearby tasks to support the community.</p>
            </div>
          </div>

          {availableRequests.length === 0 ? (
            <p className="text-sm text-gray-600">No pending requests at the moment.</p>
          ) : (
            <div className="space-y-3">
              {availableRequests.map((request) => (
                <div key={request.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{request.waste_type}</p>
                      <p className="text-xs text-gray-500">Pickup at {request.pickup_address}</p>
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      pending
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{request.description}</p>
                  <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
                    <span>{request.quantity} kg</span>
                    <span>
                      {request.estimated_price
                        ? `$${request.estimated_price.toFixed(2)}`
                        : 'Pricing pending'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAccept(request.id)}
                    className="mt-3 w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200"
                    disabled={isUpdating}
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Accept Request</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
