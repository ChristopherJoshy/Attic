import React, { useState } from 'react';
import { motion } from 'framer-motion';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log('Form submitted:', formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-[url('/textures/stone.png')] relative overflow-hidden py-12">
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900/95 to-stone-950/95" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl animate-torch" />
        <div className="absolute top-20 right-10 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl animate-torch-delayed" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="relative inline-block">
            <h1 className="medieval-title text-5xl md:text-7xl mb-6">
              📜 Royal Messages 📜
            </h1>
            <div className="absolute -top-6 -left-6 w-12 h-12 border-t-2 border-l-2 border-yellow-600/50" />
            <div className="absolute -top-6 -right-6 w-12 h-12 border-t-2 border-r-2 border-yellow-600/50" />
            <div className="absolute -bottom-6 -left-6 w-12 h-12 border-b-2 border-l-2 border-yellow-600/50" />
            <div className="absolute -bottom-6 -right-6 w-12 h-12 border-b-2 border-r-2 border-yellow-600/50" />
          </div>
          <p className="medieval-text text-xl md:text-2xl text-yellow-400/90 mt-4">
            ~ Your Words Shall Reach the Castle ~
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <div className="medieval-card p-8 relative">
            <div className="absolute -inset-[2px] bg-gradient-to-r from-yellow-900/50 via-yellow-600/50 to-yellow-900/50 rounded-lg" />
            <div className="absolute inset-0 bg-stone-900 rounded-lg" />
            <div className="relative">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <label className="medieval-text text-lg block text-yellow-400/90 flex items-center">
                    <span className="text-2xl mr-2">👤</span> Your Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full bg-stone-800/50 border-2 border-yellow-900/50 rounded-lg p-4 text-yellow-50 medieval-text focus:border-yellow-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 transition-all pl-12"
                      placeholder="Enter thy name, brave one..."
                      required
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-yellow-400/50">✧</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="medieval-text text-lg block text-yellow-400/90 flex items-center">
                    <span className="text-2xl mr-2">📜</span> Message Scroll (Email)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-stone-800/50 border-2 border-yellow-900/50 rounded-lg p-4 text-yellow-50 medieval-text focus:border-yellow-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 transition-all pl-12"
                      placeholder="Enter thy message scroll address..."
                      required
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-yellow-400/50">✧</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="medieval-text text-lg block text-yellow-400/90 flex items-center">
                    <span className="text-2xl mr-2">✉️</span> Your Message
                  </label>
                  <div className="relative">
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      className="w-full bg-stone-800/50 border-2 border-yellow-900/50 rounded-lg p-4 text-yellow-50 medieval-text focus:border-yellow-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 transition-all pl-12"
                      placeholder="Write thy message here, noble visitor..."
                      required
                    />
                    <div className="absolute left-4 top-6 text-yellow-400/50">✧</div>
                  </div>
                </div>

                <div className="text-center pt-4">
                  <button
                    type="submit"
                    className="medieval-button px-12 py-4 text-lg relative group overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      Send Message <span className="ml-2">📜</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/0 via-yellow-600/20 to-yellow-900/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  </button>
                </div>
              </form>

              <div className="mt-12 pt-8 border-t border-yellow-900/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="text-center transform hover:scale-105 transition-transform">
                    <div className="text-4xl mb-3 text-yellow-400/90">📬</div>
                    <h3 className="medieval-text text-lg text-yellow-400/90 mb-2">Royal Mail</h3>
                    <p className="medieval-text text-gray-300/90">contact@example.com</p>
                  </div>
                  <div className="text-center transform hover:scale-105 transition-transform">
                    <div className="text-4xl mb-3 text-yellow-400/90">📯</div>
                    <h3 className="medieval-text text-lg text-yellow-400/90 mb-2">Town Crier</h3>
                    <p className="medieval-text text-gray-300/90">+1 234 567 890</p>
                  </div>
                  <div className="text-center transform hover:scale-105 transition-transform">
                    <div className="text-4xl mb-3 text-yellow-400/90">🏰</div>
                    <h3 className="medieval-text text-lg text-yellow-400/90 mb-2">Castle Location</h3>
                    <p className="medieval-text text-gray-300/90">Digital Realm, Web Kingdom</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Contact; 