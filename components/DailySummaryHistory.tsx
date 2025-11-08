import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { DailySummaryEntry } from '../types';
import { CloseIcon, CalendarIcon, LightbulbIcon, TargetIcon } from './Icons';
import { useTheme } from './contexts/ThemeContext';
import { triggerHapticFeedback } from '../utils/audio';
import AnimatedNumber from './AnimatedNumber';
import Spinner from './Spinner';

interface DailySummaryHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  summaries: DailySummaryEntry[];
}

const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const GoalIndicator: React.FC<{ met: boolean }> = ({ met }) => (
    <span className={`w-3 h-3 rounded-full ${met ? 'bg-green-400' : 'bg-red-400'}`} title={met ? 'Goal Met' : 'Goal Missed'}></span>
);

interface AIInsight {
  summary: string;
  trends: Array<{ text: string; emoji: string }>;
  predictions: Array<{ text: string; emoji: string }>;
  recommendations: Array<{ text: string; emoji: string }>;
}

const DailySummaryHistory: React.FC<DailySummaryHistoryProps> = ({ isOpen, onClose, summaries }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [aiInsight, setAIInsight] = useState<AIInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  if (!isOpen) return null;

  const sortedSummaries = [...summaries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const generateAIInsight = async () => {
    if (summaries.length === 0) return;

    triggerHapticFeedback();
    setLoadingInsight(true);
    setAIInsight(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Get last 10 days of data
      const recentSummaries = sortedSummaries.slice(0, 10);

      // Calculate aggregate stats
      let totalCalorieDeficit = 0;
      let totalProtein = 0;
      let daysUnderCalories = 0;
      let daysMetProtein = 0;

      recentSummaries.forEach(s => {
        const netCals = s.totals.calories - s.totals.totalCaloriesBurned;
        totalCalorieDeficit += (s.targets.calories - netCals);
        totalProtein += s.totals.protein;
        if (s.goalsMet.calories) daysUnderCalories++;
        if (s.goalsMet.protein) daysMetProtein++;
      });

      const avgDailyDeficit = totalCalorieDeficit / recentSummaries.length;
      const avgProtein = totalProtein / recentSummaries.length;

      const summaryText = recentSummaries.map(s => {
        const netCals = s.totals.calories - s.totals.totalCaloriesBurned;
        const deficit = s.targets.calories - netCals;
        return `${s.date}: Net ${netCals}/${s.targets.calories} cal (${deficit > 0 ? '+' : ''}${deficit} deficit), Protein ${s.totals.protein}/${s.targets.protein}g`;
      }).join('\n');

      const prompt = `You are a fitness analyst. Analyze this user's performance over the last ${recentSummaries.length} days and provide insights.

**DATA:**
${summaryText}

**AGGREGATES:**
- Average daily calorie deficit: ${Math.round(avgDailyDeficit)} calories
- Days meeting calorie goal: ${daysUnderCalories}/${recentSummaries.length}
- Days meeting protein goal: ${daysMetProtein}/${recentSummaries.length}
- Average protein intake: ${Math.round(avgProtein)}g

**TASK:**
Provide a JSON response with this exact structure:
{
  "summary": "<1-2 sentence overview of their performance>",
  "trends": [
    {"text": "<observed trend 1>", "emoji": "<relevant emoji>"},
    {"text": "<observed trend 2>", "emoji": "<relevant emoji>"}
  ],
  "predictions": [
    {"text": "<prediction based on calorie deficit - e.g., 'Your 3500 cal deficit should result in ~0.5kg weight loss'>", "emoji": "⚖️"},
    {"text": "<another prediction or timeframe>", "emoji": "<emoji>"}
  ],
  "recommendations": [
    {"text": "<actionable recommendation 1>", "emoji": "<emoji>"},
    {"text": "<actionable recommendation 2>", "emoji": "<emoji>"}
  ]
}

Keep it concise, motivating, and data-driven. Use 2-3 items per array.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: prompt }] }]
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const insight: AIInsight = JSON.parse(jsonMatch[0]);
        setAIInsight(insight);
      }

    } catch (err) {
      console.error('Failed to generate AI insight:', err);
    } finally {
      setLoadingInsight(false);
    }
  };

  const cardClasses = isLight ? 'bg-rose-50' : 'bg-white/5';
  const headerTextClasses = isLight ? 'text-rose-800' : 'text-zinc-200';
  const secondaryTextClasses = isLight ? 'text-rose-500' : 'text-zinc-400';

  return (
    <div className="fixed inset-0 bg-[var(--modal-overlay-bg)] backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--component-bg)] backdrop-blur-xl rounded-2xl ring-1 ring-[var(--glass-border)] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Daily Log History</h2>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--icon-color)] hover:text-[var(--text-primary)]">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedSummaries.length > 0 && (
            <div className={`p-4 rounded-xl ring-1 ring-white/10 ${cardClasses}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-bold text-md flex items-center gap-2 ${headerTextClasses}`}>
                  <LightbulbIcon className="w-5 h-5 text-yellow-500" />
                  AI Performance Analysis
                </h3>
                <button
                  onClick={generateAIInsight}
                  disabled={loadingInsight}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors ${
                    loadingInsight
                      ? 'bg-zinc-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90'
                  }`}
                >
                  {loadingInsight ? (
                    <span className="flex items-center gap-2">
                      <Spinner /> Analyzing...
                    </span>
                  ) : (
                    '🤖 Generate Insights'
                  )}
                </button>
              </div>

              {aiInsight ? (
                <div className="space-y-4 animate-slideUp">
                  {/* Summary */}
                  <p className={`text-sm ${headerTextClasses} leading-relaxed`}>
                    {aiInsight.summary}
                  </p>

                  {/* Trends */}
                  {aiInsight.trends.length > 0 && (
                    <div>
                      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${secondaryTextClasses}`}>
                        📈 Trends
                      </h4>
                      <ul className="space-y-2">
                        {aiInsight.trends.map((trend, i) => (
                          <li key={i} className={`text-sm flex items-start gap-2 ${headerTextClasses}`}>
                            <span className="flex-shrink-0">{trend.emoji}</span>
                            <span>{trend.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Predictions */}
                  {aiInsight.predictions.length > 0 && (
                    <div>
                      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${secondaryTextClasses}`}>
                        🔮 Predictions
                      </h4>
                      <ul className="space-y-2">
                        {aiInsight.predictions.map((prediction, i) => (
                          <li key={i} className={`text-sm flex items-start gap-2 ${headerTextClasses}`}>
                            <span className="flex-shrink-0">{prediction.emoji}</span>
                            <span>{prediction.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {aiInsight.recommendations.length > 0 && (
                    <div>
                      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${secondaryTextClasses}`}>
                        💡 Recommendations
                      </h4>
                      <ul className="space-y-2">
                        {aiInsight.recommendations.map((rec, i) => (
                          <li key={i} className={`text-sm flex items-start gap-2 ${headerTextClasses}`}>
                            <span className="flex-shrink-0">{rec.emoji}</span>
                            <span>{rec.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : !loadingInsight ? (
                <div className="text-center py-8">
                  <TargetIcon className={`w-12 h-12 mx-auto mb-2 ${secondaryTextClasses}`} />
                  <p className={`text-sm ${secondaryTextClasses}`}>
                    Click "Generate Insights" to see AI-powered analysis of your last 10 days
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {sortedSummaries.length > 0 ? (
            sortedSummaries.map(summary => {
              const netCalories = summary.totals.calories - summary.totals.totalCaloriesBurned;
              return (
                <div key={summary.date} className={`p-4 rounded-xl ring-1 ring-white/10 ${cardClasses}`}>
                  <h3 className={`font-bold text-md mb-3 ${headerTextClasses}`}>
                    {getRelativeDate(summary.date)}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className={secondaryTextClasses}>Net Calories</p>
                      <div className="flex items-center gap-3">
                        <p className={headerTextClasses}>
                          <AnimatedNumber value={netCalories} /> / {summary.targets.calories}
                        </p>
                        <GoalIndicator met={summary.goalsMet.calories} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={secondaryTextClasses}>Protein</p>
                      <div className="flex items-center gap-3">
                        <p className={headerTextClasses}>
                          <AnimatedNumber value={summary.totals.protein} /> / {summary.targets.protein}g
                        </p>
                        <GoalIndicator met={summary.goalsMet.protein} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={secondaryTextClasses}>Fat</p>
                      <div className="flex items-center gap-3">
                        <p className={headerTextClasses}>
                          <AnimatedNumber value={summary.totals.fat} /> / {summary.targets.fat}g
                        </p>
                        <GoalIndicator met={summary.goalsMet.fat} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <CalendarIcon className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-[var(--text-secondary)]">No daily summaries yet.</p>
              <p className="text-xs text-zinc-500">Log some meals to see your history here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailySummaryHistory;
