import React, { useState, useEffect } from 'react';
import { CloseIcon, ChartBarIcon } from './Icons';
import AnimatedNumber from './AnimatedNumber';
import { DailySummaryEntry, ExerciseLog } from '../types';

interface ReportsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReportData {
  label: string;
  avgCalories: number;
  avgProtein: number;
  avgFat: number;
  daysLogged: number;
  goalsMetDays: number;
  totalExerciseCalories: number;
  totalExerciseMinutes: number;
}

const Reports: React.FC<ReportsProps> = ({ isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [reports, setReports] = useState<ReportData[]>([]);

  useEffect(() => { if (isOpen) generateReports(); }, [isOpen, viewMode]);

  const generateReports = () => {
    const dailySummaries: DailySummaryEntry[] = JSON.parse(localStorage.getItem('daily-summaries') || '[]');
    const exerciseLogs: ExerciseLog[] = JSON.parse(localStorage.getItem('exercise-logs') || '[]');
    
    const generatedReports: ReportData[] = [];
    const iterations = viewMode === 'weekly' ? 4 : 3;

    for (let i = 0; i < iterations; i++) {
      const end = new Date();
      const start = new Date();

      if (viewMode === 'weekly') {
        end.setDate(end.getDate() - (i * 7));
        start.setDate(end.getDate() - 6);
      } else {
        start.setMonth(start.getMonth() - i, 1);
        end.setMonth(end.getMonth() - i + 1, 0);
      }

      const periodSummaries = dailySummaries.filter(s => { const d = new Date(s.date); return d >= start && d <= end; });
      const periodExercises = exerciseLogs.filter(e => { const d = new Date(e.date); return d >= start && d <= end; });

      if (periodSummaries.length > 0) {
        generatedReports.push({
          label: viewMode === 'weekly' ? `${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})} - ${end.toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : start.toLocaleDateString('en-US',{month:'long',year:'numeric'}),
          daysLogged: periodSummaries.length,
          avgCalories: Math.round(periodSummaries.reduce((sum, s) => sum + s.totals.calories, 0) / periodSummaries.length),
          avgProtein: Math.round(periodSummaries.reduce((sum, s) => sum + s.totals.protein, 0) / periodSummaries.length),
          avgFat: Math.round(periodSummaries.reduce((sum, s) => sum + s.totals.fat, 0) / periodSummaries.length),
          goalsMetDays: periodSummaries.filter(s => s.goalsMet.calories && s.goalsMet.protein && s.goalsMet.fat).length,
          totalExerciseCalories: periodExercises.reduce((sum, e) => sum + e.totalCaloriesBurned, 0),
          totalExerciseMinutes: periodExercises.reduce((sum, e) => sum + e.exercises.reduce((s, ex) => s + ex.duration, 0), 0),
        });
      }
    }
    setReports(generatedReports);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black/50 backdrop-blur-xl rounded-2xl ring-1 ring-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-white/10"><div className="flex items-center gap-3"><ChartBarIcon className="w-6 h-6 text-purple-400" /><h2 className="text-xl font-bold text-zinc-100">Progress Reports</h2></div><button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100"><CloseIcon className="w-6 h-6" /></button></header>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex gap-2">
            <button onClick={() => setViewMode('weekly')} className={`px-4 py-2 rounded-lg font-medium ${viewMode === 'weekly' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Weekly</button>
            <button onClick={() => setViewMode('monthly')} className={`px-4 py-2 rounded-lg font-medium ${viewMode === 'monthly' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Monthly</button>
          </div>
          <div className="space-y-4">
            {reports.map((report, index) => {
              const consistencyPercent = report.daysLogged > 0 ? Math.round((report.goalsMetDays / report.daysLogged) * 100) : 0;
              return (
                <div key={index} className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-xl p-5 ring-1 ring-purple-500/30">
                  <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-zinc-100">{report.label}</h3><div><p className="text-sm text-zinc-400">{report.daysLogged} days logged</p><p className={`text-xs font-semibold ${consistencyPercent >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>{consistencyPercent}% consistency</p></div></div>
                  <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div className="bg-white/5 rounded-lg p-3"><p className="text-2xl font-bold"><AnimatedNumber value={report.avgCalories} /></p><p className="text-xs text-zinc-400">Avg Calories</p></div>
                    <div className="bg-white/5 rounded-lg p-3"><p className="text-2xl font-bold"><AnimatedNumber value={report.avgProtein} suffix="g" /></p><p className="text-xs text-zinc-400">Avg Protein</p></div>
                    <div className="bg-white/5 rounded-lg p-3"><p className="text-2xl font-bold"><AnimatedNumber value={report.avgFat} suffix="g" /></p><p className="text-xs text-zinc-400">Avg Fat</p></div>
                  </div>
                  {report.totalExerciseMinutes > 0 && <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-center justify-between"><div><p className="text-sm font-medium text-orange-300">Exercise Activity</p><p className="text-xs text-zinc-400">{report.totalExerciseMinutes} min • {report.totalExerciseCalories} cal</p></div><span className="text-2xl">🔥</span></div>}
                </div>
              );
            })}
          </div>
          {reports.length === 0 && <div className="text-center py-12"><ChartBarIcon className="w-16 h-16 text-zinc-600 mx-auto mb-4" /><p className="text-zinc-400">No report data</p></div>}
        </div>
      </div>
    </div>
  );
};

export default Reports;
