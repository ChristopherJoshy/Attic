'use client';

import { Bell, Menu, User, LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TopBarProps {
  title: string;
  user?: {
    name: string;
    role: string;
    email?: string;
  };
}

export default function TopBar({ title, user }: TopBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    router.push('/auth/login');
    setIsDropdownOpen(false);
  };
  return (
    <div className="text-white p-4 shadow-lg sticky top-0 z-50" style={{
      background: 'linear-gradient(135deg, #059669, #10b981)'
    }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button className="p-1 rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors">
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-semibold truncate">{title}</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors relative">
            <Bell className="h-5 w-5" />
            <div className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full w-5 h-5 flex items-center justify-center text-white font-medium">
              3
            </div>
          </button>
          {user ? (
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 bg-white bg-opacity-20 rounded-lg px-3 py-2 hover:bg-opacity-30 transition-colors"
              >
                <div className="bg-white bg-opacity-30 rounded-full p-1">
                  <User className="h-4 w-4" />
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium">{user.name}</div>
                  {user.email && (
                    <div className="text-xs opacity-75">{user.email}</div>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    {user.email && (
                      <div className="text-sm text-gray-600">{user.email}</div>
                    )}
                    <div className="text-xs text-emerald-600 capitalize mt-1">{user.role}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
              
              {/* Backdrop */}
              {isDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsDropdownOpen(false)}
                />
              )}
            </div>
          ) : (
            <button className="p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors">
              <User className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}