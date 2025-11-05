import React, { useMemo } from 'react';
import { ChatMessage, Ingredient, MessageRole } from '../types';
import { CloseIcon } from './Icons';

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
}

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div>
    <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-bold text-slate-100">{value}</p>
  </div>
);

const DailySummaryView: React.FC<DailySummaryViewProps> = ({ messages, isOpen, onClose }) => {
  const dailySummaries = useMemo<DailySummary>(() => {
    const summaries: DailySummary = {};

    messages.forEach((msg) => {
      if (msg.role === MessageRole.MODEL && msg.nutritionData) {
        const date = new Date(msg.timestamp).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-2xl ring-1 ring-slate-700 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-slate-100">Daily Summaries</h2>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
            aria-label="Close summary view"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="overflow-y-auto p-4 space-y-4">
          {sortedDates.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No meal logs with nutritional data found.</p>
          ) : (
            sortedDates.map(date => {
              const summary = dailySummaries[date];
              return (
                <div key={date} className="bg-slate-900/50 p-4 rounded-xl ring-1 ring-slate-700">
                  <h3 className="font-bold text-cyan-400 text-lg mb-3">
                    {date}
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <Stat label="Calories" value={Math.round(summary.calories)} />
                    <Stat label="Protein" value={`${Math.round(summary.protein)}g`} />
                    <Stat label="Fat" value={`${Math.round(summary.fat)}g`} />
                  </div>
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