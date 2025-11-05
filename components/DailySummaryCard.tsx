import React, { useMemo } from 'react';
import { ChatMessage, MessageRole } from '../types';
import AnimatedNumber from './AnimatedNumber';

interface DailySummaryCardProps {
  messages: ChatMessage[];
}

const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ messages }) => {
  const dailyTotals = useMemo(() => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;

    messages.forEach((msg) => {
      if (msg.role === MessageRole.MODEL && msg.nutritionData) {
        msg.nutritionData.forEach((item) => {
          totalCalories += Number(item.calories) || 0;
          totalProtein += Number(item.protein) || 0;
          totalFat += Number(item.fat) || 0;
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

    let relativeDay = '';
    if (date.toDateString() === today.toDateString()) {
      relativeDay = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      relativeDay = 'Yesterday';
    }

    const fullDate = date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return relativeDay ? `${relativeDay} · ${fullDate}` : fullDate;
  };
  
  const lastMessage = messages[messages.length - 1];
  const dateString = lastMessage ? getFormattedDate(lastMessage.timestamp) : '';


  if (dailyTotals.calories === 0 && dailyTotals.protein === 0 && dailyTotals.fat === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-lg p-5 rounded-xl ring-1 ring-blue-500/30 shadow-lg">
       <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <h3 className="font-bold text-blue-300 text-lg">Daily Totals</h3>
        </div>
        <span className="text-xs text-zinc-400 text-right">{dateString}</span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Calories</p>
          <p className="text-3xl font-bold text-zinc-100">
            <AnimatedNumber value={dailyTotals.calories} duration={1000} showChangeIndicator={true}/>
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Protein</p>
          <p className="text-3xl font-bold text-zinc-100">
            <AnimatedNumber value={dailyTotals.protein} duration={1000} suffix="g" showChangeIndicator={true}/>
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Fat</p>
          <p className="text-3xl font-bold text-zinc-100">
            <AnimatedNumber value={dailyTotals.fat} duration={1000} suffix="g" showChangeIndicator={true}/>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DailySummaryCard;
