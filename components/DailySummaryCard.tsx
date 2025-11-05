import React, { useMemo } from 'react';
import { ChatMessage, MessageRole, DailyTargets } from '../types';
import AnimatedNumber from './AnimatedNumber';
import { FireIcon } from './Icons';
import { useTheme } from './contexts/ThemeContext';

interface DailySummaryCardProps {
  messages: ChatMessage[];
  dailyTargets?: DailyTargets;
}

const ProgressBar: React.FC<{ value: number; max: number; isLight: boolean; }> = ({ value, max, isLight }) => {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const color = value > max * 1.1 ? 'bg-red-500' : 'bg-green-500';
    const trackColor = isLight ? 'bg-rose-100' : 'bg-zinc-800';
    return (
        <div className={`h-2 ${trackColor} rounded-full overflow-hidden`}>
            <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
        </div>
    );
};


const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ messages, dailyTargets }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const dailyTotals = useMemo(() => {
    let caloriesIn = 0, protein = 0, fat = 0, caloriesOut = 0;
    messages.forEach((msg) => {
        if (msg.role === MessageRole.MODEL) {
            if (msg.nutritionData) {
                msg.nutritionData.forEach((item) => {
                    caloriesIn += item.calories;
                    protein += item.protein;
                    fat += item.fat;
                });
            }
            if (msg.activityData) {
                msg.activityData.forEach((item) => {
                    caloriesOut += item.caloriesBurned;
                })
            }
        }
    });
    return {
      caloriesIn: Math.round(caloriesIn),
      protein: Math.round(protein),
      fat: Math.round(fat),
      caloriesOut: Math.round(caloriesOut),
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
  const netCalories = dailyTotals.caloriesIn - dailyTotals.caloriesOut;

  if (dailyTotals.caloriesIn === 0 && dailyTotals.protein === 0 && dailyTotals.fat === 0 && dailyTotals.caloriesOut === 0) return null;

  const cardClasses = isLight 
    ? 'bg-gradient-to-br from-pink-100 to-rose-100 ring-rose-200'
    : 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 ring-blue-500/30';
  
  const headerTextClasses = isLight ? 'text-pink-800' : 'text-blue-300';
  const metaTextClasses = isLight ? 'text-rose-500' : 'text-zinc-400';
  const labelTextClasses = isLight ? 'text-rose-700' : 'text-zinc-300';

  return (
    <div
      className={`backdrop-blur-lg p-5 rounded-xl ring-1 shadow-lg ${cardClasses}`}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
       <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <h3 className={`font-bold text-lg ${headerTextClasses}`}>Daily Totals</h3>
        </div>
        <span className={`text-xs text-right ${metaTextClasses}`}>{dateString}</span>
      </div>
      
      {dailyTargets ? (
        <div className="space-y-3">
            <div>
                <div className={`flex justify-between text-sm mb-1 ${labelTextClasses}`}>
                    <span>Net Calories</span>
                    <div className='flex items-center gap-2'>
                        <span className='text-green-500'>(<AnimatedNumber value={dailyTotals.caloriesIn} /> In</span>
                        <span className='text-orange-500'>- <AnimatedNumber value={dailyTotals.caloriesOut} /> Out)</span>
                        <span><AnimatedNumber value={netCalories} /> / {dailyTargets.calories}</span>
                    </div>
                </div>
                <ProgressBar value={netCalories} max={dailyTargets.calories} isLight={isLight} />
            </div>
            <div>
                <div className={`flex justify-between text-sm mb-1 ${labelTextClasses}`}>
                    <span>Protein</span>
                    <span><AnimatedNumber value={dailyTotals.protein} duration={800} suffix="g" /> / {dailyTargets.protein}g</span>
                </div>
                <ProgressBar value={dailyTotals.protein} max={dailyTargets.protein} isLight={isLight} />
            </div>
            <div>
                <div className={`flex justify-between text-sm mb-1 ${labelTextClasses}`}>
                    <span>Fat</span>
                    <span><AnimatedNumber value={dailyTotals.fat} duration={800} suffix="g" /> / {dailyTargets.fat}g</span>
                </div>
                <ProgressBar value={dailyTotals.fat} max={dailyTargets.fat} isLight={isLight} />
            </div>
        </div>
      ) : (
        <p className={`text-center text-sm ${metaTextClasses}`}>Set your profile to see progress against daily goals.</p>
      )}
    </div>
  );
};

export default DailySummaryCard;