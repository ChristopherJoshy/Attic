import { useState, useEffect } from 'react';
import { TerminalEmulator } from '@/components/terminal-emulator';
import { AdminPanel } from '@/components/admin-panel';
import { StartupLoader } from '@/components/startup-loader';

export default function Terminal() {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [systemReady, setSystemReady] = useState(false);
  const [systemError, setSystemError] = useState(false);

  useEffect(() => {
    const handleOpenAdminGui = () => {
      setShowAdminPanel(true);
    };

    window.addEventListener('openAdminGui', handleOpenAdminGui);
    
    return () => {
      window.removeEventListener('openAdminGui', handleOpenAdminGui);
    };
  }, []);

  const handleStartupComplete = (success: boolean) => {
    if (success) {
      setSystemReady(true);
    } else {
      setSystemError(true);
    }
  };

  if (!systemReady && !systemError) {
    return <StartupLoader onComplete={handleStartupComplete} />;
  }

  if (systemError) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">System Error</h1>
          <p className="text-gray-400 mb-4">Failed to connect to backend services</p>
          <button 
            onClick={(e) => {
              e.preventDefault();
              setSystemError(false);
              setSystemReady(false);
            }} 
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <TerminalEmulator />
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </>
  );
}
