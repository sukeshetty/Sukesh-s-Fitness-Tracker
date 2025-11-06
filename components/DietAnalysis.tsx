import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { DailySummaryEntry, UserProfile } from '../types';
import { CloseIcon, ScienceIcon, UserIcon } from './Icons';
import Spinner from './Spinner';
import { triggerHapticFeedback } from '../utils/audio';

interface DietAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  allDailySummaries: DailySummaryEntry[];
  onOpenProfile: () => void;
}

const DietAnalysis: React.FC<DietAnalysisProps> = ({ isOpen, onClose, userProfile, allDailySummaries, onOpenProfile }) => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');

  const handleAnalyzeDiet = async () => {
    triggerHapticFeedback();
    if (!userProfile || allDailySummaries.length === 0) {
      setResponse("Not enough data to analyze. Please log some meals first.");
      return;
    }
    setLoading(true);
    setResponse('');

    const recentSummaries = allDailySummaries.slice(-14); // Analyze last 14 days
    const summaryText = recentSummaries.map(s => 
      `Date: ${s.date}, Cals: ${s.totals.calories}/${s.targets.calories}, Protein: ${s.totals.protein}/${s.targets.protein}g, Fat: ${s.totals.fat}/${s.targets.fat}g`
    ).join('\n');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are an expert nutritionist. Analyze the user's diet based on their profile and recent food logs.
      
      User Profile:
      - Goal: ${userProfile.goal}
      - Health Conditions: ${userProfile.healthConditions.join(', ') || 'None'}
      
      Recent Daily Summaries (last ${recentSummaries.length} days):
      ${summaryText}
      
      Your task is to provide a comprehensive but easy-to-understand analysis in Markdown:
      1.  **Nutritional Gaps:** Identify potential missing micronutrients or food groups (e.g., "low in fiber", "lacks omega-3 sources").
      2.  **Supplement Suggestions:** Based on the gaps, suggest 1-2 specific supplements (e.g., "Vitamin D", "Magnesium Glycinate") and explain why.
      3.  **Goal Alignment:** Assess how well their average intake aligns with their stated goal. Are they in a surplus/deficit? Is their macro split appropriate?
      4.  **Actionable Tip:** Provide one clear, simple tip they can implement immediately to improve.
      
      Keep the tone supportive and educational. Do not give medical advice.`;

      const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
      setResponse(result.text);
    } catch (err) {
      console.error(err);
      let resp = "Sorry, I couldn't perform the analysis. Please try again.";
      if (err instanceof Error && (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
        resp = "Analysis failed due to high traffic. Please try again later.";
      }
      setResponse(resp);
    } finally {
      setLoading(false);
    }
  };
  
  const sanitizedMarkup = DOMPurify.sanitize(marked.parse(response) as string);

  const handleGoToProfile = () => {
    triggerHapticFeedback();
    onClose();
    onOpenProfile();
  };

  if (!isOpen) return null;

  if (!userProfile) {
    return (
      <div className="fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[var(--component-bg)] backdrop-blur-xl rounded-2xl ring-1 ring-[var(--glass-border)] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <header className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-3"><ScienceIcon className="w-6 h-6 text-green-400" /><h2 className="text-xl font-bold text-[var(--text-primary)]">Diet Analysis</h2></div>
            <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]"><CloseIcon className="w-6 h-6" /></button>
          </header>
          <div className="flex-1 overflow-y-auto p-6 text-center">
            <UserIcon className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Complete Your Profile</h3>
            <p className="text-[var(--text-secondary)] mb-6">
              Diet Analysis needs your profile data to give you an accurate analysis. Please complete your profile first.
            </p>
            <button
              onClick={handleGoToProfile}
              className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-white transition-colors"
            >
              Go to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--component-bg)] backdrop-blur-xl rounded-2xl ring-1 ring-[var(--glass-border)] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-3"><ScienceIcon className="w-6 h-6 text-green-400" /><h2 className="text-xl font-bold text-[var(--text-primary)]">Diet Analysis</h2></div>
          <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]"><CloseIcon className="w-6 h-6" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-[var(--text-secondary)] mb-4">Get a deep-dive analysis of your recent food logs to identify nutritional gaps, get supplement suggestions, and see how you're tracking towards your goals.</p>
          <button onClick={handleAnalyzeDiet} disabled={loading} className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-white flex items-center justify-center gap-2 disabled:bg-zinc-600">
            {loading ? <Spinner /> : 'Analyze My Diet'}
          </button>
          
          {response && (
             <div className="mt-4 bg-white/5 p-4 rounded-lg animate-slideUp">
                <div className="prose prose-invert max-w-none prose-p:text-[var(--text-secondary)] prose-strong:text-[var(--text-primary)] prose-headings:text-green-400" dangerouslySetInnerHTML={{ __html: sanitizedMarkup }} />
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DietAnalysis;