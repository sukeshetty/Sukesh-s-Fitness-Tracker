import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { UserProfile, DailyTargets } from '../types';
import Spinner from './Spinner';
import { CloseIcon } from './Icons';
import { useTheme } from './contexts/ThemeContext';

interface ProfilePageProps {
  onClose: () => void;
  userProfile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
}

const defaultProfile: UserProfile = {
    age: 30,
    gender: 'male',
    weight: 70,
    height: 175,
    activityLevel: 'moderate',
    goal: 'maintain',
    healthConditions: [],
    dailyTargets: {
        calories: 2000,
        protein: 150,
        fat: 65,
        isCustom: false,
        lastUpdatedBy: 'ai',
    },
};

const ProfilePage: React.FC<ProfilePageProps> = ({ onClose, userProfile, onSave }) => {
  const [profile, setProfile] = useState<UserProfile>(userProfile || defaultProfile);
  const [newCondition, setNewCondition] = useState('');
  const [loading, setLoading] = useState<'idle' | 'calculating' | 'validating'>('idle');
  const [aiFeedback, setAIFeedback] = useState<string | null>(null);
  const [isAnalyzingReport, setIsAnalyzingReport] = useState(false);
  const [reportAnalysis, setReportAnalysis] = useState<{ summary: string; conditions: string[] } | null>(null);
  const reportFileInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    setProfile(userProfile || defaultProfile);
  }, [userProfile]);

  const calculateAITargets = async () => {
    setLoading('calculating');
    setAIFeedback(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are a nutrition expert. Calculate daily nutritional targets for a person with the following profile:
        Age: ${profile.age} years, Gender: ${profile.gender}, Weight: ${profile.weight} kg, Height: ${profile.height} cm
        Activity Level: ${profile.activityLevel}, Goal: ${profile.goal}
        Provide ONLY a JSON response with this exact structure: {"calories": <number>, "protein": <number>, "fat": <number>, "reasoning": "<brief explanation>"}`;

      const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: [{ parts: [{ text: prompt }] }] });
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const targets = JSON.parse(jsonMatch[0]);
        setProfile(p => ({ ...p, dailyTargets: { calories: targets.calories, protein: targets.protein, fat: targets.fat, isCustom: false, lastUpdatedBy: 'ai' }}));
        setAIFeedback(targets.reasoning);
      }
    } catch (err) {
      console.error(err);
      setAIFeedback('Failed to calculate targets. Please try again.');
    } finally {
      setLoading('idle');
    }
  };

  const validateGoalAdjustment = async () => {
    setLoading('validating');
    setAIFeedback(null);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Evaluate these custom nutritional targets for safety and effectiveness:
        User Profile: Age: ${profile.age}, Gender: ${profile.gender}, Weight: ${profile.weight} kg, Height: ${profile.height} cm, Goal: ${profile.goal}
        New User Targets: ${profile.dailyTargets.calories} calories, ${profile.dailyTargets.protein}g protein, ${profile.dailyTargets.fat}g fat
        Provide feedback: Are these targets too aggressive, too lenient, or appropriate for their goal? Keep response under 100 words.`;

        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
        setAIFeedback(response.text);
    } catch(err) {
        console.error(err);
        setAIFeedback('Failed to get feedback. Please try again.');
    } finally {
        setLoading('idle');
    }
  };

  const handleReportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingReport(true);
    setReportAnalysis(null);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const filePart = {
            inlineData: {
                data: await new Promise<string>(r => {
                    const reader = new FileReader();
                    reader.onloadend = () => r((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(file);
                }),
                mimeType: file.type
            }
        };

        const prompt = `You are a helpful medical assistant. Analyze the following health report (image or PDF).
        1. Provide a concise summary of the key findings in bullet points.
        2. Extract a list of specific health conditions mentioned.
        
        Provide ONLY a JSON response with this exact structure: {"summary": "<string>", "conditions": ["<string>", "<string>"]}.
        If the document is not a health report, respond with: {"summary": "This document does not appear to be a medical report.", "conditions": []}.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [{ text: prompt }, filePart] }
        });

        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            setReportAnalysis(result);
            if (result.conditions && result.conditions.length > 0) {
                setProfile(p => {
                    const newConditions = result.conditions.filter((c: string) => !p.healthConditions.includes(c));
                    return { ...p, healthConditions: [...p.healthConditions, ...newConditions] };
                });
            }
        } else {
             setReportAnalysis({ summary: "Could not process the report. The format might be unsupported.", conditions: [] });
        }

    } catch (err) {
        console.error("Report analysis failed:", err);
        setReportAnalysis({ summary: "An error occurred during analysis. Please try again.", conditions: [] });
    } finally {
        setIsAnalyzingReport(false);
        if (e.target) e.target.value = '';
    }
  };
  
  const handleTargetChange = (field: keyof DailyTargets, value: number) => {
    setProfile(p => ({ ...p, dailyTargets: { ...p.dailyTargets, [field]: value, isCustom: true, lastUpdatedBy: 'user' } }));
    setAIFeedback(null);
  };

  const handleAddCondition = () => {
    if (newCondition.trim() && !profile.healthConditions.includes(newCondition.trim())) {
      setProfile(p => ({ ...p, healthConditions: [...p.healthConditions, newCondition.trim()] }));
      setNewCondition('');
    }
  };

  const handleRemoveCondition = (condition: string) => {
    setProfile(p => ({ ...p, healthConditions: p.healthConditions.filter(c => c !== condition) }));
  };
  
  const inputClasses = isLight 
    ? 'bg-rose-50 border-rose-200 text-rose-900 placeholder-rose-400' 
    : 'bg-zinc-800/80 border-zinc-600 text-white placeholder-zinc-500';

  const conditionTagClasses = isLight 
    ? 'bg-rose-100 text-rose-800'
    : 'bg-zinc-800/50 text-zinc-200';

  return (
    <div className="fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--component-bg)] backdrop-blur-xl rounded-2xl ring-1 ring-[var(--glass-border)] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Your Health Profile</h2>
          <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]"><CloseIcon className="w-6 h-6" /></button>
        </header>
        <div className="overflow-y-auto p-6 space-y-6">
            {/* Vitals */}
            <section>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Your Vitals</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Age</label><input type="number" value={profile.age} onChange={e => setProfile(p => ({ ...p, age: Number(e.target.value) }))} className={`w-full rounded-lg p-2 border ${inputClasses}`} /></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Weight (kg)</label><input type="number" value={profile.weight} onChange={e => setProfile(p => ({ ...p, weight: Number(e.target.value) }))} className={`w-full rounded-lg p-2 border ${inputClasses}`} /></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Height (cm)</label><input type="number" value={profile.height} onChange={e => setProfile(p => ({ ...p, height: Number(e.target.value) }))} className={`w-full rounded-lg p-2 border ${inputClasses}`} /></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Gender</label><select value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value as any }))} className={`w-full rounded-lg p-2 border ${inputClasses}`}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Activity</label><select value={profile.activityLevel} onChange={e => setProfile(p => ({ ...p, activityLevel: e.target.value as any }))} className={`w-full rounded-lg p-2 border ${inputClasses}`}><option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="active">Active</option><option value="very_active">Very Active</option></select></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Goal</label><select value={profile.goal} onChange={e => setProfile(p => ({ ...p, goal: e.target.value as any }))} className={`w-full rounded-lg p-2 border ${inputClasses}`}><option value="lose_weight">Lose Weight</option><option value="maintain">Maintain</option><option value="gain_muscle">Gain Muscle</option></select></div>
                </div>
            </section>
            
            {/* Targets */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Daily Nutritional Targets</h3>
                    <button onClick={calculateAITargets} disabled={loading === 'calculating'} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium text-white disabled:bg-zinc-600 flex items-center gap-2">
                        {loading === 'calculating' ? <Spinner /> : '🤖 AI Calculate'}
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Calories</label><input type="number" value={profile.dailyTargets.calories} onChange={(e) => handleTargetChange('calories', Number(e.target.value))} className={`w-full rounded-lg p-2 border ${inputClasses}`} /></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Protein (g)</label><input type="number" value={profile.dailyTargets.protein} onChange={(e) => handleTargetChange('protein', Number(e.target.value))} className={`w-full rounded-lg p-2 border ${inputClasses}`} /></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Fat (g)</label><input type="number" value={profile.dailyTargets.fat} onChange={(e) => handleTargetChange('fat', Number(e.target.value))} className={`w-full rounded-lg p-2 border ${inputClasses}`} /></div>
                </div>
                {profile.dailyTargets.isCustom && (
                    <button onClick={validateGoalAdjustment} disabled={loading === 'validating'} className="w-full mt-3 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2">
                        {loading === 'validating' ? <Spinner /> : 'Get AI Feedback on These Targets'}
                    </button>
                )}
                {aiFeedback && <p className={`text-xs mt-2 p-2 rounded-md ${isLight ? 'bg-rose-50 text-rose-600' : 'bg-white/5 text-zinc-400'}`}>{aiFeedback}</p>}
            </section>
            
            {/* Health Conditions */}
            <section>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Health Conditions</h3>
                <input type="file" ref={reportFileInputRef} onChange={handleReportUpload} accept="image/*,application/pdf" className="hidden" />
                <button onClick={() => reportFileInputRef.current?.click()} disabled={isAnalyzingReport} className="w-full mb-4 py-2.5 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:bg-zinc-600">
                    {isAnalyzingReport ? <Spinner /> : '📄 Upload & Analyze Health Report'}
                </button>
                {isAnalyzingReport && <p className="text-center text-[var(--text-secondary)] text-sm my-2">Analyzing report... This may take a moment.</p>}
                {reportAnalysis && (
                    <div className={`p-3 rounded-lg mb-4 animate-slideUp ${isLight ? 'bg-rose-50' : 'bg-white/5'}`}>
                        <h4 className={`font-semibold text-sm mb-1 ${isLight ? 'text-green-700' : 'text-green-400'}`}>AI Report Summary</h4>
                        <p className="text-xs text-[var(--text-secondary)] whitespace-pre-line">{reportAnalysis.summary}</p>
                    </div>
                )}
                <div className="space-y-2 mb-3">
                    {profile.healthConditions.map((condition) => (
                        <div key={condition} className={`flex items-center justify-between rounded-lg p-2 pl-3 text-sm ${conditionTagClasses}`}>
                            <span>{condition}</span>
                            <button onClick={() => handleRemoveCondition(condition)} className="text-red-400 hover:text-red-300 p-1">&times;</button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input type="text" value={newCondition} onChange={e => setNewCondition(e.target.value)} placeholder="e.g., Diabetes, High BP" onKeyPress={e => e.key === 'Enter' && handleAddCondition()} className={`flex-1 w-full rounded-lg p-2 border ${inputClasses}`}/>
                    <button onClick={handleAddCondition} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white">Add</button>
                </div>
            </section>
        </div>
        <footer className="p-4 border-t border-[var(--glass-border)]">
          <button onClick={() => onSave(profile)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white text-lg">Save Profile</button>
        </footer>
      </div>
    </div>
  );
};

export default ProfilePage;