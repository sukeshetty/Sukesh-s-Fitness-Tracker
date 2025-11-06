import React from 'react';
import { CoachIcon, ScienceIcon, HourglassIcon, LightbulbIcon } from './Icons';
import { UserProfile } from '../types';

interface SuggestionCardProps {
  title: string;
  description: string;
  onClick: () => void;
  icon: React.ReactNode;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ title, description, onClick, icon }) => (
  <button
    onClick={onClick}
    className="bg-[var(--component-bg)] backdrop-blur-lg p-4 rounded-xl w-full text-left transition-all duration-200 border border-[var(--glass-border)] hover:bg-white/10 hover:border-white/20 flex items-start gap-4"
    style={{ boxShadow: 'var(--card-shadow)' }}
  >
    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-blue-400">
        {icon}
    </div>
    <div>
        <p className="font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  </button>
);

interface GreetingProps {
  userProfile: UserProfile | null;
  onOpenHeyCoach: () => void;
  onOpenDietAnalysis: () => void;
  onOpenFastingTracker: () => void;
  onOpenWhatIfFood: () => void;
}

const Greeting: React.FC<GreetingProps> = ({ 
    userProfile,
    onOpenHeyCoach,
    onOpenDietAnalysis,
    onOpenFastingTracker,
    onOpenWhatIfFood,
}) => {
  const suggestions = [
    {
      title: 'Hey Coach',
      description: 'Ask your AI coach anything about your diet, workouts, and progress.',
      onClick: onOpenHeyCoach,
      icon: <CoachIcon className="w-6 h-6" />,
    },
    {
      title: 'What is missing in my diet?',
      description: 'Analyze your logs to find nutritional gaps and get suggestions.',
      onClick: onOpenDietAnalysis,
      icon: <ScienceIcon className="w-6 h-6" />,
    },
    {
      title: 'Fasting Tracker',
      description: 'Track your intermittent fasts and monitor metabolic phases.',
      onClick: onOpenFastingTracker,
      icon: <HourglassIcon className="w-6 h-6" />,
    },
    {
      title: 'What if I eat...?',
      description: "See how a specific food would impact your weekly goals.",
      onClick: onOpenWhatIfFood,
      icon: <LightbulbIcon className="w-6 h-6" />,
    },
  ];

  const displayName = userProfile?.aiNickname || userProfile?.name || 'there';

  return (
    <div className="flex flex-col items-center justify-center h-full w-full pb-20">
      <div className="text-center">
        <h1 className="text-5xl md:text-6xl font-medium bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text mb-4">
          Hello, {displayName}.
        </h1>
        <p className="text-[var(--text-secondary)] text-xl">How can I help you today?</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full max-w-3xl">
        {suggestions.map((s, i) => (
          <SuggestionCard 
            key={i} 
            title={s.title} 
            description={s.description} 
            onClick={s.onClick}
            icon={s.icon}
          />
        ))}
      </div>
    </div>
  );
};

export default Greeting;