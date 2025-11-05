
import React, { useMemo } from 'react';
import { Ingredient } from '../types';
import AnimatedNumber from './AnimatedNumber';

interface TotalNutritionCardProps {
  data: Ingredient[];
  timestamp: string;
}

const TotalNutritionCard: React.FC<TotalNutritionCardProps> = ({ data, timestamp }) => {
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

  return (
    <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 backdrop-blur-lg p-4 rounded-xl ring-1 ring-emerald-500/30 shadow-lg mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍽️</span>
          <h3 className="font-bold text-emerald-300 text-md">Meal Summary</h3>
        </div>
        <span className="text-xs text-zinc-400">{formattedTimestamp}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Calories</p>
          <p className="text-2xl font-bold text-zinc-100">
            <AnimatedNumber value={totals.calories} duration={800} />
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Protein</p>
          <p className="text-2xl font-bold text-zinc-100">
            <AnimatedNumber value={totals.protein} duration={800} suffix="g" />
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Fat</p>
          <p className="text-2xl font-bold text-zinc-100">
            <AnimatedNumber value={totals.fat} duration={800} suffix="g" />
          </p>
        </div>
      </div>
    </div>
  );
};

export default TotalNutritionCard;