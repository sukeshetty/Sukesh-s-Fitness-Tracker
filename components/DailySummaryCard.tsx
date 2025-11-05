
import React, { useMemo } from 'react';
import { ChatMessage, MessageRole, DailyTargets } from '../types';
import AnimatedNumber from './AnimatedNumber';

interface DailySummaryCardProps {
  messages: ChatMessage[];
  dailyTargets?: DailyTargets;
}

const ProgressBar: React.FC<{ value: number; max: number; }> = ({ value, max }) => {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const color = value > max ? 'bg-red-500' : 'bg-green-500';
    return (
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
        </div>
    );
};


const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ messages, dailyTargets }) => {
  const dailyTotals = useMemo(() => {
    let totalCalories = 0, totalProtein = 0, totalFat = 0;
    messages.forEach((msg) => {
      if (msg.role === MessageRole.MODEL && msg.nutritionData) {
        msg.nutritionData.forEach((item) => {
          totalCalories += item.calories;
          totalProtein += item.protein;
          totalFat += item.fat;
        });
      }
    });
    return {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein),
      fat: Math.round(totalFat),
    };
  }, [messages]);
  
  const getFormattedDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let relativeDay = date.toDateString() === today.toDateString() ? 'Today' : (date.toDateString() === yesterday.toDateString() ? 'Yesterday' : '');
    const fullDate = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return relativeDay ? `${relativeDay} · ${fullDate}` : fullDate;
  };
  
  const lastMessage = messages[messages.length - 1];
  const dateString = lastMessage ? getFormattedDate(lastMessage.timestamp) : '';

  if (dailyTotals.calories === 0 && dailyTotals.protein === 0 && dailyTotals.fat === 0) return null;

  return (
    <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-lg p-5 rounded-xl ring-1 ring-blue-500/30 shadow-lg">
       <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <h3 className="font-bold text-blue-300 text-lg">Daily Totals</h3>
        </div>
        <span className="text-xs text-zinc-400 text-right">{dateString}</span>
      </div>
      
      {dailyTargets ? (
        <div className="space-y-3">
            <div>
                <div className="flex justify-between text-sm mb-1 text-zinc-300">
                    <span>Calories</span>
                    <span><AnimatedNumber value={dailyTotals.calories} duration={800} /> / {dailyTargets.calories}</span>
                </div>
                <ProgressBar value={dailyTotals.calories} max={dailyTargets.calories} />
            </div>
            <div>
                <div className="flex justify-between text-sm mb-1 text-zinc-300">
                    <span>Protein</span>
                    <span><AnimatedNumber value={dailyTotals.protein} duration={800} suffix="g" /> / {dailyTargets.protein}g</span>
                </div>
                <ProgressBar value={dailyTotals.protein} max={dailyTargets.protein} />
            </div>
            <div>
                <div className="flex justify-between text-sm mb-1 text-zinc-300">
                    <span>Fat</span>
                    <span><AnimatedNumber value={dailyTotals.fat} duration={800} suffix="g" /> / {dailyTargets.fat}g</span>
                </div>
                <ProgressBar value={dailyTotals.fat} max={dailyTargets.fat} />
            </div>
        </div>
      ) : (
        <p className="text-center text-zinc-400 text-sm">Set your profile to see progress against daily goals.</p>
      )}
    </div>
  );
};

export default DailySummaryCard;