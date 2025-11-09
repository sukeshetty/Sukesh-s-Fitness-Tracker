import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { UserProfile, DailyTargets, DailySummaryEntry } from '../types';
import Spinner from './Spinner';
import { CloseIcon, UserIcon } from './Icons';
import { useTheme } from './contexts/ThemeContext';
import { triggerHapticFeedback } from '../utils/audio';
import { getImageForTime } from '../utils/timeBasedImages';

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

        // --- Use Time-Based Pre-Generated Image (Cost Savings!) ---
        // Instead of generating a new image each time, we reuse pre-generated images
        // based on the time of day. This saves significant API costs.
        const avatarUrl = getImageForTime();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Gradient Background */}
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
        <div className="absolute inset-0 bg-black/30"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center p-4 pb-2">
          <div onClick={onClose} className="flex size-12 shrink-0 items-center justify-start cursor-pointer text-white hover:text-white/80">
            <CloseIcon className="w-6 h-6" />
          </div>
          <h1 className="flex-1 text-center text-lg font-bold text-white">Edit Profile</h1>
          <div className="flex w-12 items-center justify-end"></div>
        </div>

        {/* Avatar Section */}
        <div className="flex w-full flex-col items-center gap-4 p-4">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-cover bg-center bg-no-repeat aspect-square w-32 min-h-32 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden" style={profile.aiAvatar ? { backgroundImage: `url("${profile.aiAvatar}")` } : {}}>
              {!profile.aiAvatar && <UserIcon className="w-16 h-16 text-zinc-500" />}
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-[22px] font-bold leading-tight text-white text-center">
                {profile.aiNickname || profile.name || 'Your Name'}
              </p>
              <button
                onClick={handleGeneratePersona}
                disabled={isGeneratingPersona}
                className="text-base font-normal leading-normal text-white/70 text-center hover:text-white cursor-pointer"
              >
                {isGeneratingPersona ? 'Generating...' : 'Change Avatar'}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 px-2 overflow-y-auto max-h-[calc(90vh-320px)]">
            {/* Nickname */}
            <div className="flex w-full flex-wrap items-end">
              <label className="flex flex-1 flex-col min-w-40">
                <p className="pb-2 text-base font-medium leading-normal text-white">Nickname</p>
                <input
                  type="text"
                  value={profile.name || ''}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  className="flex h-14 min-w-0 flex-1 resize-none overflow-hidden rounded-xl border-none p-[15px] text-base font-normal leading-normal text-white placeholder:text-white/50 focus:outline-0 focus:ring-2 focus:ring-primary/50"
                  style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                  placeholder="Your Name"
                />
              </label>
            </div>

            {/* Personal Info Accordion */}
            <div className="flex flex-col gap-3">
              <details className="group flex flex-col rounded-xl px-[15px] py-[7px]" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }} open>
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-2 list-none">
                  <p className="text-sm font-medium leading-normal text-white">Personal Info</p>
                  <svg className="w-6 h-6 text-white transition-transform duration-300 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="grid grid-cols-2 gap-4 pb-4 pt-2">
                  <label className="flex flex-col">
                    <p className="pb-2 text-xs font-medium leading-normal text-white/80">Age</p>
                    <input type="number" value={profile.age} onChange={e => setProfile(p => ({ ...p, age: Number(e.target.value) }))} className="h-12 w-full rounded-lg border-none p-3 text-sm text-white placeholder:text-white/50 focus:outline-0 focus:ring-2 focus:ring-primary/50" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }} />
                  </label>
                  <label className="flex flex-col">
                    <p className="pb-2 text-xs font-medium leading-normal text-white/80">Gender</p>
                    <select value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value as any }))} className="h-12 w-full rounded-lg border-none p-3 text-sm text-white placeholder:text-white/50 focus:outline-0 focus:ring-2 focus:ring-primary/50" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="flex flex-col">
                    <p className="pb-2 text-xs font-medium leading-normal text-white/80">Height (cm)</p>
                    <input type="number" value={profile.height} onChange={e => setProfile(p => ({ ...p, height: Number(e.target.value) }))} className="h-12 w-full rounded-lg border-none p-3 text-sm text-white placeholder:text-white/50 focus:outline-0 focus:ring-2 focus:ring-primary/50" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }} />
                  </label>
                  <label className="flex flex-col">
                    <p className="pb-2 text-xs font-medium leading-normal text-white/80">Weight (kg)</p>
                    <input type="number" value={profile.weight} onChange={e => setProfile(p => ({ ...p, weight: Number(e.target.value) }))} className="h-12 w-full rounded-lg border-none p-3 text-sm text-white placeholder:text-white/50 focus:outline-0 focus:ring-2 focus:ring-primary/50" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }} />
                  </label>
                  <label className="flex flex-col">
                    <p className="pb-2 text-xs font-medium leading-normal text-white/80">Activity Level</p>
                    <select value={profile.activityLevel} onChange={e => setProfile(p => ({ ...p, activityLevel: e.target.value as any }))} className="h-12 w-full rounded-lg border-none p-3 text-sm text-white placeholder:text-white/50 focus:outline-0 focus:ring-2 focus:ring-primary/50" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <option value="sedentary">Sedentary</option>
                      <option value="light">Light</option>
                      <option value="moderate">Moderate</option>
                      <option value="active">Active</option>
                      <option value="very_active">Very Active</option>
                    </select>
                  </label>
                  <label className="flex flex-col">
                    <p className="pb-2 text-xs font-medium leading-normal text-white/80">Goal</p>
                    <select value={profile.goal} onChange={e => setProfile(p => ({ ...p, goal: e.target.value as any }))} className="h-12 w-full rounded-lg border-none p-3 text-sm text-white placeholder:text-white/50 focus:outline-0 focus:ring-2 focus:ring-primary/50" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <option value="lose_weight">Lose Weight</option>
                      <option value="maintain">Maintain</option>
                      <option value="gain_muscle">Gain Muscle</option>
                    </select>
                  </label>
                </div>
              </details>
            {/* Daily Targets Accordion */}
              <details className="group flex flex-col rounded-xl px-[15px] py-[7px]" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-2 list-none">
                  <p className="text-sm font-medium leading-normal text-white">Daily Targets</p>
                  <svg className="w-6 h-6 text-white transition-transform duration-300 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="space-y-4 pb-4 pt-2">
                  <div className="flex min-h-14 items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex shrink-0 items-center justify-center rounded-lg size-10" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
                        <span className="text-white">✨</span>
                      </div>
                      <p className="flex-1 truncate text-base font-normal leading-normal text-white">AI-Generated Targets</p>
                    </div>
                    <button onClick={calculateAITargets} disabled={loading === 'calculating'} className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2">
                      {loading === 'calculating' ? <Spinner /> : 'Calculate'}
                    </button>
                  </div>
                  {aiFeedback && <p className="text-sm font-normal leading-normal text-white/70">{aiFeedback}</p>}
                </div>
              </details>

              {/* Health Conditions Accordion */}
              <details className="group flex flex-col rounded-xl px-[15px] py-[7px]" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-2 list-none">
                  <p className="text-sm font-medium leading-normal text-white">Health Conditions</p>
                  <svg className="w-6 h-6 text-white transition-transform duration-300 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="pb-4 pt-2">
                  <label className="flex flex-col">
                    <p className="pb-2 text-xs font-medium leading-normal text-white/80">Allergies, restrictions, etc.</p>
                    <input
                      type="text"
                      value={newCondition}
                      onChange={e => setNewCondition(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleAddCondition()}
                      placeholder="e.g., Peanuts, Lactose Intolerant"
                      className="h-12 w-full rounded-lg border-none p-3 text-sm text-white placeholder:text-white/50 focus:outline-0 focus:ring-2 focus:ring-primary/50"
                      style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                    />
                  </label>
                  {profile.healthConditions.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {profile.healthConditions.map((condition) => (
                        <div key={condition} className="flex items-center justify-between rounded-lg p-2 pl-3 text-sm bg-white/5 text-white">
                          <span>{condition}</span>
                          <button onClick={() => handleRemoveCondition(condition)} className="text-red-400 hover:text-red-300 p-1">&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
        </div>

        {/* Sticky Bottom Buttons */}
        <div className="sticky bottom-0 mt-auto flex w-full flex-col gap-3 bg-transparent p-4 pb-6">
          <button
            onClick={handleSaveClick}
            className="flex h-14 w-full items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ backgroundImage: 'linear-gradient(to right, #00c6ff, #0072ff)' }}
          >
            Save Changes
          </button>
          <button
            onClick={onClose}
            className="flex h-14 w-full items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ backgroundColor: 'transparent', border: '1px solid rgba(255, 255, 255, 0.3)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;