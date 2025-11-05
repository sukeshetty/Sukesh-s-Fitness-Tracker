
import React, { useMemo } from 'react';
import { ChatMessage, MessageRole, DailyTargets } from '../types';
import { CloseIcon } from './Icons';
import AnimatedNumber from './AnimatedNumber';

interface DailySummary {
  [date: string]: {
    calories: number;
    protein: number;
    fat: number;
  };
}

interface DailySummaryViewProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onClose: () => void;
  dailyTargets?: DailyTargets;
}

const Stat: React.FC<{ label: string; value: number; target: number; suffix?: string }> = ({ label, value, target, suffix = '' }) => (
    <div className="bg-white/5 rounded-lg p-3">
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-zinc-100">
        <AnimatedNumber value={value} duration={600} suffix={suffix} /> 
        <span className="text-sm font-normal text-zinc-400"> / {target}{suffix}</span>
      </p>
    </div>
  );

const DailySummaryView: React.FC<DailySummaryViewProps> = ({ messages, isOpen, onClose, dailyTargets }) => {
  const dailySummaries = useMemo<DailySummary>(() => {
    const summaries: DailySummary = {};
    messages.forEach((msg) => {
      if (msg.role === MessageRole.MODEL && msg.nutritionData) {
        const date = new Date(msg.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        if (!summaries[date]) {
          summaries[date] = { calories: 0, protein: 0, fat: 0 };
        }
        msg.nutritionData.forEach((item) => {
          summaries[date].calories += Number(item.calories) || 0;
          summaries[date].protein += Number(item.protein) || 0;
          summaries[date].fat += Number(item.fat) || 0;
        });
      }
    });
    return summaries;
  }, [messages]);
  
  const sortedDates = Object.keys(dailySummaries).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-black/50 backdrop-blur-xl rounded-2xl ring-1 ring-white/10 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-zinc-100">Daily Summaries</h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors" aria-label="Close summary view">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="overflow-y-auto p-4 space-y-4">
          {sortedDates.length === 0 ? (
            <p className="text-zinc-400 text-center py-8">No meal logs with nutritional data found.</p>
          ) : (
            sortedDates.map(date => {
              const summary = dailySummaries[date];
              return (
                <div key={date} className="bg-white/5 backdrop-blur-lg p-4 rounded-xl ring-1 ring-white/10">
                  <h3 className="font-bold text-blue-400 text-lg mb-3">{date}</h3>
                  {dailyTargets ? (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <Stat label="Calories" value={Math.round(summary.calories)} target={dailyTargets.calories} />
                      <Stat label="Protein" value={Math.round(summary.protein)} target={dailyTargets.protein} suffix="g" />
                      <Stat label="Fat" value={Math.round(summary.fat)} target={dailyTargets.fat} suffix="g" />
                    </div>
                  ) : (
                     <p className="text-center text-zinc-400 text-sm py-4">Set your profile to track against daily goals.</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DailySummaryView;