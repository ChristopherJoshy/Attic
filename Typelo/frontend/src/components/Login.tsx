/*   _________      ____   ____ ____ ____  ______  __   __ 
 *  |  _______|    / __ \ / __ \_  _|  _ \|  ____| \ \ / / 
 *  | |__ __    __/ /  \ | |  | || || | \ | |__     \ V /  
 *  |  __|  \  / /| |  | | |  | || || |  \|  __|     > <   
 *  | |____  \/ / | |__| | |__| || || |_/ | |____   / . \  
 *  |______|  \_\  \____/ \____/|___|____/|______| /_/ \_\ 
 *                                                         
 *  Login Component - Minimal authentication entry point.
 *  Clean, elegant design with no animations.
 */

import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import GoogleIcon from './icons/GoogleIcon'
import SEOHead from './SEOHead'
import { faqSchema } from '../data/faqData'

export default function Login() {
  const { signInWithGoogle, registerAsGuest, signInAsGuest, loading, error } = useAuth()

  // Guest mode state
  const [showGuestMode, setShowGuestMode] = useState(false)
  const [isNewGuest, setIsNewGuest] = useState(true)
  const [guestUsername, setGuestUsername] = useState('')
  const [guestPassword, setGuestPassword] = useState('')
  const [guestError, setGuestError] = useState('')

  const handleGuestSubmit = async () => {
    setGuestError('')

    if (guestUsername.length < 3 || guestUsername.length > 20) {
      setGuestError('Username must be 3-20 characters')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(guestUsername)) {
      setGuestError('Username can only contain letters, numbers, and underscores')
      return
    }
    if (guestPassword.length < 6) {
      setGuestError('Password must be at least 6 characters')
      return
    }

    try {
      if (isNewGuest) {
        await registerAsGuest(guestUsername, guestPassword)
      } else {
        await signInAsGuest(guestUsername, guestPassword)
      }
    } catch (err: any) {
      setGuestError(err.message || 'Authentication failed')
    }
  }

  return (
    <>
      <SEOHead
        title="Sign In"
        description="Sign in to Typelo, the real-time 1v1 competitive typing game. Battle opponents, climb ELO rankings, and prove your typing skills."
        path="/"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="min-h-screen w-full flex items-center justify-center bg-black p-4 sm:p-6">
        {/* Main Card */}
        <div className="w-full max-w-md">
          {/* Logo & Brand */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 mb-6">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
              Typelo
            </h1>
            <p className="text-neutral-400 text-sm sm:text-base">
              1v1 Competitive Typing
            </p>
          </div>

          {/* Card Container */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">

            {!showGuestMode ? (
              /* Main Auth Options */
              <div className="space-y-4">
                {/* Google Sign In */}
                <button
                  onClick={signInWithGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 
                           px-6 py-4 rounded-xl
                           bg-white text-neutral-900 font-medium
                           hover:bg-neutral-100 
                           active:scale-[0.99]
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-black
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                >
                  <GoogleIcon className="w-5 h-5" />
                  <span>Continue with Google</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 py-2">
                  <div className="flex-1 h-px bg-neutral-800" />
                  <span className="text-neutral-500 text-xs uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-neutral-800" />
                </div>

                {/* Guest Mode Button */}
                <button
                  onClick={() => setShowGuestMode(true)}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 
                           px-6 py-4 rounded-xl
                           bg-neutral-800 border border-neutral-700 
                           text-white font-medium
                           hover:bg-neutral-750 hover:border-neutral-600
                           active:scale-[0.99]
                           focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-black
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                >
                  <svg className="w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                  </svg>
                  <span>Play as Guest</span>
                </button>
              </div>
            ) : (
              /* Guest Form */
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white text-center mb-6">
                  {isNewGuest ? 'Create Guest Account' : 'Guest Login'}
                </h2>

                {/* Username */}
                <input
                  type="text"
                  placeholder="Username"
                  value={guestUsername}
                  onChange={(e) => setGuestUsername(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl
                           bg-neutral-800 border border-neutral-700
                           text-white placeholder-neutral-500
                           focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                           transition-colors"
                  maxLength={20}
                />

                {/* Password */}
                <input
                  type="password"
                  placeholder="Password"
                  value={guestPassword}
                  onChange={(e) => setGuestPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl
                           bg-neutral-800 border border-neutral-700
                           text-white placeholder-neutral-500
                           focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                           transition-colors"
                  maxLength={50}
                />

                {/* Submit Button */}
                <button
                  onClick={handleGuestSubmit}
                  disabled={loading || !guestUsername || !guestPassword}
                  className="w-full px-6 py-4 rounded-xl
                           bg-primary-500 text-white font-medium
                           hover:bg-primary-600
                           active:scale-[0.99]
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-black
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                >
                  {loading ? 'Please wait...' : (isNewGuest ? 'Create Account' : 'Login')}
                </button>

                {/* Toggle */}
                <p
                  onClick={() => setIsNewGuest(!isNewGuest)}
                  className="text-neutral-400 text-sm text-center cursor-pointer hover:text-white transition-colors"
                >
                  {isNewGuest ? 'Already have an account? Login' : 'New here? Create an account'}
                </p>

                {/* Back Button */}
                <button
                  onClick={() => {
                    setShowGuestMode(false)
                    setGuestError('')
                  }}
                  className="w-full text-neutral-500 text-sm hover:text-white transition-colors pt-2"
                >
                  ← Back to sign in options
                </button>

              </div>
            )}

            {/* Error Message */}
            {(error || guestError) && (
              <div className="mt-4 p-4 bg-red-950/30 border border-red-900/50 rounded-xl">
                <p className="text-red-400 text-sm text-center">
                  {error || guestError}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-8 space-y-2">
            <p className="text-neutral-600 text-xs">
              Real-time 1v1 competitive typing game
            </p>
            <div className="flex items-center justify-center gap-2 text-neutral-500 text-xs">
              <span>made by chris</span>
              <span>•</span>
              <a
                href="https://github.com/christopherjoshy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                github
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
