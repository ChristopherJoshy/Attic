'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, User, Mail, Lock, Phone, MapPin, ArrowLeft, Building, Home } from 'lucide-react';
import { api, RegisterData } from '@/lib/api';

type RegisterFormValues = Omit<RegisterData, 'is_business' | 'latitude' | 'longitude'> & {
  is_business: RegisterData['is_business'] | 'true' | 'false';
  latitude: RegisterData['latitude'] | string;
  longitude: RegisterData['longitude'] | string;
};

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // Multi-step form
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<RegisterFormValues>({
    defaultValues: {
      is_business: false,
      latitude: 0,
      longitude: 0
    }
  });

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. You can still continue with the default location.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue('latitude', position.coords.latitude);
        setValue('longitude', position.coords.longitude);
        setIsLocating(false);
      },
      (error: GeolocationPositionError) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. You can enable it in your browser settings or proceed with manual address details.'
            : error.code === error.POSITION_UNAVAILABLE
            ? 'We could not determine your location. Please check your connection or enter your address manually.'
            : 'Location request timed out. You can retry or continue with the address you provide.';

        setIsLocating(false);
        setLocationError(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const onSubmit = async (formData: RegisterFormValues) => {
    setIsLoading(true);
    setError('');

    const payload: RegisterData = {
      ...formData,
      latitude: typeof formData.latitude === 'string' ? parseFloat(formData.latitude) || 0 : formData.latitude,
      longitude: typeof formData.longitude === 'string' ? parseFloat(formData.longitude) || 0 : formData.longitude,
      is_business:
        typeof formData.is_business === 'string'
          ? formData.is_business === 'true'
          : formData.is_business,
    };

    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      setIsLoading(false);
      setError('Please provide a valid location (latitude and longitude).');
      return;
    }

    if (payload.password.length > 72) {
      setIsLoading(false);
      setError('Password must be 72 characters or fewer.');
      return;
    }

    try {
      const response = await api.register(payload);
      
      // Store user data
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // Redirect to onboarding or dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    setStep(step + 1);
    if (step === 1) {
      getCurrentLocation(); // Get location when moving to step 2
    }
  };

  const prevStep = () => setStep(step - 1);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {step > 1 ? (
              <button onClick={prevStep} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="h-6 w-6" />
              </button>
            ) : (
              <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="h-6 w-6" />
              </Link>
            )}
            <h1 className="text-xl font-semibold">Create Account</h1>
          </div>
          <div className="text-sm text-gray-500">
            Step {step} of 2
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4 h-2 bg-gray-200 rounded-full">
          <div 
            className="h-2 bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 p-6">
        <div className="max-w-md mx-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {step === 1 && (
              <>
                <div className="text-center mb-8">
                  <div className="bg-emerald-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <User className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Join CiCaWa</h2>
                  <p className="text-gray-700">Let's create your account</p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      {...register('name', { required: 'Name is required' })}
                      type="text"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-500"
                      placeholder="Enter your full name"
                    />
                  </div>
                  {errors.name && (
                    <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      {...register('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address'
                        }
                      })}
                      type="email"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-500"
                      placeholder="Enter your email"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters'
                        }
                      })}
                      type={showPassword ? 'text' : 'password'}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-500"
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200"
                >
                  Continue
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="text-center mb-8">
                  <div className="bg-emerald-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <MapPin className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact & Location</h2>
                  <p className="text-gray-700">Help us connect you with nearby services</p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      {...register('phone', { required: 'Phone number is required' })}
                      type="tel"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-500"
                      placeholder="Enter your phone number"
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>
                  )}
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <textarea
                      {...register('address', { required: 'Address is required' })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 placeholder-gray-500"
                      rows={3}
                      placeholder="Enter your full address"
                    />
                  </div>
                  {errors.address && (
                    <p className="text-red-600 text-sm mt-1">{errors.address.message}</p>
                  )}
                </div>

                {locationError && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {locationError}
                  </div>
                )}

                {isLocating && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Detecting your location…
                  </div>
                )}

                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={isLocating}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLocating ? 'Locating…' : 'Retry location detection'}
                </button>

                {/* Account Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    Account Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-emerald-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
                      <input
                        {...register('is_business')}
                        type="radio"
                        value="false"
                        className="sr-only"
                      />
                      <Home className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="font-medium">Personal</div>
                        <div className="text-sm text-gray-500">Individual user</div>
                      </div>
                    </label>
                    <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-emerald-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
                      <input
                        {...register('is_business')}
                        type="radio"
                        value="true"
                        className="sr-only"
                      />
                      <Building className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="font-medium">Business</div>
                        <div className="text-sm text-gray-500">Company account</div>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </>
            )}
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-gray-700">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-emerald-600 font-semibold hover:text-emerald-700">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}