import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { DailySummaryEntry, UserProfile } from '../types';
import { CloseIcon, LightbulbIcon, FireIcon, TargetIcon, RunIcon, SwapIcon } from './Icons';
import Spinner from './Spinner';
import { useTheme } from './contexts/ThemeContext';
import AnimatedNumber from './AnimatedNumber';

interface WhatIfFoodProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  dailySummaries: DailySummaryEntry[];
}

interface AnalysisResult {
    foodName: string;
    estimatedNutrition: { calories: number; protein: number; fat: number; };
    dailyImpact: { excessCalories: number; excessProtein: number; excessFat: number; };
    weeklyAdjustments: { activity: string; duration: string; emoji: string; }[];
    swapSuggestions: { suggestion: string; caloriesSaved: number; emoji: string; }[];
}

const WhatIfFood: React.FC<WhatIfFoodProps> = ({ isOpen, onClose, userProfile, dailySummaries }) => {
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
      const prompt = `You are a nutrition calculator and strategist. A user wants to know the impact of eating a specific food.

      **Conversation History:**
      ${updatedHistory.join('\n')}
      
      **User Profile & Context:**
      - Daily Calorie Target: ${userProfile.dailyTargets.calories}
      - Daily Protein Target: ${userProfile.dailyTargets.protein}g
      - Daily Fat Target: ${userProfile.dailyTargets.fat}g
      - 7-Day Average Net Calorie Intake: ${Math.round(weeklyAvgCalories)}
      
      **Your Task:**
      Your response MUST start with a JSON object in a \`\`\`json code block.
      The JSON object must have one of two top-level keys: "clarificationNeeded" OR "analysis".
      
      1.  **If the user's input is too vague** (e.g., "pizza"):
          - The JSON should be: \`{"clarificationNeeded": "Your clarifying question here."}\`
          - Example: \`{"clarificationNeeded": "What kind of pizza and how many slices?"}\`
      
      2.  **If the user's input is specific enough:**
          - The JSON should contain the "analysis" object with the following structure:
            - **foodName**: The food as you understood it.
            - **estimatedNutrition**: { "calories": number, "protein": number, "fat": number }
            - **dailyImpact**: { "excessCalories": number, "excessProtein": number, "excessFat": number } (Calculate the amount EACH nutrient would go OVER the daily target. If under, use 0 or a negative number.)
            - **weeklyAdjustments**: An array of 2 objects: { "activity": string, "duration": string, "emoji": string }
            - **swapSuggestions**: An array of 2 objects: { "suggestion": string, "caloriesSaved": number, "emoji": string }
      
      Do not add any text outside of the JSON code block.`;

      const response = await ai.models.generateContent({ 
        model: 'gemini-2.5-pro', 
        contents: prompt,
      });

      const responseText = response.text;
      // Use a more robust regex to find a JSON object, which might not be in a markdown block.
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch && jsonMatch[0]) {
        try {
          const data = JSON.parse(jsonMatch[0]);

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
              throw new Error("AI response JSON is missing 'clarificationNeeded' or 'analysis' key.");
          }
        } catch (parseError) {
          console.error("JSON Parsing Error:", parseError, "Raw text:", responseText);
          setError("The AI response was not in the expected format. Please try again.");
        }
      } else {
          console.error("No JSON block found in response:", responseText);
          setError("Could not find a valid analysis in the AI's response. Please try rephrasing your request.");
      }

    } catch (err) {
      console.error("API Error:", err);
      setError(`An error occurred while communicating with the AI. ${err instanceof Error ? err.message : 'Please check your connection and try again.'}`);
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

  const inputClasses = isLight ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-zinc-800/80 border-zinc-600 text-white';

  if (!isOpen) return null;

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