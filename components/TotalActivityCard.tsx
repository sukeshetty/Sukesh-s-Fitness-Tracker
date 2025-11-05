import React, { useMemo } from 'react';
import { Activity } from '../types';
import AnimatedNumber from './AnimatedNumber';
import { FireIcon, ClockIcon } from './Icons';
import { useTheme } from './contexts/ThemeContext';

interface TotalActivityCardProps {
  data: Activity[];
  timestamp: string;
}

const TotalActivityCard: React.FC<TotalActivityCardProps> = ({ data, timestamp }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const totals = useMemo(() => {
    return {
      duration: data.reduce((sum, item) => sum + (Number(item.duration) || 0), 0),
      caloriesBurned: data.reduce((sum, item) => sum + (Number(item.caloriesBurned) || 0), 0),
    };
  }, [data]);

  const formattedTimestamp = new Date(timestamp).toLocaleString(undefined, {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });

  const cardClasses = isLight
    ? 'bg-gradient-to-br from-rose-100 via-pink-100 to-fuchsia-100 ring-pink-200'
    : 'bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-pink-600/20 ring-purple-500/30';
  
  const headerTextClasses = isLight ? 'text-pink-800' : 'text-purple-300';
  const timestampTextClasses = isLight ? 'text-rose-500' : 'text-zinc-400';
  const statBoxClasses = isLight ? 'bg-pink-50/50' : 'bg-white/5';
  const statLabelClasses = isLight ? 'text-rose-500' : 'text-zinc-400';
  const statValueClasses = isLight ? 'text-rose-800' : 'text-zinc-100';
  const itemBgClasses = isLight ? 'bg-rose-50/40 hover:bg-rose-50/80 hover:ring-1 hover:ring-white/20' : 'bg-white/5 hover:bg-white/10 hover:ring-1 hover:ring-white/20';

  return (
    <div
      className={`backdrop-blur-lg p-5 rounded-xl ring-1 shadow-lg mb-3 w-full ${cardClasses}`}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{data[0]?.emoji || '🏃'}</span>
          <div>
            <h3 className={`font-bold text-lg ${headerTextClasses}`}>Activity Summary</h3>
            <span className={`text-xs ${timestampTextClasses}`}>{formattedTimestamp}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-center mb-5">
        <div className={`rounded-lg p-3 ${statBoxClasses}`}>
          <p className={`text-xs font-medium uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5 ${statLabelClasses}`}>
            <ClockIcon className="w-3 h-3"/>Total Duration
          </p>
          <p className={`text-3xl font-bold ${statValueClasses}`}>
            <AnimatedNumber value={totals.duration} duration={800} suffix=" min" />
          </p>
        </div>
        <div className={`rounded-lg p-3 ${statBoxClasses}`}>
          <p className={`text-xs font-medium uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5 ${statLabelClasses}`}>
            <FireIcon className="w-3 h-3 text-orange-400" fill="currentColor" />Total Burned
          </p>
          <p className={`text-3xl font-bold ${statValueClasses}`}>
            <AnimatedNumber value={totals.caloriesBurned} duration={800} />
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className={`text-sm font-semibold mb-1 ${isLight ? 'text-rose-700' : 'text-zinc-300'}`}>Breakdown:</h4>
        {data.map((item, index) => (
          <div key={index} className={`rounded-lg p-3 text-sm flex items-center justify-between transition-all ${itemBgClasses}`}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl">{item.emoji || '💪'}</span>
              <div className="min-w-0">
                <p className={`font-semibold truncate ${isLight ? 'text-rose-800' : 'text-zinc-200'}`}>{item.activity}</p>
                <p className={`text-xs truncate ${isLight ? 'text-rose-500' : 'text-zinc-400'}`}>{item.notes}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right flex-shrink-0 ml-2">
                <div className="text-xs">
                    <p className={statLabelClasses}>Time</p>
                    <p className={`font-bold whitespace-nowrap ${statValueClasses}`}>{item.duration} min</p>
                </div>
                 <div className="text-xs">
                    <p className={statLabelClasses}>Burned</p>
                    <p className={`font-bold whitespace-nowrap ${statValueClasses}`}>{item.caloriesBurned} cal</p>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TotalActivityCard;