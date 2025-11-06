import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { UserProfile, DailyTargets, DailySummaryEntry } from '../types';
import Spinner from './Spinner';
import { CloseIcon, UserIcon } from './Icons';
import { useTheme } from './contexts/ThemeContext';
import { triggerHapticFeedback } from '../utils/audio';

interface ProfilePageProps {
  onClose: () => void;
  userProfile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  allDailySummaries: DailySummaryEntry[];
}

const defaultProfile: UserProfile = {
    name: '',
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

const ProfilePage: React.FC<ProfilePageProps> = ({ onClose, userProfile, onSave, allDailySummaries }) => {
  const [profile, setProfile] = useState<UserProfile>(userProfile || defaultProfile);
  const [newCondition, setNewCondition] = useState('');
  const [loading, setLoading] = useState<'idle' | 'calculating' | 'validating'>('idle');
  const [aiFeedback, setAIFeedback] = useState<string | null>(null);
  const [isAnalyzingReport, setIsAnalyzingReport] = useState(false);
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false);
  const [reportAnalysis, setReportAnalysis] = useState<{ summary: string; conditions: string[] } | null>(null);
  const reportFileInputRef = useRef<HTMLInputElement>(null);
  const screenshotFileInputRef = useRef<HTMLInputElement>(null);
  const [uiScreenshots, setUiScreenshots] = useState<Array<{ id: string; dataUrl: string; timestamp: string }>>([]);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    setProfile(userProfile || defaultProfile);
  }, [userProfile]);

  useEffect(() => {
    // Load screenshots from localStorage
    try {
      const saved = localStorage.getItem('ui-screenshots');
      if (saved) {
        setUiScreenshots(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load screenshots:', error);
    }
  }, []);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newScreenshots: Array<{ id: string; dataUrl: string; timestamp: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        newScreenshots.push({
          id: Date.now().toString() + i,
          dataUrl,
          timestamp: new Date().toISOString(),
        });
      }

      const updated = [...uiScreenshots, ...newScreenshots];
      setUiScreenshots(updated);
      localStorage.setItem('ui-screenshots', JSON.stringify(updated));
      triggerHapticFeedback();
    } catch (error) {
      console.error('Failed to upload screenshots:', error);
    }

    if (e.target) e.target.value = '';
  };

  const handleDeleteScreenshot = (id: string) => {
    const updated = uiScreenshots.filter(s => s.id !== id);
    setUiScreenshots(updated);
    localStorage.setItem('ui-screenshots', JSON.stringify(updated));
    triggerHapticFeedback(10);
  };

  const handleGeneratePersona = async () => {
    triggerHapticFeedback();
    if (!profile.name?.trim()) {
        setAIFeedback("Please enter your name first to generate a persona.");
        return;
    }
    setIsGeneratingPersona(true);
    setAIFeedback(null);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // --- Text Generation (Sequential Call 1) ---
        const recentSummaries = allDailySummaries.slice(-7);
        const summaryText = recentSummaries.map(s => `Date: ${s.date}, Net Cals: ${s.totals.calories - s.totals.totalCaloriesBurned}/${s.targets.calories}, Protein: ${s.totals.protein}/${s.targets.protein}g`).join('\n');
        
        const textPrompt = `You are a motivational AI. Create a persona for a user based on their profile and recent performance.
        User Name: ${profile.name}
        User Goal: ${profile.goal}
        Recent Performance (last 7 days):
        ${summaryText || "No recent logs."}
        
        Provide ONLY a JSON response with this exact structure: {"nickname": "<A fun, motivating nickname that vibes with their goal>", "summary": "<A witty, one-line summary of their current journey>"}`;

        // Use gemini-2.5-flash for efficiency
        const textResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: textPrompt }] }] });
        
        // Process text response
        let nickname = "Fitness Fan";
        let summary = "Ready to start the journey!";
        const jsonMatch = textResponse.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            nickname = parsed.nickname;
            summary = parsed.summary;
        }

        // --- Image Generation (Sequential Call 2) ---
        const goalThemes: { [key: string]: string } = {
            lose_weight: 'fitness and health',
            maintain: 'balance and wellness',
            gain_muscle: 'strength and power',
        };
        const imagePrompt = `A motivational, minimalist vector art avatar. The avatar should represent a person focused on ${goalThemes[profile.goal]}. Clean lines, vibrant, inspiring, on a simple, non-distracting background.`;
        
        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: imagePrompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        });

        // Process image response
        let avatarUrl = '';
        for (const part of imageResponse.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                avatarUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
            }
        }
        
        if (!avatarUrl) throw new Error("Avatar generation failed.");

        setProfile(p => ({
            ...p,
            aiNickname: nickname,
            aiSummary: summary,
            aiAvatar: avatarUrl,
        }));

    } catch (err) {
        console.error("Persona generation failed:", err);
        let feedback = `Failed to generate persona. ${err instanceof Error ? err.message : 'Please try again.'}`;
        if (err instanceof Error && (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
            feedback = "Persona generation failed due to high traffic. Please try again in a moment.";
        }
        setAIFeedback(feedback);
    } finally {
        setIsGeneratingPersona(false);
    }
  };

  const calculateAITargets = async () => {
    triggerHapticFeedback();
    setLoading('calculating');
    setAIFeedback(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are a nutrition expert. Calculate daily nutritional targets for a person with the following profile:
        Age: ${profile.age} years, Gender: ${profile.gender}, Weight: ${profile.weight} kg, Height: ${profile.height} cm
        Activity Level: ${profile.activityLevel}, Goal: ${profile.goal}
        Provide ONLY a JSON response with this exact structure: {"calories": <number>, "protein": <number>, "fat": <number>, "reasoning": "<brief explanation>"}`;

      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const targets = JSON.parse(jsonMatch[0]);
        setProfile(p => ({ ...p, dailyTargets: { calories: targets.calories, protein: targets.protein, fat: targets.fat, isCustom: false, lastUpdatedBy: 'ai' }}));
        setAIFeedback(targets.reasoning);
      }
    } catch (err) {
      console.error(err);
      let feedback = 'Failed to calculate targets. Please try again.';
      if (err instanceof Error && (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
        feedback = "AI calculation failed due to high traffic or quota limits. Please try again in a moment.";
      }
      setAIFeedback(feedback);
    } finally {
      setLoading('idle');
    }
  };

  const validateGoalAdjustment = async () => {
    triggerHapticFeedback();
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
        let feedback = 'Failed to get feedback. Please try again.';
        if (err instanceof Error && (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
            feedback = "AI feedback failed due to high traffic. Please try again in a moment.";
        }
        setAIFeedback(feedback);
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
        let analysis = { summary: "An error occurred during analysis. Please try again.", conditions: [] as string[] };
        if (err instanceof Error && (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
            analysis.summary = "Report analysis failed due to high traffic. Please try again later.";
        }
        setReportAnalysis(analysis);
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
    triggerHapticFeedback();
    if (newCondition.trim() && !profile.healthConditions.includes(newCondition.trim())) {
      setProfile(p => ({ ...p, healthConditions: [...p.healthConditions, newCondition.trim()] }));
      setNewCondition('');
    }
  };

  const handleRemoveCondition = (condition: string) => {
    triggerHapticFeedback(10);
    setProfile(p => ({ ...p, healthConditions: p.healthConditions.filter(c => c !== condition) }));
  };
  
  const handleSaveClick = () => {
    triggerHapticFeedback([50, 50, 50]);
    onSave(profile);
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
            {/* AI Persona Section */}
            <section>
                <div className={`p-4 rounded-xl flex items-center gap-4 ${isLight ? 'bg-rose-50' : 'bg-zinc-900/50'}`}>
                    <div className="w-20 h-20 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {profile.aiAvatar ? (
                            <img src={profile.aiAvatar} alt="AI Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon className="w-10 h-10 text-zinc-500" />
                        )}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">
                            {profile.name || 'Your Name'}
                            {profile.aiNickname && <span className="text-lg font-medium text-purple-400 ml-2">- {profile.aiNickname}</span>}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] italic mt-1">
                            {profile.aiSummary || 'Generate a persona to get a summary of your journey!'}
                        </p>
                    </div>
                    <button
                        onClick={handleGeneratePersona}
                        disabled={isGeneratingPersona}
                        className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 rounded-lg text-sm font-medium text-white disabled:bg-zinc-600 disabled:from-zinc-600 disabled:to-zinc-700 flex items-center gap-2"
                        title="Generates an avatar, nickname, and summary based on your profile and recent activity."
                    >
                        {isGeneratingPersona ? <Spinner /> : '✨'}
                        <span className="hidden sm:inline">{isGeneratingPersona ? 'Generating...' : 'Generate AI Persona'}</span>
                    </button>
                </div>
            </section>

            {/* Vitals */}
            <section>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Your Vitals</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Name</label><input type="text" value={profile.name || ''} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} className={`w-full rounded-lg p-2 border ${inputClasses}`} placeholder="Your Name"/></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Age</label><input type="number" value={profile.age} onChange={e => setProfile(p => ({ ...p, age: Number(e.target.value) }))} className={`w-full rounded-lg p-2 border ${inputClasses}`} /></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Weight (kg)</label><input type="number" value={profile.weight} onChange={e => setProfile(p => ({ ...p, weight: Number(e.target.value) }))} className={`w-full rounded-lg p-2 border ${inputClasses}`} /></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Height (cm)</label><input type="number" value={profile.height} onChange={e => setProfile(p => ({ ...p, height: Number(e.target.value) }))} className={`w-full rounded-lg p-2 border ${inputClasses}`} /></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Gender</label><select value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value as any }))} className={`w-full rounded-lg p-2 border ${inputClasses}`}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                    <div><label className="block text-sm text-[var(--text-secondary)] mb-1">Activity</label><select value={profile.activityLevel} onChange={e => setProfile(p => ({ ...p, activityLevel: e.target.value as any }))} className={`w-full rounded-lg p-2 border ${inputClasses}`}><option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="active">Active</option><option value="very_active">Very Active</option></select></div>
                    <div className="col-span-2 md:col-span-1"><label className="block text-sm text-[var(--text-secondary)] mb-1">Goal</label><select value={profile.goal} onChange={e => setProfile(p => ({ ...p, goal: e.target.value as any }))} className={`w-full rounded-lg p-2 border ${inputClasses}`}><option value="lose_weight">Lose Weight</option><option value="maintain">Maintain</option><option value="gain_muscle">Gain Muscle</option></select></div>
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
                <button onClick={() => { reportFileInputRef.current?.click(); triggerHapticFeedback(); }} disabled={isAnalyzingReport} className="w-full mb-4 py-2.5 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:bg-zinc-600">
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

            {/* UI Issue Screenshots */}
            <section>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">📸 UI Issue Screenshots</h3>
                <p className="text-xs text-[var(--text-secondary)] mb-3">Upload screenshots of any UI issues you encounter. These will be saved and can be reviewed to fix bugs.</p>
                <input type="file" ref={screenshotFileInputRef} onChange={handleScreenshotUpload} accept="image/*" multiple className="hidden" />
                <button
                    onClick={() => { screenshotFileInputRef.current?.click(); triggerHapticFeedback(); }}
                    className="w-full mb-4 py-2.5 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2"
                >
                    📷 Upload Screenshots
                </button>

                {uiScreenshots.length > 0 && (
                    <div className="space-y-3">
                        {uiScreenshots.map((screenshot) => (
                            <div key={screenshot.id} className={`rounded-lg overflow-hidden border ${isLight ? 'border-rose-200 bg-rose-50' : 'border-zinc-700 bg-zinc-800/50'}`}>
                                <div className="p-2 flex items-center justify-between">
                                    <span className="text-xs text-[var(--text-secondary)]">
                                        {new Date(screenshot.timestamp).toLocaleString()}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteScreenshot(screenshot.id)}
                                        className="text-red-400 hover:text-red-300 px-2 py-1 rounded text-sm"
                                    >
                                        Delete
                                    </button>
                                </div>
                                <img
                                    src={screenshot.dataUrl}
                                    alt="UI Issue Screenshot"
                                    className="w-full h-auto"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {uiScreenshots.length === 0 && (
                    <div className={`text-center py-8 rounded-lg border-2 border-dashed ${isLight ? 'border-rose-200 bg-rose-50/50' : 'border-zinc-700 bg-zinc-800/30'}`}>
                        <p className="text-sm text-[var(--text-secondary)]">No screenshots uploaded yet</p>
                    </div>
                )}
            </section>
        </div>
        <footer className="p-4 border-t border-[var(--glass-border)]">
          <button onClick={handleSaveClick} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white text-lg">Save Profile</button>
        </footer>
      </div>
    </div>
  );
};

export default ProfilePage;