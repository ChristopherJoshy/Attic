'use client';

import { Home, Trash2, ShoppingCart, Heart, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: Trash2, label: 'Waste', href: '/waste' },
  { icon: ShoppingCart, label: 'Market', href: '/marketplace' },
  { icon: Heart, label: 'Donate', href: '/donate' },
  { icon: Settings, label: 'Profile', href: '/profile' },
];

export default function BottomBar() {
  const pathname = usePathname();

  return (
    <div className="bg-white border-t border-emerald-200 fixed bottom-0 left-0 right-0 z-50 shadow-lg">
      <div className="grid grid-cols-5">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center py-3 px-2 transition-all duration-200 relative ${
                isActive
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-gray-500 hover:text-emerald-500 hover:bg-gray-50'
              }`}
            >
              {isActive && (
                <div className="absolute -top-px left-1/2 transform -translate-x-1/2 w-8 h-1 bg-emerald-500 rounded-b-full"></div>
              )}
              <div className={`p-1 rounded-lg transition-transform ${
                isActive ? 'transform scale-110' : 'hover:transform hover:scale-105'
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-xs mt-1 font-medium ${
                isActive ? 'text-emerald-600' : ''
              }`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}