import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { DailySummaryEntry, UserProfile } from '../types';
import { CloseIcon, CoachIcon, SendIcon, ClipboardListIcon, LightbulbIcon, UserIcon } from './Icons';
import Spinner from './Spinner';
import { useTheme } from './contexts/ThemeContext';
import { triggerHapticFeedback } from '../utils/audio';

interface HeyCoachProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  dailySummaries: DailySummaryEntry[];
  onOpenProfile: () => void;
}

interface CoachObservation {
    text: string;
    emoji: string;
}

interface CoachTip {
    text: string;
    emoji: string;
}

interface CoachResponse {
    mainInsight: string;
    observations: CoachObservation[];
    tips: CoachTip[];
    dataNeeded?: string;
}

interface ConversationMessage {
    role: 'user' | 'model';
    content?: string;
    data?: CoachResponse;
    error?: string;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    mainInsight: { type: Type.STRING, description: 'The primary, concise answer to the user\'s question, formatted in Markdown.' },
    observations: {
      type: Type.ARRAY,
      description: 'A list of 2-3 data-driven observations from the user\'s logs relevant to their question.',
      items: {
        type: Type.OBJECT,
        properties: { text: { type: Type.STRING }, emoji: { type: Type.STRING } },
        required: ['text', 'emoji'],
      },
    },
    tips: {
      type: Type.ARRAY,
      description: 'A list of 2-3 actionable tips for the user.',
      items: {
        type: Type.OBJECT,
        properties: { text: { type: Type.STRING }, emoji: { type: Type.STRING } },
        required: ['text', 'emoji'],
      },
    },
    dataNeeded: {
      type: Type.STRING,
      description: 'A friendly message to the user if more data is needed. Should be null if data is sufficient.',
      nullable: true,
    },
  },
  required: ['mainInsight', 'observations', 'tips'],
};


