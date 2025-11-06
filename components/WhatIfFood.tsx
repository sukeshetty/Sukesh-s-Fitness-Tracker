import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { DailySummaryEntry, UserProfile } from '../types';
import { CloseIcon, LightbulbIcon, FireIcon, TargetIcon, RunIcon, SwapIcon, UserIcon } from './Icons';
import Spinner from './Spinner';
import { useTheme } from './contexts/ThemeContext';
import AnimatedNumber from './AnimatedNumber';

interface WhatIfFoodProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  dailySummaries: DailySummaryEntry[];
  onOpenProfile: () => void;
}

interface AnalysisResult {
    foodName: string;
    estimatedNutrition: { calories: number; protein: number; fat: number; };
    dailyImpact: { excessCalories: number; excessProtein: number; excessFat: number; };
    weeklyAdjustments: { activity: string; duration: string; emoji: string; }[];
    swapSuggestions: { suggestion: string; caloriesSaved: number; emoji: string; }[];
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
            fat: { type: Type.NUMBER },
          },
          required: ['calories', 'protein', 'fat']
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
              emoji: { type: Type.STRING },
            },
            required: ['suggestion', 'caloriesSaved', 'emoji']
          }
        }
      },
      required: ['foodName', 'estimatedNutrition', 'dailyImpact', 'weeklyAdjustments', 'swapSuggestions']
    }
  }
};


