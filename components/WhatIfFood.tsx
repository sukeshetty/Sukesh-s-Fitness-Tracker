import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { DailySummaryEntry, UserProfile } from '../types';
import { CloseIcon, UserIcon } from './Icons';
import Spinner from './Spinner';
import { triggerHapticFeedback } from '../utils/audio';

interface WhatIfFoodProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  dailySummaries: DailySummaryEntry[];
  onOpenProfile: () => void;
}

interface AnalysisResult {
    foodName: string;
    estimatedNutrition: { calories: number; protein: number; carbs: number; fat: number; };
    dailyImpact: { excessCalories: number; excessProtein: number; excessFat: number; };
    weeklyAdjustments: { activity: string; duration: string; emoji: string; }[];
    swapSuggestions: { suggestion: string; caloriesSaved: number; proteinBoost: number; emoji: string; }[];
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    clarificationNeeded: {
      type: Type.STRING,
      description: "A question to ask the user if their input is too vague. This should be null if the input is clear.",
      nullable: true,
    },
    analysis: {
      type: Type.OBJECT,
      description: "The full nutritional analysis. This should be null if clarification is needed.",
      nullable: true,
      properties: {
        foodName: { type: Type.STRING },
        estimatedNutrition: {
          type: Type.OBJECT,
          properties: {
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fat: { type: Type.NUMBER },
          },
          required: ['calories', 'protein', 'carbs', 'fat']
        },
        dailyImpact: {
          type: Type.OBJECT,
          properties: {
            excessCalories: { type: Type.NUMBER },
            excessProtein: { type: Type.NUMBER },
            excessFat: { type: Type.NUMBER },
          },
           required: ['excessCalories', 'excessProtein', 'excessFat']
        },
        weeklyAdjustments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              activity: { type: Type.STRING },
              duration: { type: Type.STRING },
              emoji: { type: Type.STRING },
            },
            required: ['activity', 'duration', 'emoji']
          }
        },
        swapSuggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              suggestion: { type: Type.STRING },
              caloriesSaved: { type: Type.NUMBER },
              proteinBoost: { type: Type.NUMBER },
              emoji: { type: Type.STRING },
            },
            required: ['suggestion', 'caloriesSaved', 'proteinBoost', 'emoji']
          }
        }
      },
      required: ['foodName', 'estimatedNutrition', 'dailyImpact', 'weeklyAdjustments', 'swapSuggestions']
    }
  }
};

const CircularProgress: React.FC<{ value: number; max: number; color: string; label: string; unit?: string }> = ({ value, max, color, label, unit = '' }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
          <circle className="stroke-current text-white/10" cx="50" cy="50" fill="transparent" r="42" strokeWidth="8"></circle>
          <circle
            className={`stroke-current ${color} transition-all duration-500`}
            cx="50"
            cy="50"
            fill="transparent"
            r="42"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth="8"
          ></circle>
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-lg font-bold text-white">{value}{unit}</span>
          {max > 0 && <span className="text-xs text-gray-400">of {max}{unit}</span>}
        </div>
      </div>
      <p className="text-sm font-medium text-white">{label}</p>
    </div>
  );
};

