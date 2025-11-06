import React, { useState, useEffect, useMemo } from 'react';
import { FastingState } from '../types';
import { CloseIcon, HourglassIcon } from './Icons';
import { useTheme } from './contexts/ThemeContext';
import { triggerHapticFeedback } from '../utils/audio';

const FASTING_STATE_KEY = 'gemini-food-copilot-fasting-state';

const fastingPhases = [
  { name: 'Anabolic', startHour: 0, endHour: 4, description: 'Building phase where your body is digesting and absorbing nutrients.' },
  { name: 'Catabolic', startHour: 4, endHour: 16, description: 'Breaking down phase, insulin levels fall, and your body starts using stored energy.' },
  { name: 'Fat Burning', startHour: 16, endHour: 24, description: 'Ketosis begins. Your body is primarily using fat for fuel.' },
  { name: 'Autophagy', startHour: 24, endHour: Infinity, description: 'Cellular cleaning. Your body removes old, damaged cells to make way for new ones.' },
];

const fastingPlans = {
  'Intermittent Fasting': [
    { name: '12:12', hours: 12, description: 'A great starting point for IF.' },
    { name: '16:8', hours: 16, description: 'The most popular IF window.' },
    { name: '18:6', hours: 18, description: 'A more advanced IF schedule.' },
    { name: '20:4', hours: 20, description: 'The Warrior Diet, one large meal.' },
  ],
  'Prolonged Fasting': [
    { name: '24h', hours: 24, description: 'Also known as OMAD (One Meal A Day).' },
    { name: '36h', hours: 36, description: 'A full day of fasting to boost autophagy.' },
  ]
};

type Plan = { name: string; hours: number; description: string };

const FastingTracker: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
  const [fastingState, setFastingState] = useState<FastingState>({ startTime: null, isActive: false, planName: null, targetHours: null });
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    const savedState = localStorage.getItem(FASTING_STATE_KEY);
    if (savedState) {
      setFastingState(JSON.parse(savedState));
    }
  }, []);

  useEffect(() => {
    // FIX: Changed type from `number` to `ReturnType<typeof setInterval>` to correctly handle the timer ID from `setInterval`, which can be `NodeJS.Timeout` in some TypeScript configurations.
    let interval: ReturnType<typeof setInterval> | null = null;
    if (fastingState.isActive && fastingState.startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const start = new Date(fastingState.startTime!);
        const diff = now.getTime() - start.getTime();

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setElapsedTime({ hours, minutes, seconds });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fastingState]);
  
  const handleToggleFast = () => {
    triggerHapticFeedback(50);
    setFastingState(prevState => {
      const isStarting = !prevState.isActive;
      const newState: FastingState = {
        isActive: isStarting,
        startTime: isStarting ? new Date().toISOString() : null,
        planName: isStarting ? selectedPlan?.name || 'Open Fast' : null,
        targetHours: isStarting ? selectedPlan?.hours || null : null,
      };
      try {
        localStorage.setItem(FASTING_STATE_KEY, JSON.stringify(newState));
      } catch (error) {
        console.error("Failed to save fasting state to localStorage:", error);
        // Optionally, show an error to the user.
      }
      if (!newState.isActive) {
         setElapsedTime({ hours: 0, minutes: 0, seconds: 0 });
         setSelectedPlan(null);
      }
      return newState;
    });
  };
  
  const handleSelectPlan = (plan: Plan) => {
    triggerHapticFeedback(15);
    setSelectedPlan(plan);
  };
  
  const currentPhase = useMemo(() => {
    const elapsedHours = elapsedTime.hours + elapsedTime.minutes / 60;
    return fastingPhases.find(p => elapsedHours >= p.startHour && elapsedHours < p.endHour) || fastingPhases[fastingPhases.length -1];
  }, [elapsedTime]);

  const totalElapsedSeconds = elapsedTime.hours * 3600 + elapsedTime.minutes * 60 + elapsedTime.seconds;
  const progressPercent = fastingState.targetHours ? Math.min((totalElapsedSeconds / (fastingState.targetHours * 3600)) * 100, 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--component-bg)] backdrop-blur-xl rounded-2xl ring-1 ring-[var(--glass-border)] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-3"><HourglassIcon className="w-6 h-6 text-yellow-400" /><h2 className="text-xl font-bold text-[var(--text-primary)]">Fasting Tracker</h2></div>
          <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]"><CloseIcon className="w-6 h-6" /></button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6">
          {fastingState.isActive ? (
            <div className="text-center">
              <p className="font-mono text-5xl md:text-7xl font-bold text-[var(--text-primary)] tracking-tighter">
                  {String(elapsedTime.hours).padStart(2, '0')}:{String(elapsedTime.minutes).padStart(2, '0')}:{String(elapsedTime.seconds).padStart(2, '0')}
              </p>
              <div className="text-sm text-[var(--text-secondary)] mt-2">
                <p>Fasting Plan: <span className="font-semibold text-[var(--text-primary)]">{fastingState.planName}</span></p>
                {fastingState.targetHours && <p>Goal: {fastingState.targetHours} hours</p>}
              </div>

              <div className="my-6">
                <div className="relative w-full h-2 bg-zinc-700/50 rounded-full">
                  <div className="absolute h-2 bg-yellow-400 rounded-full" style={{ width: `${progressPercent}%` }} />
                </div>
                {fastingState.targetHours && <div className="flex justify-between text-xs mt-1 text-zinc-400"><span>0h</span><span>{fastingState.targetHours}h</span></div>}
              </div>
              
              <button onClick={handleToggleFast} className="w-full py-4 rounded-lg font-semibold text-lg bg-red-600 hover:bg-red-500 text-white transition-colors">End Fast</button>
              
              <div className={`mt-6 p-4 rounded-lg text-left ${isLight ? 'bg-rose-50' : 'bg-white/5'}`}>
                  <h4 className={`font-bold text-md ${isLight ? 'text-rose-800' : 'text-yellow-300'}`}>Current Phase: {currentPhase.name}</h4>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{currentPhase.description}</p>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-center text-[var(--text-primary)] mb-4">Choose Your Fasting Plan</h3>
              {Object.entries(fastingPlans).map(([category, plans]) => (
                <div key={category} className="mb-4">
                  <h4 className={`font-bold mb-2 ${isLight ? 'text-rose-700' : 'text-zinc-300'}`}>{category}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {plans.map(plan => (
                      <button key={plan.name} onClick={() => handleSelectPlan(plan)} className={`p-4 rounded-lg text-left transition-all ${selectedPlan?.name === plan.name ? 'ring-2 ring-yellow-400 bg-yellow-400/20' : (isLight ? 'bg-rose-100 hover:bg-rose-200' : 'bg-white/5 hover:bg-white/10')}`}>
                        <p className={`font-semibold ${isLight ? 'text-rose-800' : 'text-white'}`}>{plan.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{plan.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={handleToggleFast} disabled={!selectedPlan} className="w-full mt-4 py-4 rounded-lg font-semibold text-lg bg-yellow-500 hover:bg-yellow-400 text-black transition-colors disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed">
                Start {selectedPlan ? selectedPlan.name : ''} Fast
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FastingTracker;