const WhatIfFood: React.FC<WhatIfFoodProps> = ({ isOpen, onClose, userProfile, dailySummaries, onOpenProfile }) => {
  const [foodInput, setFoodInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const handleAnalyzeImpact = async () => {
    if (!foodInput || !userProfile) return;
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
            - Estimate nutrition for the food.
            - Calculate the daily impact (amount OVER target for each macro).
            - Suggest 2 exercise adjustments.
            - Suggest 2 healthier food swaps.
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
          if (data.analysis.foodName && data.analysis.estimatedNutrition && data.analysis.dailyImpact && data.analysis.weeklyAdjustments && data.analysis.swapSuggestions) {
             setAnalysisResult(data.analysis);
             setConversationHistory([]);
             setFoodInput('');
          } else {
             throw new Error("Received analysis object is missing required fields.");
          }
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
    setFoodInput('');
    setAnalysisResult(null);
    setClarificationQuestion(null);
    setConversationHistory([]);
    setError(null);
  };

  const handleGoToProfile = () => {
    onClose();
    onOpenProfile();
  };

  const inputClasses = isLight ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-zinc-800/80 border-zinc-600 text-white';

  if (!isOpen) return null;

  if (!userProfile) {
    return (
      <div className="fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[var(--component-bg)] backdrop-blur-xl rounded-2xl ring-1 ring-[var(--glass-border)] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <header className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-3"><LightbulbIcon className="w-6 h-6 text-pink-400" /><h2 className="text-xl font-bold text-[var(--text-primary)]">"What If I Eat..." Planner</h2></div>
            <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]"><CloseIcon className="w-6 h-6" /></button>
          </header>
          <div className="flex-1 overflow-y-auto p-6 text-center">
            <UserIcon className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Complete Your Profile</h3>
            <p className="text-[var(--text-secondary)] mb-6">
              The "What If" planner needs your profile data to give you an accurate analysis. Please complete your profile first.
            </p>
            <button
              onClick={handleGoToProfile}
              className="w-full py-3 bg-pink-600 hover:bg-pink-500 rounded-lg font-semibold text-white transition-colors"
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
          <div className="flex items-center gap-3"><LightbulbIcon className="w-6 h-6 text-pink-400" /><h2 className="text-xl font-bold text-[var(--text-primary)]">"What If I Eat..." Planner</h2></div>
          <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]"><CloseIcon className="w-6 h-6" /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
                <div className="p-3 rounded-lg text-sm text-center bg-red-500/20 text-red-300 mb-4 animate-slideUp">
                    {error}
                </div>
            )}
            {!analysisResult && (
                <>
                <p className="text-sm text-[var(--text-secondary)]">
                    {clarificationQuestion 
                    ? "Your request was a bit vague. To give you the best analysis, please provide a bit more detail." 
                    : "Curious about a treat? Enter a food item to see how it might affect your weekly goals and get tips on how to stay on track."}
                </p>
                {clarificationQuestion && (
                    <div className={`p-3 rounded-lg text-sm text-center ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300'}`}>
                        {clarificationQuestion}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={foodInput}
                        onChange={e => setFoodInput(e.target.value)}
                        placeholder={clarificationQuestion ? "e.g., Two slices, deep dish" : "e.g., a large pepperoni pizza..."}
                        className={`flex-1 w-full rounded-lg p-3 border ${inputClasses}`}
                        disabled={loading}
                        onKeyPress={e => e.key === 'Enter' && handleAnalyzeImpact()}
                    />
                    <button onClick={handleAnalyzeImpact} disabled={loading || !foodInput} className="p-3 bg-pink-600 hover:bg-pink-500 rounded-lg text-white disabled:bg-zinc-600">
                        {loading ? <Spinner /> : clarificationQuestion ? 'Submit' : 'Analyze'}
                    </button>
                </div>
                </>
            )}
            
            {analysisResult && userProfile && (
                <div className="space-y-4 animate-slideUp">
                    {/* Nutrition Card */}
                    <AnalysisCard icon={<FireIcon className="text-orange-400 w-6 h-6"/>} title={`Estimated Nutrition for: ${analysisResult.foodName}`}>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div><p className="text-xs text-[var(--text-secondary)]">CALORIES</p><p className="text-2xl font-bold text-[var(--text-primary)]"><AnimatedNumber value={analysisResult.estimatedNutrition.calories} /></p></div>
                            <div><p className="text-xs text-[var(--text-secondary)]">PROTEIN</p><p className="text-2xl font-bold text-[var(--text-primary)]"><AnimatedNumber value={analysisResult.estimatedNutrition.protein} suffix="g"/></p></div>
                            <div><p className="text-xs text-[var(--text-secondary)]">FAT</p><p className="text-2xl font-bold text-[var(--text-primary)]"><AnimatedNumber value={analysisResult.estimatedNutrition.fat} suffix="g"/></p></div>
                        </div>
                    </AnalysisCard>
                    
                    {/* Daily Impact Card */}
                    <AnalysisCard icon={<TargetIcon className="text-red-400 w-6 h-6"/>} title="Forecasted Daily Impact">
                         <div className="grid grid-cols-3 gap-2 text-center">
                            <div><p className="text-xs text-[var(--text-secondary)]">CALORIES OVER</p><p className="text-2xl font-bold text-red-400">+{analysisResult.dailyImpact.excessCalories}</p></div>
                            <div><p className="text-xs text-[var(--text-secondary)]">PROTEIN OVER</p><p className="text-2xl font-bold text-red-400">+{analysisResult.dailyImpact.excessProtein}g</p></div>
                            <div><p className="text-xs text-[var(--text-secondary)]">FAT OVER</p><p className="text-2xl font-bold text-red-400">+{analysisResult.dailyImpact.excessFat}g</p></div>
                        </div>
                    </AnalysisCard>

                    {/* Adjustment Plan Card */}
                    <AnalysisCard icon={<RunIcon className="text-green-400 w-6 h-6"/>} title="Adjustment Plan">
                        <div className="space-y-2">
                           {analysisResult.weeklyAdjustments.map((adj, i) => (
                               <div key={i} className={`p-2 rounded-lg flex items-center gap-3 ${isLight ? 'bg-rose-100' : 'bg-white/5'}`}>
                                   <span className="text-2xl">{adj.emoji}</span>
                                   <div>
                                       <p className="font-semibold text-[var(--text-primary)]">{adj.activity}</p>
                                       <p className="text-sm text-[var(--text-secondary)]">{adj.duration}</p>
                                   </div>
                               </div>
                           ))}
                        </div>
                    </AnalysisCard>

                    {/* Swap Suggestions Card */}
                    <AnalysisCard icon={<SwapIcon className="text-blue-400 w-6 h-6"/>} title="Smarter Swaps">
                        <div className="space-y-2">
                           {analysisResult.swapSuggestions.map((swap, i) => (
                               <div key={i} className={`p-2 rounded-lg flex items-center justify-between ${isLight ? 'bg-rose-100' : 'bg-white/5'}`}>
                                   <div className="flex items-center gap-3">
                                        <span className="text-2xl">{swap.emoji}</span>
                                        <p className="font-semibold text-[var(--text-primary)]">{swap.suggestion}</p>
                                   </div>
                                   <p className="text-sm font-bold text-green-400">~{swap.caloriesSaved} cal saved</p>
                               </div>
                           ))}
                        </div>
                    </AnalysisCard>
                    <button onClick={handleReset} className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-semibold text-white transition-colors">Analyze Another Food</button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

const AnalysisCard: React.FC<{icon: React.ReactNode, title: string, children: React.ReactNode}> = ({icon, title, children}) => {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    return (
        <div className={`p-4 rounded-xl ${isLight ? 'bg-rose-50 ring-1 ring-rose-200' : 'bg-white/5'}`}>
            <div className="flex items-center gap-3 mb-3">
                {icon}
                <h3 className="font-bold text-[var(--text-primary)] text-md">{title}</h3>
            </div>
            {children}
        </div>
    )
}

export default WhatIfFood;