'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { api, User, WasteRequest, WasteTypeOption, WasteRequestPayload } from '@/lib/api';
import { Loader2, MapPin, PackagePlus, Recycle } from 'lucide-react';

interface FormState {
  waste_type: string;
  quantity: number;
  description: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
}

export default function WastePage() {
  const [user, setUser] = useState<User | null>(null);
  const [wasteTypes, setWasteTypes] = useState<WasteTypeOption[]>([]);
  const [requests, setRequests] = useState<WasteRequest[]>([]);
  const [form, setForm] = useState<FormState>({
    waste_type: '',
    quantity: 1,
    description: '',
    pickup_address: '',
    pickup_latitude: 0,
    pickup_longitude: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error' | 'denied'>('loading');
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/auth/login');
      return;
    }

    const parsedUser: User = JSON.parse(userData);
    setUser(parsedUser);

    const loadInitialData = async () => {
      try {
        const [types, existingRequests] = await Promise.all([
          api.getWasteTypes(),
          api.getWasteRequests(),
        ]);
        setWasteTypes(types);
        setRequests(existingRequests);
        if (types.length > 0) {
          setForm((prev) => ({ ...prev, waste_type: prev.waste_type || types[0].value }));
        }
      } catch (error) {
        console.error('Failed to load waste page data', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [router]);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by this browser.');
      setLocationStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          pickup_latitude: Number(position.coords.latitude.toFixed(6)),
          pickup_longitude: Number(position.coords.longitude.toFixed(6)),
        }));
        setLocationStatus('success');
        setLocationError(null);
      },
      (error) => {
        console.warn('Geolocation unavailable', error);
        
        let errorMessage = 'Unable to get your location.';
        let status: 'error' | 'denied' = 'error';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enter your address manually or enable location permissions.';
            status = 'denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please enter your address manually.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please enter your address manually.';
            break;
          default:
            errorMessage = 'An unknown error occurred while retrieving your location.';
            break;
        }
        
        setLocationError(errorMessage);
        setLocationStatus(status);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  }, []);

  const requestLocationPermission = () => {
    setLocationStatus('loading');
    setLocationError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          pickup_latitude: Number(position.coords.latitude.toFixed(6)),
          pickup_longitude: Number(position.coords.longitude.toFixed(6)),
        }));
        setLocationStatus('success');
        setLocationError(null);
      },
      (error) => {
        let errorMessage = 'Unable to get your location.';
        let status: 'error' | 'denied' = 'error';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
            status = 'denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        
        setLocationError(errorMessage);
        setLocationStatus(status);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Force fresh location
      }
    );
  };

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]:
        field === 'quantity' || field === 'pickup_latitude' || field === 'pickup_longitude'
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const payload: WasteRequestPayload = {
        waste_type: form.waste_type,
        quantity: form.quantity,
        description: form.description,
        pickup_address: form.pickup_address,
        pickup_latitude: form.pickup_latitude,
        pickup_longitude: form.pickup_longitude,
      };

      await api.createWasteRequest(payload, undefined);
      setMessage('Waste pickup request submitted successfully.');
      setForm((prev) => ({
        ...prev,
        quantity: 1,
        description: '',
        pickup_address: '',
      }));
      const updatedRequests = await api.getWasteRequests();
      setRequests(updatedRequests);
    } catch (error) {
      console.error('Failed to create waste request', error);
      setMessage('Failed to submit waste pickup request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-emerald-600">Loading waste management...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="Waste Pickup" user={user}>
      <div className="p-4 space-y-6">
        <section className="bg-white rounded-lg p-4 shadow-sm border border-emerald-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 p-3 rounded-lg shadow-sm">
              <Recycle className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">Schedule Pickup</h2>
              <p className="text-sm text-emerald-600">Request a waste collection with AI-assisted pricing.</p>
            </div>
          </div>

          {message && (
            <div className="mb-4 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-4 py-3">
              {message}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Waste Type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                value={form.waste_type}
                onChange={(event) => handleChange('waste_type', event.target.value)}
                required
              >
                {wasteTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg)</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={form.quantity}
                onChange={(event) => handleChange('quantity', event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => handleChange('description', event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                rows={3}
                placeholder="Provide any useful details for pickup"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="inline h-4 w-4 mr-1" />
                Pickup Address
              </label>
              
              {/* Location Status */}
              {locationStatus === 'loading' && (
                <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center text-sm text-blue-700">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Getting your location...
                  </div>
                </div>
              )}
              
              {locationStatus === 'success' && form.pickup_latitude !== 0 && (
                <div className="mb-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-green-700">
                      ✓ Location detected successfully
                    </div>
                    <button
                      type="button"
                      onClick={requestLocationPermission}
                      className="text-xs text-green-600 hover:text-green-800 underline"
                    >
                      Update location
                    </button>
                  </div>
                </div>
              )}
              
              {(locationStatus === 'error' || locationStatus === 'denied') && locationError && (
                <div className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-sm text-yellow-800 mb-2">
                    {locationError}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={requestLocationPermission}
                      className="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLocationError(null);
                        setLocationStatus('error');
                      }}
                      className="text-xs text-yellow-600 hover:text-yellow-800 underline"
                    >
                      Enter Manually
                    </button>
                  </div>
                </div>
              )}
              
              <textarea
                value={form.pickup_address}
                onChange={(event) => handleChange('pickup_address', event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                rows={2}
                placeholder={locationStatus === 'success' ? "Address detected via GPS (you can edit if needed)" : "Street, city, zipcode"}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  type="number"
                  value={form.pickup_latitude}
                  onChange={(event) => handleChange('pickup_latitude', event.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  step={0.000001}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  type="number"
                  value={form.pickup_longitude}
                  onChange={(event) => handleChange('pickup_longitude', event.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  step={0.000001}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <PackagePlus className="h-5 w-5" />
                  <span>Request Pickup</span>
                </>
              )}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <MapPin className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your Requests</h2>
              <p className="text-sm text-gray-600">Track status and pricing for your pickups.</p>
            </div>
          </div>

          {requests.length === 0 ? (
            <p className="text-sm text-gray-600">No waste pickup requests yet. Submit your first request above.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 capitalize">{request.waste_type}</p>
                      <p className="text-xs text-gray-500">Created {new Date(request.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      {request.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{request.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-3">
                    <div>Quantity: {request.quantity} kg</div>
                    <div>Estimated Price: {request.estimated_price ? `$${request.estimated_price.toFixed(2)}` : 'Pending'}</div>
                    <div>Confidence: {request.confidence_score ? `${Math.round(request.confidence_score * 100)}%` : 'N/A'}</div>
                    <div>Worker: {request.worker_name || 'Unassigned'}</div>
                    <div className="col-span-2">Pickup: {request.pickup_address}</div>
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
