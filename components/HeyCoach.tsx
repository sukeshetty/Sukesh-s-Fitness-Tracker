import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { DailySummaryEntry, UserProfile } from '../types';
import { CloseIcon, CoachIcon, SendIcon } from './Icons';
import Spinner from './Spinner';
import { useTheme } from './contexts/ThemeContext';

interface HeyCoachProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  dailySummaries: DailySummaryEntry[];
}

interface ConversationMessage {
    role: 'user' | 'model';
    content: string;
}

const HeyCoach: React.FC<HeyCoachProps> = ({ isOpen, onClose, userProfile, dailySummaries }) => {
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLight = theme === 'light';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [conversation]);

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !userProfile) return;
    setLoading(true);
    setInput('');
    setConversation(prev => [...prev, { role: 'user', content: messageText }]);

    const recentSummaries = dailySummaries.slice(-30); // Analyze last 30 days
    const summaryText = recentSummaries.map(s => 
      `Date: ${s.date}, Net Cals: ${s.totals.calories - s.totals.totalCaloriesBurned}/${s.targets.calories}, Protein: ${s.totals.protein}/${s.targets.protein}g, Fat: ${s.totals.fat}/${s.targets.fat}g, Active Mins: ${s.totals.totalMinutesActive}`
    ).join('\n');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are "Hey Coach," a supportive, knowledgeable, and motivating AI health coach. Your goal is to provide personalized, actionable advice based on the user's data.
      
      **USER DATA:**
      *   **Profile:** Age ${userProfile.age}, Gender ${userProfile.gender}, Weight ${userProfile.weight}kg, Goal: ${userProfile.goal}, Health Conditions: ${userProfile.healthConditions.join(', ') || 'None'}.
      *   **Recent Performance (last ${recentSummaries.length} days of logs):**
          ${summaryText || "No logs available for this period."}
      
      **USER'S QUESTION:**
      "${messageText}"
      
      **YOUR TASK:**
      Analyze the user's data in the context of their question. Provide a clear, concise, and encouraging answer. Use Markdown for formatting. Break down complex topics into simple terms. If the user's data is insufficient to give a good answer, state that and explain what you'd need to see (e.g., more consistent logging). **Do not give medical advice.** Keep responses focused and easy to read.`;

      const result = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
      setConversation(prev => [...prev, { role: 'model', content: result.text }]);
    } catch (err) {
      console.error(err);
      setConversation(prev => [...prev, { role: 'model', content: "Sorry, I ran into an issue. Please try asking again." }]);
    } finally {
      setLoading(false);
    }
  };

  const promptStarters = [
    "Why am I not losing weight?",
    "Should I eat before or after a workout?",
    "How can I reduce my sugar cravings?",
    "Is my protein intake high enough for muscle gain?",
  ];

  const inputClasses = isLight ? 'bg-rose-50 border-rose-200 text-rose-900 placeholder-rose-400' : 'bg-zinc-800/80 border-zinc-600 text-white placeholder-zinc-500';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--component-bg)] backdrop-blur-xl rounded-2xl ring-1 ring-[var(--glass-border)] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-[var(--glass-border)] flex-shrink-0">
          <div className="flex items-center gap-3"><CoachIcon className="w-6 h-6 text-blue-400" /><h2 className="text-xl font-bold text-[var(--text-primary)]">Hey Coach</h2></div>
          <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]"><CloseIcon className="w-6 h-6" /></button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {conversation.length === 0 && (
             <div className="text-center">
                <p className="text-[var(--text-secondary)] mb-4">Ask me anything about your health, diet, or fitness goals. I'll use your logs and profile to give you a personalized answer.</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    {promptStarters.map(prompt => (
                        <button key={prompt} onClick={() => handleSendMessage(prompt)} className={`p-3 rounded-lg text-left transition-colors ${isLight ? 'bg-rose-100 hover:bg-rose-200 text-rose-700' : 'bg-white/5 hover:bg-white/10 text-zinc-300'}`}>
                            {prompt}
                        </button>
                    ))}
                </div>
            </div>
          )}
          {conversation.map((msg, index) => (
            <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-lg rounded-xl px-4 py-2.5 ${msg.role === 'user' ? 'bg-blue-600 text-white' : (isLight ? 'bg-rose-100 text-rose-800' : 'bg-zinc-800 text-zinc-200')}`}>
                 <div className="prose prose-invert max-w-none prose-p:my-1 prose-p:text-inherit prose-strong:text-inherit prose-headings:text-inherit" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content) as string) }} />
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
                 <div className={`rounded-xl px-4 py-3 flex items-center gap-2 ${isLight ? 'bg-rose-100 text-rose-800' : 'bg-zinc-800 text-zinc-200'}`}>
                     <Spinner />
                     <span className="text-sm">Coach is thinking...</span>
                 </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <footer className="p-4 border-t border-[var(--glass-border)] flex-shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input);}} className="flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask a question..."
                    className={`flex-1 w-full rounded-lg p-3 border ${inputClasses}`}
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !input.trim()} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white disabled:bg-zinc-600">
                   <SendIcon className="w-5 h-5" />
                </button>
            </form>
        </footer>
      </div>
    </div>
  );
};

export default HeyCoach;