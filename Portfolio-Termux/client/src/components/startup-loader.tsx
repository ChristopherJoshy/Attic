import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface StartupLoaderProps {
  onComplete: (success: boolean) => void;
}

interface SystemCheck {
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  duration?: number;
}

type SystemCheckTemplate = Omit<SystemCheck, 'status' | 'message'>;

const systemChecks: SystemCheckTemplate[] = [
  { name: 'Initializing system kernel', duration: 300 },
  { name: 'Mounting filesystem', duration: 400 },
  { name: 'Loading environment variables', duration: 200 },
  { name: 'Checking memory allocation', duration: 350 },
  { name: 'Establishing Firebase connection', duration: 600 },
  { name: 'Verifying database collections', duration: 500 },
  { name: 'Loading command registry', duration: 250 },
  { name: 'Initializing terminal subsystems', duration: 300 },
  { name: 'Configuring display settings', duration: 200 },
  { name: 'Starting portfolio service', duration: 400 }
];

export function StartupLoader({ onComplete }: StartupLoaderProps): JSX.Element {
  const [checks, setChecks] = useState<SystemCheck[]>(
    systemChecks.map(check => ({ ...check, status: 'pending' }))
  );
  const [currentStep, setCurrentStep] = useState(0);

  const updateCheck = (index: number, status: 'success' | 'error', message?: string) => {
    setChecks(prev => prev.map((check, i) => 
      i === index ? { ...check, status, message } : check
    ));
  };

  const runSystemChecks = async () => {
    try {
      for (let i = 0; i < checks.length; i++) {
        setCurrentStep(i);
        const check = checks[i];

        // Special checks for Firebase and Database
        if (check.name.includes('Firebase')) {
          try {
            await apiRequest('GET', '/api/health');
            updateCheck(i, 'success', '[OK]');
          } catch (error) {
            updateCheck(i, 'error', '[FAILED]');
            onComplete(false);
            return;
          }
        } else if (check.name.includes('database')) {
          try {
            await Promise.all([
              apiRequest('GET', '/api/projects'),
              apiRequest('GET', '/api/skills'),
              apiRequest('GET', '/api/bio'),
              apiRequest('GET', '/api/social')
            ]);
            updateCheck(i, 'success', '[OK]');
          } catch (error) {
            updateCheck(i, 'error', '[FAILED]');
            onComplete(false);
            return;
          }
        } else {
          // Simulate other system checks
          await new Promise(resolve => setTimeout(resolve, check.duration || 300));
          updateCheck(i, 'success', '[OK]');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      onComplete(true);
    } catch (error) {
      console.error('System checks failed:', error);
      onComplete(false);
    }
  };

  useEffect(() => {
    runSystemChecks();
  }, []);

  return (
    <div className="font-mono text-sm text-green-400 p-4 h-full overflow-auto">
      <div className="space-y-1">
        {checks.map((check, index) => (
          <div key={index} className={`
            ${currentStep === index && check.status === 'pending' ? 'animate-pulse' : ''}
            ${check.status === 'error' ? 'text-red-400' : ''}
            ${check.status === 'success' ? 'text-green-400' : ''}
            ${index > currentStep ? 'opacity-50' : ''}
          `}>
            {check.status === 'pending' && currentStep === index && (
              <span className="inline-block w-4">⋯</span>
            )}
            {check.status === 'success' && (
              <span className="inline-block w-4">✓</span>
            )}
            {check.status === 'error' && (
              <span className="inline-block w-4">✗</span>
            )}
            {check.status !== 'pending' && index !== currentStep && (
              <span className="inline-block w-4">·</span>
            )}
            <span className="ml-2">{check.name}</span>
            {check.message && (
              <span className="ml-2 opacity-80">{check.message}</span>
            )}
          </div>
        ))}
      </div>

      {currentStep === checks.length && checks.every(c => c.status === 'success') && (
        <div className="mt-4 text-yellow-400">
          System initialization complete. Starting terminal...
        </div>
      )}
    </div>
  );
}