const HeyCoach: React.FC<HeyCoachProps> = ({ isOpen, onClose, userProfile, dailySummaries, onOpenProfile }) => {
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isLight = theme === 'light';

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(scrollToBottom, [conversation]);

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !userProfile) return;
    triggerHapticFeedback();
    setLoading(true);
    setInput('');
    setConversation(prev => [...prev, { role: 'user', content: messageText }]);

    const recentSummaries = dailySummaries.slice(-30);
    const summaryText = recentSummaries.map(s => 
      `Date: ${s.date}, Net Cals: ${s.totals.calories - s.totals.totalCaloriesBurned}/${s.targets.calories}, Protein: ${s.totals.protein}/${s.targets.protein}g`
    ).join('\n');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const fullPrompt = `You are "Hey Coach," a supportive and knowledgeable AI health coach. Your goal is to provide personalized, actionable advice based on the user's data. You MUST respond in the provided JSON format. Analyze the user's data in the context of their question. If data is insufficient, state that in the 'dataNeeded' field. Do not give medical advice.

        **USER DATA:**
        *   **Profile:** Age ${userProfile.age}, Gender ${userProfile.gender}, Weight ${userProfile.weight}kg, Height ${userProfile.height}cm, Goal: ${userProfile.goal}.
        *   **Health Conditions:** ${userProfile.healthConditions.join(', ') || 'None'}.
        *   **Recent Performance (last ${recentSummaries.length} days):**
            ${summaryText || "No logs available."}
        
        **INSTRUCTIONS:**
        1. Calculate the user's BMI (Note: Height is in cm, convert to meters for BMI = kg / m^2).
        2. Analyze their logs in relation to their question.
        3. Formulate a response according to the JSON schema. Be insightful and encouraging.

        **USER'S QUESTION:**
        "${messageText}"
      `;

      const result = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });
      
      const parsedData: CoachResponse = JSON.parse(result.text);
      setConversation(prev => [...prev, { role: 'model', data: parsedData }]);

    } catch (err) {
      console.error(err);
      const error = (err instanceof Error && (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')))
        ? "I can't respond right now due to high traffic. Please try again later."
        : "Sorry, I ran into an issue. Please try asking again.";
      setConversation(prev => [...prev, { role: 'model', error }]);
    } finally {
      setLoading(false);
    }
  };

  const promptStarters = [ "Why am I not losing weight?", "Should I eat before or after a workout?", "How can I reduce my sugar cravings?", "Is my protein intake high enough for muscle gain?", ];
  const inputClasses = isLight ? 'bg-rose-50 border-rose-200 text-rose-900 placeholder-rose-400' : 'bg-zinc-800/80 border-zinc-600 text-white placeholder-zinc-500';

  if (!isOpen) return null;

  const handleGoToProfile = () => {
    triggerHapticFeedback();
    onClose();
    onOpenProfile();
  };

  if (!userProfile) {
    return (
      <div className="fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[var(--component-bg)] backdrop-blur-xl rounded-2xl ring-1 ring-[var(--glass-border)] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <header className="flex items-center justify-between p-4 border-b border-[var(--glass-border)] flex-shrink-0">
            <div className="flex items-center gap-3"><CoachIcon className="w-6 h-6 text-blue-400" /><h2 className="text-xl font-bold text-[var(--text-primary)]">Hey Coach</h2></div>
            <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]"><CloseIcon className="w-6 h-6" /></button>
          </header>
          <div className="flex-1 overflow-y-auto p-6 text-center">
            <UserIcon className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Complete Your Profile</h3>
            <p className="text-[var(--text-secondary)] mb-6">
              To get personalized advice from the AI Coach, please complete your health profile first.
            </p>
            <button
              onClick={handleGoToProfile}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white transition-colors"
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
            <div key={index}>
              {msg.role === 'user' && (
                <div className="flex justify-end">
                  <div className="max-w-lg rounded-xl px-4 py-2.5 bg-blue-600 text-white">{msg.content}</div>
                </div>
              )}
              {msg.role === 'model' && (
                <div className="flex justify-start">
                  <div className={`max-w-lg w-full rounded-xl p-4 space-y-3 ${isLight ? 'bg-rose-100 text-rose-800' : 'bg-zinc-800 text-zinc-200'}`}>
                    {msg.data?.dataNeeded ? (
                      <p>{msg.data.dataNeeded}</p>
                    ) : msg.data ? (
                      <>
                        <div className="prose prose-invert max-w-none prose-p:my-1 prose-p:text-inherit prose-strong:text-inherit" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.data.mainInsight) as string) }} />
                        
                        {msg.data.observations.length > 0 && <InfoCard title="Key Observations" icon={<ClipboardListIcon className="w-5 h-5"/>} items={msg.data.observations} isLight={isLight}/>}
                        {msg.data.tips.length > 0 && <InfoCard title="Actionable Tips" icon={<LightbulbIcon className="w-5 h-5"/>} items={msg.data.tips} isLight={isLight}/>}
                      </>
                    ) : <p>{msg.error}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
                 <div className={`rounded-xl px-4 py-3 flex items-center gap-2 ${isLight ? 'bg-rose-100 text-rose-800' : 'bg-zinc-800 text-zinc-200'}`}>
                     <Spinner /><span className="text-sm">Coach is thinking...</span>
                 </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <footer className="p-4 border-t border-[var(--glass-border)] flex-shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input);}} className="flex items-center gap-2">
                <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question..." className={`flex-1 w-full rounded-lg p-3 border ${inputClasses}`} disabled={loading}/>
                <button type="submit" disabled={loading || !input.trim()} className="p-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white disabled:bg-zinc-600"><SendIcon className="w-5 h-5" /></button>
            </form>
        </footer>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{title: string, icon: React.ReactNode, items: {text: string, emoji: string}[], isLight: boolean}> = ({title, icon, items, isLight}) => (
    <div className={`p-3 rounded-lg ${isLight ? 'bg-rose-200/50' : 'bg-white/5'}`}>
        <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
            {icon}
            {title}
        </h4>
        <ul className="space-y-1.5 text-sm list-none p-0">
            {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0">{item.emoji}</span>
                    <span>{item.text}</span>
                </li>
            ))}
        </ul>
    </div>
);


export default HeyCoach;