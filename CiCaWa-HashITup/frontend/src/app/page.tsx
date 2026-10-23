import Link from 'next/link';
import { Recycle, Users, ShoppingBag, MessageSquare } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-500 to-emerald-600">
      {/* Hero Section */}
      <div className="text-white px-6 py-12">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 rounded-full p-4">
              <Recycle className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">CiCaWa</h1>
          <p className="text-xl opacity-90 mb-2">Waste Management Platform</p>
          <p className="text-sm opacity-75">
            Turn your waste into value, connect with workers, and make a difference
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <FeatureCard 
            icon={<Recycle className="h-6 w-6" />}
            title="Waste Pickup"
            description="AI-powered waste classification and pickup"
          />
          <FeatureCard 
            icon={<Users className="h-6 w-6" />}
            title="Connect Workers"
            description="Find nearby waste workers instantly"
          />
          <FeatureCard 
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Marketplace"
            description="Buy and sell items easily"
          />
          <FeatureCard 
            icon={<MessageSquare className="h-6 w-6" />}
            title="Real-time Chat"
            description="Communicate with workers and buyers"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="block w-full bg-white text-emerald-600 py-4 rounded-lg font-semibold text-center text-lg shadow-lg"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="block w-full bg-emerald-700 text-white py-4 rounded-lg font-semibold text-center text-lg border-2 border-emerald-400"
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* Bottom Info */}
      <div className="px-6 pb-8">
        <div className="bg-white/10 rounded-lg p-4 text-white/80 text-sm">
          <p className="text-center">
            Join thousands of users making waste management efficient and profitable
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
      <div className="text-white/90 mb-2">{icon}</div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-white/70">{description}</p>
    </div>
  );
}