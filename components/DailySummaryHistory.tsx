import React, { useState, useEffect } from 'react';
import { DailySummaryEntry, UserProfile } from '../types';
import { CloseIcon, CalendarIcon } from './Icons';
import AnimatedNumber from './AnimatedNumber';
import { GoogleGenAI } from '@google/genai';
import Spinner from './Spinner';

interface DailySummaryHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

const DailySummaryHistory: React.FC<DailySummaryHistoryProps> = ({ isOpen, onClose }) => {
  const [summaries, setSummaries] = useState<DailySummaryEntry[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7days' | '30days' | 'all'>('7days');
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, selectedPeriod]);

  const loadData = () => {
    const profileSaved = localStorage.getItem('user-profile');
    if (profileSaved) setUserProfile(JSON.parse(profileSaved));

    const summariesSaved = localStorage.getItem('daily-summaries');
    if (summariesSaved) {
      const allSummaries: DailySummaryEntry[] = JSON.parse(summariesSaved);
      
      const endDate = new Date();
      const startDate = new Date();
      if (selectedPeriod === '7days') startDate.setDate(startDate.getDate() - 7);
      else if (selectedPeriod === '30days') startDate.setDate(startDate.getDate() - 30);
      else startDate.setFullYear(2020);
      
      const filtered = allSummaries.filter(s => { const d = new Date(s.date); return d >= startDate && d <= endDate; });
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSummaries(filtered);
    }
  };

  const generateAIInsight = async () => {
    if (!userProfile || summaries.length === 0) return;
    setGeneratingInsight(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const totalDays = summaries.length;
      const avgCalories = summaries.reduce((s, c) => s + c.totals.calories, 0) / totalDays;
      const totalDeficit = summaries.reduce((s, c) => s + c.targets.calories, 0) - summaries.reduce((s, c) => s + c.totals.calories, 0);

      const prompt = `Analyze this user's nutrition data:
        User Profile: Age: ${userProfile.age}, Gender: ${userProfile.gender}, Weight: ${userProfile.weight} kg, Goal: ${userProfile.goal}
        Performance over last ${totalDays} days: Average daily intake: ${Math.round(avgCalories)} cal, Total calorie deficit: ${Math.round(totalDeficit)} calories.
        Provide: 1. Overall performance assessment (2 sentences). 2. Estimated weight change based on deficit (use 7700 cal = 1kg formula) (1-2 sentences). 3. One specific actionable recommendation (1 sentence). 4. One word of encouragement (1 sentence).
        Keep total response under 150 words. Be friendly, supportive, and data-driven.`;

      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
      setAiInsight(response.text);
    } catch (err) {
      setAiInsight('Failed to generate AI insights. Please try again.');
    } finally {
      setGeneratingInsight(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (goalsMet: DailySummaryEntry['goalsMet']) => Object.values(goalsMet).filter(Boolean).length === 3 ? 'text-green-400' : Object.values(goalsMet).filter(Boolean).length >= 2 ? 'text-yellow-400' : 'text-red-400';
  const getStatusText = (goalsMet: DailySummaryEntry['goalsMet']) => Object.values(goalsMet).filter(Boolean).length === 3 ? 'All Goals Met' : Object.values(goalsMet).filter(Boolean).length >= 2 ? 'Partial Goals Met' : 'Goals Not Met';

  const totalDays = summaries.length;
  const avgCalories = totalDays > 0 ? Math.round(summaries.reduce((s, c) => s + c.totals.calories, 0) / totalDays) : 0;
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black/50 backdrop-blur-xl rounded-2xl ring-1 ring-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-white/10"><div className="flex items-center gap-3"><CalendarIcon className="w-6 h-6 text-indigo-400" /><h2 className="text-xl font-bold text-zinc-100">Daily Summary History</h2></div><button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100"><CloseIcon className="w-6 h-6" /></button></header>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex gap-2">
            {(['7days', '30days', 'all'] as const).map(p => <button key={p} onClick={() => setSelectedPeriod(p)} className={`px-4 py-2 rounded-lg font-medium ${selectedPeriod === p ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{p==='7days'?'Last 7 Days':p==='30days'?'Last 30 Days':'All Time'}</button>)}
          </div>
          {totalDays > 0 && (
            <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-lg rounded-xl p-6 ring-1 ring-indigo-500/30">
              <h3 className="text-lg font-bold text-zinc-100 mb-4">Overview</h3>
              <div className="grid grid-cols-2 text-center bg-white/5 rounded-lg p-3"><p className="text-2xl font-bold text-zinc-100">{totalDays}</p><p className="text-xs text-zinc-400">Days Logged</p><p className="text-2xl font-bold text-zinc-100"><AnimatedNumber value={avgCalories} /></p><p className="text-xs text-zinc-400">Avg Calories</p></div>
              <button onClick={generateAIInsight} disabled={generatingInsight} className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold text-white flex items-center justify-center gap-2">{generatingInsight ? <Spinner /> : '🤖 Get AI Analysis & Weight Prediction'}</button>
              {aiInsight && <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4"><h4 className="font-semibold text-purple-300 mb-2">✨ AI Insights</h4><p className="text-zinc-300 text-sm whitespace-pre-line">{aiInsight}</p></div>}
            </div>
          )}
          <div className="space-y-4">
            {summaries.map((s) => (<div key={s.date} className="bg-white/5 backdrop-blur-lg rounded-xl p-5 ring-1 ring-white/10"><div className="flex items-center justify-between mb-4"><div><h3 className="text-lg font-bold text-zinc-100">{formatDate(s.date)}</h3><p className="text-sm text-zinc-500">{s.date} • {s.mealsLogged} meals</p></div><div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(s.goalsMet)}`}>{getStatusText(s.goalsMet)}</div></div>{/* Progress Bars */}</div>))}
          </div>
          {summaries.length === 0 && <div className="text-center py-12"><CalendarIcon className="w-16 h-16 text-zinc-600 mx-auto mb-4" /><p className="text-zinc-400">No data for this period</p></div>}
        </div>
      </div>
    </div>
  );
};

export default DailySummaryHistory;
