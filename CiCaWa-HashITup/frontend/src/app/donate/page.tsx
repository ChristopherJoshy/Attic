'use client';

import { useState, useEffect } from 'react';
import { Heart, MapPin, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

type DonationType = 'food' | 'clothes' | 'other';

interface DonationForm {
  donation_type: DonationType;
  description: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  quantity: string;
  contact_info: string;
}

interface NGO {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  specialization: string[];
}

export default function DonatePage() {
  const [form, setForm] = useState<DonationForm>({
    donation_type: 'food',
    description: '',
    pickup_address: '',
    pickup_latitude: 0,
    pickup_longitude: 0,
    quantity: '',
    contact_info: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [ngos, setNGOs] = useState<NGO[]>([]);
  const [selectedNGO, setSelectedNGO] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error' | 'denied'>('loading');

  useEffect(() => {
    loadNGOs();
    getCurrentLocation();
  }, []);

  const loadNGOs = async () => {
    try {
      const ngoList = await api.getNGOs();
      setNGOs(ngoList);
    } catch (error) {
      console.error('Failed to load NGOs:', error);
      setMessage('Failed to load NGO information.');
      setNGOs([]);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by this browser.');
      setLocationStatus('error');
      return;
    }

    setLocationStatus('loading');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm(prev => ({
          ...prev,
          pickup_latitude: position.coords.latitude,
          pickup_longitude: position.coords.longitude,
        }));
        setLocationStatus('success');
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location.';
        let status: 'error' | 'denied' = 'error';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enter your address manually.';
            status = 'denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable. Please enter your address manually.';
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
        maximumAge: 300000
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNGO) {
      setMessage('Please select an NGO to donate to.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const donationPayload = {
        donation_type: form.donation_type,
        description: `${form.description}\n\nQuantity: ${form.quantity}\nContact: ${form.contact_info}${selectedNGO ? `\nPreferred NGO: ${ngos.find(n => n.id === selectedNGO)?.name}` : ''}`,
        pickup_address: form.pickup_address,
        pickup_latitude: form.pickup_latitude,
        pickup_longitude: form.pickup_longitude,
        source: 'household'
      };

      await api.createDonation(donationPayload);
      setMessage('Donation request submitted successfully! The NGO will contact you soon.');
      
      setForm({
        donation_type: 'food',
        description: '',
        pickup_address: form.pickup_address,
        pickup_latitude: form.pickup_latitude,
        pickup_longitude: form.pickup_longitude,
        quantity: '',
        contact_info: '',
      });
      setSelectedNGO(null);
    } catch (error) {
      console.error('Failed to create donation:', error);
      setMessage('Failed to submit donation request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFilteredNGOs = () => {
    return ngos.filter(ngo => 
      ngo.specialization.includes(form.donation_type) || 
      ngo.specialization.includes('other')
    );
  };

  if (loading) {
    return (
      <AppLayout title="Donate">
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-emerald-600">Loading donation information...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Donate">
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 pb-20">
        <div 
          className="text-white p-6" 
          style={{
            background: 'linear-gradient(135deg, #059669, #10b981, #34d399)'
          }}
        >
          <div className="container">
            <div className="flex items-center mb-4">
              <Heart className="h-8 w-8 mr-3" />
              <h1 className="text-title">Donate to NGOs</h1>
            </div>
            <p className="text-body opacity-90">
              Help those in need by donating food, clothes, or other items to registered NGOs in your area.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow-lg border border-emerald-200">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Donation Type */}
                <div>
                  <label className="form-label">
                    What would you like to donate?
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['food', 'clothes', 'other'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, donation_type: type }))}
                        className={`p-4 rounded-lg border-2 text-center capitalize transition-smooth ${
                          form.donation_type === type
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-2xl mb-2">
                          {type === 'food' && '🍱'}
                          {type === 'clothes' && '👕'}
                          {type === 'other' && '📦'}
                        </div>
                        <div className="text-body font-medium">{type}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="form-label">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what you're donating (e.g., home-cooked meals for 10 people, winter clothes for children, etc.)"
                    className="form-input"
                    rows={3}
                    required
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="form-label">Quantity/Amount</label>
                  <input
                    type="text"
                    value={form.quantity}
                    onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="e.g., 5 bags, 20 plates, 10 kg"
                    className="form-input"
                    required
                  />
                </div>

                {/* Contact Info */}
                <div>
                  <label className="form-label">
                    <Phone className="inline h-4 w-4 mr-1" />
                    Contact Information
                  </label>
                  <input
                    type="tel"
                    value={form.contact_info}
                    onChange={(e) => setForm(prev => ({ ...prev, contact_info: e.target.value }))}
                    placeholder="Your phone number for NGO to contact you"
                    className="form-input"
                    required
                  />
                </div>

                {/* Pickup Address */}
                <div>
                  <label className="form-label">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Pickup Address
                  </label>
                  <textarea
                    value={form.pickup_address}
                    onChange={(e) => setForm(prev => ({ ...prev, pickup_address: e.target.value }))}
                    placeholder="Enter your full address for pickup"
                    className="form-input"
                    rows={2}
                    required
                  />
                  {locationError && (
                    <p className="form-error mt-2">{locationError}</p>
                  )}
                </div>

                {/* NGO Selection */}
                <div>
                  <label className="form-label">Select NGO</label>
                  <div className="space-y-3">
                    {getFilteredNGOs().map((ngo) => (
                      <div
                        key={ngo.id}
                        onClick={() => setSelectedNGO(ngo.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-smooth ${
                          selectedNGO === ngo.id
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-subheading">{ngo.name}</h3>
                            <p className="text-caption mt-1">{ngo.address}</p>
                            <div className="flex items-center mt-2 space-x-4">
                              <div className="flex items-center text-caption">
                                <Phone className="h-4 w-4 mr-1" />
                                {ngo.phone}
                              </div>
                            </div>
                            <div className="mt-3">
                              <span className="badge badge-success">
                                Specializes in: {ngo.specialization.join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {getFilteredNGOs().length === 0 && (
                    <div className="text-center py-8">
                      <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <Heart className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-body mb-2">No NGOs available</p>
                      <p className="text-caption">No NGOs available for {form.donation_type} donations in your area.</p>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedNGO}
                  className="btn btn-primary btn-lg w-full"
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Heart className="h-5 w-5" />
                      <span>Submit Donation Request</span>
                    </>
                  )}
                </button>
              </form>

              {message && (
                <div className={`mt-4 p-4 rounded-lg ${
                  message.includes('successfully') 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {message}
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-subheading text-blue-900 mb-2">How it works:</h3>
                <ol className="text-caption text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Select what you want to donate</li>
                  <li>Choose an appropriate NGO from the list</li>
                  <li>Provide pickup details and contact info</li>
                  <li>NGO will contact you to arrange pickup</li>
                  <li>Your donation helps those in need! ❤️</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}