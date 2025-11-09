import React from 'react';
import { UserProfile, DailySummaryEntry } from '../types';

interface CircularProgressProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ value, max, label, unit = '' }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const strokeDasharray = `${percentage}, 100`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-16">
        <svg className="size-full" viewBox="0 0 36 36">
          <path
            className="stroke-white/10"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            strokeWidth="3"
          />
          <path
            className="stroke-[#d8b4fe]"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-white">{Math.round(value)}{unit}</span>
          <span className="text-[10px] text-white/60">{max > 0 ? 'target' : 'kcal'}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-white/70">{label}</span>
    </div>
  );
};

interface GreetingProps {
  userProfile: UserProfile | null;
  dailySummaries: DailySummaryEntry[];
  onOpenHeyCoach: () => void;
  onOpenDietAnalysis: () => void;
  onOpenFastingTracker: () => void;
  onOpenWhatIfFood: () => void;
  onNavigate: (view: string) => void;
}

const Greeting: React.FC<GreetingProps> = ({
    userProfile,
    dailySummaries,
    onOpenHeyCoach,
    onOpenDietAnalysis,
    onOpenFastingTracker,
    onOpenWhatIfFood,
    onNavigate,
}) => {
  const displayName = userProfile?.aiNickname || userProfile?.name || 'Sparky';

  // Get today's summary
  const today = new Date().toISOString().split('T')[0];
  const todaySummary = dailySummaries.find(s => s.date === today);

  const calories = todaySummary?.totals.calories || 0;
  const protein = todaySummary?.totals.protein || 0;
  const fat = todaySummary?.totals.fat || 0;
  const caloriesBurned = todaySummary?.totals.totalCaloriesBurned || 0;

  const caloriesTarget = userProfile?.dailyTargets.calories || 2000;
  const proteinTarget = userProfile?.dailyTargets.protein || 120;
  const fatTarget = userProfile?.dailyTargets.fat || 60;

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden">
      {/* Background blur circles */}
      <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-[#9333ea]/20 opacity-50 blur-3xl filter animate-pulse"></div>
      <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#d8b4fe]/20 opacity-40 blur-3xl filter animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/3 left-1/4 h-60 w-60 rounded-full bg-[#9333ea]/20 opacity-30 blur-3xl filter animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Content */}
      <div className="relative z-10 flex h-full w-full flex-col p-4 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between pb-2">
          <div className="flex size-12 shrink-0 items-center">
            {userProfile?.aiAvatar ? (
              <div
                className="aspect-square size-10 rounded-full bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url("${userProfile.aiAvatar}")` }}
              />
            ) : (
              <div className="aspect-square size-10 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-400" />
            )}
          </div>
          <div className="flex w-12 items-center justify-end">
            <button className="flex h-12 w-12 max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>
        </header>

        <h1 className="px-0 pt-6 text-[32px] font-bold leading-tight tracking-tight text-white">
          Hello, {displayName}!
        </h1>
        <p className="px-0 pb-8 text-base font-normal leading-normal text-white/70">
          Ready to crush your goals today?
        </p>

        {/* Today's Goals Card */}
        <div className="flex flex-col gap-4">
          <div
            className="group relative flex flex-col gap-4 overflow-hidden rounded-xl p-4 transition-transform hover:scale-[1.02]"
            style={{
              backgroundColor: 'rgba(216, 180, 254, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(216, 180, 254, 0.1)',
            }}
          >
            <h2 className="text-base font-bold leading-tight text-white">Today's Goals</h2>
            <div className="flex items-center justify-around gap-4 text-center">
              <CircularProgress value={calories} max={caloriesTarget} label="Calories" />
              <CircularProgress value={protein} max={proteinTarget} label="Protein" unit="g" />
              <CircularProgress value={fat} max={fatTarget} label="Fat" unit="g" />
            </div>
          </div>

          {/* Activity Card */}
          <div
            className="group relative flex flex-col gap-4 overflow-hidden rounded-xl p-4 transition-transform hover:scale-[1.02]"
            style={{
              backgroundColor: 'rgba(216, 180, 254, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(216, 180, 254, 0.1)',
            }}
          >
            <h2 className="text-base font-bold leading-tight text-white">Activity</h2>
            <div className="flex items-center gap-4">
              <div className="relative size-24 shrink-0">
                <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="stroke-white/10"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    strokeWidth="3.5"
                  />
                  <path
                    className="stroke-[#d8b4fe]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    strokeDasharray={`${Math.min((caloriesBurned / 800) * 100, 100)}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">{Math.round(caloriesBurned)}</span>
                  <span className="text-sm text-white/60">kcal</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white/5">
                    <svg className="w-5 h-5 text-[#d8b4fe]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-white/80">Log Activity</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <button
            onClick={() => onNavigate('chat')}
            className="group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl p-4 transition-transform hover:scale-[1.02]"
            style={{
              backgroundColor: 'rgba(216, 180, 254, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(216, 180, 254, 0.1)',
            }}
          >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#d8b4fe] to-[#9333ea] opacity-80"></div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5">
              <svg className="w-8 h-8 bg-gradient-to-br from-[#d8b4fe] to-[#9333ea] bg-clip-text text-transparent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold leading-tight text-white">Food Log</h2>
              <p className="text-sm font-normal leading-normal text-white/60">View your daily summary.</p>
            </div>
            <svg className="ml-auto w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={onOpenDietAnalysis}
            className="group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl p-4 transition-transform hover:scale-[1.02]"
            style={{
              backgroundColor: 'rgba(216, 180, 254, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(216, 180, 254, 0.1)',
            }}
          >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#d8b4fe] to-[#9333ea] opacity-80"></div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5">
              <svg className="w-8 h-8 bg-gradient-to-br from-[#d8b4fe] to-[#9333ea] bg-clip-text text-transparent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold leading-tight text-white">Diet Analysis</h2>
              <p className="text-sm font-normal leading-normal text-white/60">Get instant feedback on your meals.</p>
            </div>
            <svg className="ml-auto w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={onOpenFastingTracker}
            className="group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl p-4 transition-transform hover:scale-[1.02]"
            style={{
              backgroundColor: 'rgba(216, 180, 254, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(216, 180, 254, 0.1)',
            }}
          >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#d8b4fe] to-[#9333ea] opacity-80"></div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5">
              <svg className="w-8 h-8 bg-gradient-to-br from-[#d8b4fe] to-[#9333ea] bg-clip-text text-transparent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold leading-tight text-white">Fasting Tracker</h2>
              <p className="text-sm font-normal leading-normal text-white/60">Manage and track your fasting periods.</p>
            </div>
            <svg className="ml-auto w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Greeting;