const WhatIfFood: React.FC<WhatIfFoodProps> = ({ isOpen, onClose, userProfile, dailySummaries, onOpenProfile }) => {
  const [foodInput, setFoodInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeImpact = async () => {
    if (!foodInput || !userProfile) return;
    triggerHapticFeedback();
    setLoading(true);
    setAnalysisResult(null);
    setClarificationQuestion(null);
    setError(null);

    const updatedHistory = [...conversationHistory, `User: ${foodInput}`];

    const last7Days = dailySummaries.filter(s => {
        const date = new Date(s.date);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return date > sevenDaysAgo;
    });

    const weeklyAvgCalories = last7Days.length > 0
      ? last7Days.reduce((sum, s) => sum + (s.totals.calories - s.totals.totalCaloriesBurned), 0) / last7Days.length
      : userProfile.dailyTargets.calories;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Analyze the user's food query based on their profile and conversation history. Return a JSON object matching the provided schema.

        **User Profile:**
        - Daily Targets: ${userProfile.dailyTargets.calories} Cal, ${userProfile.dailyTargets.protein}g Pro, ${userProfile.dailyTargets.fat}g Fat
        - 7-Day Avg Net Intake: ${Math.round(weeklyAvgCalories)} Cal

        **Conversation History:**
        ${updatedHistory.join('\n')}

        **Instructions:**
        1.  **Vague Input:** If the latest user input is vague (e.g., "a sandwich"), ask a clarifying question in the \`clarificationNeeded\` field. \`analysis\` must be null.
        2.  **Specific Input:** If the input is clear, provide a full analysis in the \`analysis\` field. \`clarificationNeeded\` must be null.
            - Estimate nutrition for the food (include carbs).
            - Calculate the daily impact (amount OVER target for each macro).
            - Suggest 2 exercise adjustments.
            - Suggest 2 healthier food swaps with calorie savings and protein boost.
        `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        }
      });

      const responseText = response.text;

      try {
        const data = JSON.parse(responseText);

        if (data.clarificationNeeded) {
          setClarificationQuestion(data.clarificationNeeded);
          setConversationHistory(prev => [...prev, `User: ${foodInput}`, `AI: ${data.clarificationNeeded}`]);
          setFoodInput('');
        } else if (data.analysis) {
          setAnalysisResult(data.analysis);
          setConversationHistory([]);
          setFoodInput('');
        } else {
            throw new Error("AI response did not provide clarification or analysis.");
        }
      } catch (parseError) {
        console.error("JSON Parsing Error:", parseError, "Raw text:", responseText);
        setError("The AI response was not in the expected format. Please try again.");
      }

    } catch (err) {
      console.error("API Error:", err);
      let errorMsg = `An error occurred while communicating with the AI. ${err instanceof Error ? err.message : 'Please check your connection and try again.'}`;
      if (err instanceof Error && (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
        errorMsg = "Analysis failed due to high traffic. Please try again later.";
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    triggerHapticFeedback();
    setFoodInput('');
    setAnalysisResult(null);
    setClarificationQuestion(null);
    setConversationHistory([]);
    setError(null);
  };

  if (!isOpen) return null;

  if (!userProfile) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[#1f1a2e] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <header className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">What If I Eat...</h2>
            <button onClick={onClose} className="p-1 text-white/70 hover:text-white"><CloseIcon className="w-6 h-6" /></button>
          </header>
          <div className="flex-1 overflow-y-auto p-6 text-center">
            <UserIcon className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Complete Your Profile</h3>
            <p className="text-white/70 mb-6">
              The "What If" planner needs your profile data to give you an accurate analysis. Please complete your profile first.
            </p>
            <button
              onClick={() => { onClose(); onOpenProfile(); }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:opacity-90 rounded-lg font-semibold text-white transition-all"
            >
              Go to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      {/* Background with gradient blur effects */}
      <div className="absolute inset-0 bg-[#1f1a2e]">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-purple-900/50 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/2 translate-y-1/2 transform rounded-full bg-fuchsia-900/40 blur-3xl"></div>
      </div>

      {/* Main modal content */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <h1 className="flex-1 text-xl font-bold text-white">What If I Eat...</h1>
          <div onClick={onClose} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Input Section */}
        <div className="flex max-w-full flex-wrap items-end gap-4 py-3">
          <label className="flex flex-col min-w-40 flex-1">
            <div className="flex w-full flex-1 items-stretch rounded-xl" style={{ background: 'rgba(147, 51, 234, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
              <input
                className="flex h-14 min-w-0 flex-1 resize-none overflow-hidden rounded-xl border-none bg-transparent p-4 text-base text-white placeholder:text-gray-300 focus:outline-0 focus:ring-2 focus:ring-purple-500/50"
                placeholder="e.g., a donut"
                value={foodInput}
                onChange={e => setFoodInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAnalyzeImpact()}
                disabled={loading}
              />
              <button
                onClick={handleAnalyzeImpact}
                disabled={loading || !foodInput}
                className="flex items-center justify-center pr-4 text-gray-300 hover:text-white disabled:opacity-50"
              >
                {loading ? <Spinner /> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
              </button>
            </div>
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg text-sm text-center bg-red-500/20 text-red-300 mb-4 animate-slideUp">
            {error}
          </div>
        )}

        {/* Clarification Section */}
        {clarificationQuestion && !analysisResult && (
          <div className="flex flex-col gap-2 py-4">
            <p className="px-1 text-base text-gray-200">{clarificationQuestion}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              {/* These would be dynamically generated suggestion chips */}
              <div className="flex h-10 cursor-pointer shrink-0 items-center justify-center gap-x-2 rounded-xl bg-purple-500/20 px-4 hover:bg-purple-500/40 transition-colors">
                <p className="text-sm font-medium text-purple-200">Provide more details</p>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysisResult && userProfile && (
          <div className="mt-4 flex flex-col gap-6 rounded-xl p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-200px)]" style={{ background: 'rgba(147, 51, 234, 0.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
            {/* Impact on Your Day */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-lg font-bold text-white">Impact on Your Day</p>
                <p className="text-base text-gray-300">Here's how {analysisResult.foodName} would affect your daily goals.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <CircularProgress
                  value={analysisResult.estimatedNutrition.calories}
                  max={userProfile.dailyTargets.calories}
                  color="text-orange-400"
                  label="Calories"
                />
                <CircularProgress
                  value={analysisResult.estimatedNutrition.protein}
                  max={userProfile.dailyTargets.protein}
                  color="text-purple-500"
                  label="Protein"
                  unit="g"
                />
                <CircularProgress
                  value={analysisResult.estimatedNutrition.carbs || 0}
                  max={150}
                  color="text-blue-400"
                  label="Carbs"
                  unit="g"
                />
                <CircularProgress
                  value={analysisResult.estimatedNutrition.fat}
                  max={userProfile.dailyTargets.fat}
                  color="text-fuchsia-400"
                  label="Fat"
                  unit="g"
                />
              </div>
            </div>

            {/* Burn It Off */}
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-white">Burn It Off</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {analysisResult.weeklyAdjustments.map((adj, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg bg-white/5 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                      <span className="text-2xl">{adj.emoji}</span>
                    </div>
                    <div className="flex flex-col">
                      <p className="font-semibold text-white">{adj.activity}</p>
                      <p className="text-sm text-gray-300">{adj.duration}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Swap It for a Healthier Choice */}
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-white">Swap It for a Healthier Choice</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {analysisResult.swapSuggestions.map((swap, i) => (
                  <div key={i} className="flex flex-col overflow-hidden rounded-xl bg-white/5">
                    <div className="flex items-center gap-3 p-4">
                      <span className="text-3xl">{swap.emoji}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{swap.suggestion}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-green-500/20 px-2 py-1 font-medium text-green-300">-{swap.caloriesSaved} Cal</span>
                          <span className="rounded-full bg-purple-500/20 px-2 py-1 font-medium text-purple-300">+{swap.proteinBoost}g Protein</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-col gap-3">
              <button
                onClick={handleReset}
                className="h-14 w-full rounded-xl text-center text-base font-bold text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundImage: 'linear-gradient(to right, #a855f7, #9333ea)' }}
              >
                Analyze Another Food
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatIfFood;
