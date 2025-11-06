import React from 'react';
import { DailySummaryEntry } from '../types';
import { CloseIcon, CalendarIcon } from './Icons';
import { useTheme } from './contexts/ThemeContext';
import AnimatedNumber from './AnimatedNumber';

interface DailySummaryHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  summaries: DailySummaryEntry[];
}

const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const GoalIndicator: React.FC<{ met: boolean }> = ({ met }) => (
    <span className={`w-3 h-3 rounded-full ${met ? 'bg-green-400' : 'bg-red-400'}`} title={met ? 'Goal Met' : 'Goal Missed'}></span>
);

const DailySummaryHistory: React.FC<DailySummaryHistoryProps> = ({ isOpen, onClose, summaries }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  if (!isOpen) return null;

  const sortedSummaries = [...summaries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const cardClasses = isLight ? 'bg-rose-50' : 'bg-white/5';
  const headerTextClasses = isLight ? 'text-rose-800' : 'text-zinc-200';
  const secondaryTextClasses = isLight ? 'text-rose-500' : 'text-zinc-400';

  return (
    <div className="fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--component-bg)] backdrop-blur-xl rounded-2xl ring-1 ring-[var(--glass-border)] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Daily Log History</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedSummaries.length > 0 ? (
            sortedSummaries.map(summary => {
              const netCalories = summary.totals.calories - summary.totals.totalCaloriesBurned;
              return (
                <div key={summary.date} className={`p-4 rounded-xl ring-1 ring-white/10 ${cardClasses}`}>
                  <h3 className={`font-bold text-md mb-3 ${headerTextClasses}`}>
                    {getRelativeDate(summary.date)}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className={secondaryTextClasses}>Net Calories</p>
                      <div className="flex items-center gap-3">
                        <p className={headerTextClasses}>
                          <AnimatedNumber value={netCalories} /> / {summary.targets.calories}
                        </p>
                        <GoalIndicator met={summary.goalsMet.calories} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={secondaryTextClasses}>Protein</p>
                      <div className="flex items-center gap-3">
                        <p className={headerTextClasses}>
                          <AnimatedNumber value={summary.totals.protein} /> / {summary.targets.protein}g
                        </p>
                        <GoalIndicator met={summary.goalsMet.protein} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={secondaryTextClasses}>Fat</p>
                      <div className="flex items-center gap-3">
                        <p className={headerTextClasses}>
                          <AnimatedNumber value={summary.totals.fat} /> / {summary.targets.fat}g
                        </p>
                        <GoalIndicator met={summary.goalsMet.fat} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <CalendarIcon className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-[var(--text-secondary)]">No daily summaries yet.</p>
              <p className="text-xs text-zinc-500">Log some meals to see your history here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailySummaryHistory;
