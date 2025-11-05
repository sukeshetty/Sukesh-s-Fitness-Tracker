import React, { useMemo } from 'react';
import { Ingredient } from '../types';
import AnimatedNumber from './AnimatedNumber';
import { useTheme } from './contexts/ThemeContext';

interface TotalNutritionCardProps {
  data: Ingredient[];
  timestamp: string;
}

const TotalNutritionCard: React.FC<TotalNutritionCardProps> = ({ data, timestamp }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const totals = useMemo(() => {
    const total = {
      calories: 0,
      protein: 0,
      fat: 0,
    };

    data.forEach(item => {
      total.calories += Number(item.calories) || 0;
      total.protein += Number(item.protein) || 0;
      total.fat += Number(item.fat) || 0;
    });

    return {
      calories: Math.round(total.calories),
      protein: Math.round(total.protein),
      fat: Math.round(total.fat),
    };
  }, [data]);

  const formattedTimestamp = new Date(timestamp).toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const cardClasses = isLight
    ? 'bg-gradient-to-r from-pink-50 to-rose-50 ring-rose-200'
    : 'bg-gradient-to-r from-emerald-600/20 to-teal-600/20 ring-emerald-500/30';
  
  const headerTextClasses = isLight ? 'text-pink-700' : 'text-emerald-300';
  const timestampTextClasses = isLight ? 'text-rose-500' : 'text-zinc-400';
  const statBoxClasses = isLight ? 'bg-pink-100/50' : 'bg-white/5';
  const statLabelClasses = isLight ? 'text-rose-500' : 'text-zinc-400';
  const statValueClasses = isLight ? 'text-rose-800' : 'text-zinc-100';

  return (
    <div
      className={`backdrop-blur-lg p-4 rounded-xl ring-1 shadow-lg mb-3 ${cardClasses}`}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍽️</span>
          <h3 className={`font-bold text-md ${headerTextClasses}`}>Meal Summary</h3>
        </div>
        <span className={`text-xs ${timestampTextClasses}`}>{formattedTimestamp}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className={`rounded-lg p-2 ${statBoxClasses}`}>
          <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${statLabelClasses}`}>Calories</p>
          <p className={`text-2xl font-bold ${statValueClasses}`}>
            <AnimatedNumber value={totals.calories} duration={800} />
          </p>
        </div>
        <div className={`rounded-lg p-2 ${statBoxClasses}`}>
          <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${statLabelClasses}`}>Protein</p>
          <p className={`text-2xl font-bold ${statValueClasses}`}>
            <AnimatedNumber value={totals.protein} duration={800} suffix="g" />
          </p>
        </div>
        <div className={`rounded-lg p-2 ${statBoxClasses}`}>
          <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${statLabelClasses}`}>Fat</p>
          <p className={`text-2xl font-bold ${statValueClasses}`}>
            <AnimatedNumber value={totals.fat} duration={800} suffix="g" />
          </p>
        </div>
      </div>
    </div>
  );
};

export default TotalNutritionCard;