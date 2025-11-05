import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { ChatMessage, MessageRole, Ingredient, UserProfile, DailySummaryEntry, Activity } from './types';
import ChatInput from './components/ChatInput';
import ChatMessageBubble from './components/ChatMessage';
import Greeting from './components/Greeting';
import { UserIcon, CalendarIcon, ChartBarIcon } from './components/Icons';
import DuplicateWarningModal from './components/DuplicateWarningModal';
import ProfilePage from './components/ProfilePage';
import DailySummaryHistory from './components/DailySummaryHistory';
import Reports from './components/Reports';
import ThemeToggle from './components/ThemeToggle';
import HeyCoach from './components/HeyCoach';
import DietAnalysis from './components/DietAnalysis';
import FastingTracker from './components/FastingTracker';
import WhatIfFood from './components/WhatIfFood';

const BASE_SYSTEM_INSTRUCTION = `You are a helpful and knowledgeable health coach. Your goal is to provide insightful nutritional feedback and encourage healthier choices in a supportive but witty manner.

The user can log either meals or exercises. Your response MUST begin with a JSON object in a \`\`\`json code block based on the user's input.

**1. For MEAL LOGS:**
The JSON structure is an array of objects, each with keys: "ingredient", "calories", "protein", "fat", "notes", and "isHealthy".
The "isHealthy" key must be a boolean.
- For healthy foods, 'notes' should be positive.
- For unhealthy foods, 'notes' should be a witty, sarcastic one-liner.
- **CRITICAL**: If a food conflicts with user's health conditions, mark "isHealthy": false and add a specific warning in 'notes'.
Example JSON for a meal:
\`\`\`json
[
  {
    "ingredient": "Glazed Donut",
    "calories": 260,
    "protein": 3,
    "fat": 14,
    "notes": "⚠️ Contains high sugar, which can significantly impact blood glucose. Best to avoid.",
    "isHealthy": false
  }
]
\`\`\`
Following the JSON, provide conversational feedback in Markdown (max 4-5 lines).

**2. For EXERCISE LOGS:**
If the user describes a physical activity, the JSON structure is an array of objects with keys: "activity", "duration", "caloriesBurned", "notes", and "emoji".
- "duration" is in minutes.
- "emoji" must be a single, relevant emoji for the activity.
- If the user provides calories burned, use that value.
- If not, you MUST estimate "caloriesBurned" based on the activity, duration, and the user's profile (provided below).
- If crucial information like duration is missing, you may ask one clarifying question. Otherwise, make a reasonable estimate.
- 'notes' should be a short, encouraging comment about the activity.
Example JSON for an exercise:
\`\`\`json
[
  {
    "activity": "Running",
    "duration": 30,
    "caloriesBurned": 350,
    "notes": "Great job on the run! That's a solid calorie burn.",
    "emoji": "🏃"
  }
]
\`\`\`
Following the JSON, provide a brief, encouraging comment in Markdown.

Always prioritize identifying the input as either a meal or an exercise and use the correct JSON format. Do not combine them. Do not provide medical advice.`;

const USER_PROFILE_KEY = 'gemini-food-copilot-user-profile';
const DAILY_SUMMARIES_KEY = 'gemini-food-copilot-daily-summaries';

const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const parseModelResponse = (text: string): { nutritionData?: Ingredient[]; activityData?: Activity[]; remainingText: string } => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = text.match(jsonRegex);

    if (match && match[1]) {
        try {
            const jsonData = JSON.parse(match[1]);
            const remainingText = text.replace(jsonRegex, '').trim();

            if (Array.isArray(jsonData) && jsonData.length > 0) {
                // Check if it's a nutrition log
                if ('ingredient' in jsonData[0] && 'calories' in jsonData[0]) {
                    const normalizedData = jsonData.map((item: any) => ({
                        ...item,
                        calories: Number(item.calories) || 0,
                        protein: Number(item.protein) || 0,
                        fat: Number(item.fat) || 0,
                    }));
                    return { nutritionData: normalizedData, remainingText };
                }
                // Check if it's an activity log
                if ('activity' in jsonData[0] && 'caloriesBurned' in jsonData[0]) {
                    const normalizedData = jsonData.map((item: any) => ({
                        ...item,
                        duration: Number(item.duration) || 0,
                        caloriesBurned: Number(item.caloriesBurned) || 0,
                        emoji: item.emoji || '💪',
                    }));
                    return { activityData: normalizedData, remainingText };
                }
            }
            return { remainingText: text };

        } catch (error) {
            console.error("Failed to parse model JSON:", error);
            return { remainingText: text };
        }
    }

    return { remainingText: text };
};

const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const getEditDistance = (s1: string, s2: string): number => {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  };

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};


type LoadingState = { type: 'idle' } | { type: 'sending' } | { type: 'editing', id: string };

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>({ type: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  
  const [isHeyCoachOpen, setIsHeyCoachOpen] = useState(false);
  const [isDietAnalysisOpen, setIsDietAnalysisOpen] = useState(false);
  const [isFastingTrackerOpen, setIsFastingTrackerOpen] = useState(false);
  const [isWhatIfFoodOpen, setIsWhatIfFoodOpen] = useState(false);
  const [allDailySummaries, setAllDailySummaries] = useState<DailySummaryEntry[]>([]);

  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean;
    content: string;
    minutesAgo: number;
    pendingMessage: { userInput: string; imageUrl?: string } | null;
  }>({ show: false, content: '', minutesAgo: 0, pendingMessage: null });
  
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef(messages);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    try {
      const profileJson = localStorage.getItem(USER_PROFILE_KEY);
      if (profileJson) {
        setUserProfile(JSON.parse(profileJson));
      } else {
        setIsProfileOpen(true);
      }
      const summariesJson = localStorage.getItem(DAILY_SUMMARIES_KEY);
      if (summariesJson) {
        setAllDailySummaries(JSON.parse(summariesJson));
      }
    } catch (error) {
      console.error("Could not load data from localStorage:", error);
    }
  }, []);

  const handleSaveProfile = useCallback((profile: UserProfile) => {
    setUserProfile(profile);
    try {
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {
        console.error("Could not save profile:", error);
        setError("Failed to save profile. Your browser storage might be full.");
    }
    setIsProfileOpen(false);
  }, []);

  const saveDailySummary = useCallback(() => {
    if (!userProfile) return;

    const today = new Date().toISOString().split('T')[0];
    const todayMessages = messages.filter(m => m.timestamp.startsWith(today) && m.role === MessageRole.MODEL);

    let totalCalories = 0, totalProtein = 0, totalFat = 0, totalCaloriesBurned = 0, totalMinutesActive = 0;
    let mealsLogged = 0;
    
    todayMessages.forEach(msg => {
      if(msg.nutritionData) {
        mealsLogged++;
        msg.nutritionData.forEach(item => {
          totalCalories += Number(item.calories) || 0;
          totalProtein += Number(item.protein) || 0;
          totalFat += Number(item.fat) || 0;
        });
      }
      if(msg.activityData) {
        msg.activityData.forEach(item => {
          totalCaloriesBurned += Number(item.caloriesBurned) || 0;
          totalMinutesActive += Number(item.duration) || 0;
        });
      }
    });

    const summary: DailySummaryEntry = {
      date: today,
      totals: { calories: Math.round(totalCalories), protein: Math.round(totalProtein), fat: Math.round(totalFat), totalCaloriesBurned: Math.round(totalCaloriesBurned), totalMinutesActive: Math.round(totalMinutesActive) },
      targets: userProfile.dailyTargets,
      mealsLogged: mealsLogged,
      goalsMet: {
        calories: (totalCalories - totalCaloriesBurned) <= userProfile.dailyTargets.calories * 1.1,
        protein: totalProtein >= userProfile.dailyTargets.protein * 0.9,
        fat: totalFat <= userProfile.dailyTargets.fat * 1.1,
      },
    };

    const saved = localStorage.getItem(DAILY_SUMMARIES_KEY);
    const summaries: DailySummaryEntry[] = saved ? JSON.parse(saved) : [];
    const existingIndex = summaries.findIndex((s) => s.date === today);
    if (existingIndex >= 0) {
      summaries[existingIndex] = summary;
    } else {
      summaries.push(summary);
    }
    localStorage.setItem(DAILY_SUMMARIES_KEY, JSON.stringify(summaries));
    setAllDailySummaries(summaries);
  }, [messages, userProfile]);

  useEffect(() => {
    if (messages.length > 0) saveDailySummary();
  }, [messages, saveDailySummary]);

  const getEnhancedSystemInstruction = useCallback(() => {
    if (!userProfile) return BASE_SYSTEM_INSTRUCTION;
    let instruction = BASE_SYSTEM_INSTRUCTION;
    instruction += `\n\nUSER PROFILE: Age: ${userProfile.age}, Gender: ${userProfile.gender}, Weight: ${userProfile.weight}kg.`;
    if (userProfile.healthConditions.length > 0) {
      instruction += ` Health Conditions: ${userProfile.healthConditions.join(', ')}.`;
    }
    instruction += ` Daily Targets: ${userProfile.dailyTargets.calories} calories, ${userProfile.dailyTargets.protein}g protein, ${userProfile.dailyTargets.fat}g fat.`;
    return instruction;
  }, [userProfile]);

  useEffect(() => {
    const initializeChat = () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chat = ai.chats.create({
          model: 'gemini-2.5-pro',
          config: { systemInstruction: getEnhancedSystemInstruction() },
        });
        chatSessionRef.current = chat;
      } catch (e) {
        setError(e instanceof Error ? `Initialization failed: ${e.message}` : "An unknown error occurred during initialization.");
      }
    };
    initializeChat();
  }, [userProfile, getEnhancedSystemInstruction]);
  
  const streamModelResponse = async (message: string, onChunk: (text: string) => void, onComplete: (data: { nutritionData?: Ingredient[], activityData?: Activity[], remainingText?: string }) => void) => {
    if (!chatSessionRef.current) throw new Error("Chat session not initialized.");
    const stream = await chatSessionRef.current.sendMessageStream({ message });
    let modelResponse = '';
    for await (const chunk of stream) {
      modelResponse += chunk.text;
      onChunk(modelResponse);
    }
    const { nutritionData, activityData, remainingText } = parseModelResponse(modelResponse);
    onComplete({ nutritionData, activityData, remainingText });
  };
  
  const handleSendMessageInternal = async (userInput: string, imageUrl?: string) => {
    setError(null);
    setLoadingState({ type: 'sending' });
  
    const userMessage: ChatMessage = { id: generateUniqueId(), role: MessageRole.USER, content: userInput, imageUrl, timestamp: new Date().toISOString() };
    const modelMessage: ChatMessage = { id: generateUniqueId(), role: MessageRole.MODEL, content: '', timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage, modelMessage]);
  
    try {
      await streamModelResponse(
        userInput,
        (modelResponse) => setMessages(prev => prev.map(m => m.id === modelMessage.id ? { ...m, content: modelResponse } : m)),
        ({ nutritionData, activityData, remainingText }) => setMessages(prev => prev.map(m => m.id === modelMessage.id ? { ...m, content: remainingText ?? '', nutritionData, activityData } : m))
      );
    } catch (e) {
      setError(`Failed to get response: ${e instanceof Error ? e.message : "An unknown error occurred."}`);
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id && msg.id !== modelMessage.id));
    } finally {
      setLoadingState({ type: 'idle' });
    }
  };

  const handleSendMessage = useCallback(async (userInput: string, imageUrl?: string) => {
    if (!userInput.trim()) return;
    const normalizedInput = userInput.trim().toLowerCase();
    const recentTimeThreshold = 5 * 60 * 1000;
    const now = Date.now();
    const duplicateMatches = messagesRef.current.filter((msg) => {
      if (msg.role !== MessageRole.USER) return false;
      const msgTime = new Date(msg.timestamp).getTime();
      return (now - msgTime) < recentTimeThreshold && 
             calculateSimilarity(msg.content.trim().toLowerCase(), normalizedInput) > 0.85 && 
             !msg.imageUrl && !imageUrl;
    });
    
    if (duplicateMatches.length > 0) {
      const lastDuplicate = duplicateMatches.pop()!;
      const minutesAgo = Math.round((now - new Date(lastDuplicate.timestamp).getTime()) / 60000);
      setDuplicateWarning({ show: true, content: lastDuplicate.content, minutesAgo, pendingMessage: { userInput, imageUrl } });
      return;
    }
    await handleSendMessageInternal(userInput, imageUrl);
  }, []);
  
  const handleConfirmDuplicate = useCallback(async () => {
    const pending = duplicateWarning.pendingMessage;
    setDuplicateWarning({ show: false, content: '', minutesAgo: 0, pendingMessage: null });
    if (pending) await handleSendMessageInternal(pending.userInput, pending.imageUrl);
  }, [duplicateWarning]);

  const handleCancelDuplicate = useCallback(() => { setDuplicateWarning({ show: false, content: '', minutesAgo: 0, pendingMessage: null }); }, []);

  const handleImageForAnalysis = async (file: File) => {
    if (loadingState.type !== 'idle') return;
    setLoadingState({ type: 'sending' });
    setError(null);
    const imageUrl = URL.createObjectURL(file);
    const userMessage: ChatMessage = { id: generateUniqueId(), role: MessageRole.USER, content: "Analyzing image...", imageUrl, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const imagePart = { inlineData: { data: await new Promise<string>(r => {const reader = new FileReader(); reader.onloadend = () => r((reader.result as string).split(',')[1]); reader.readAsDataURL(file);}), mimeType: file.type }};
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [ { text: "Describe the food items in this image for a nutrition log. Be descriptive and concise." }, imagePart ] } });
        const foodDescription = response.text;
        
        // Update the user message with the description, then send it for analysis
        setMessages(prev => prev.map(msg => msg.id === userMessage.id ? { ...msg, content: foodDescription } : msg));
        await handleSendMessageInternal(foodDescription, imageUrl);

    } catch (e) {
        setError(`Image analysis failed: ${e instanceof Error ? e.message : "An unknown error occurred."}`);
        setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
        setLoadingState({ type: 'idle' });
    }
  };
  
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!newContent.trim()) return;
    setError(null);
    setLoadingState({ type: 'editing', id: messageId });
    setEditingMessageId(null);

    const originalMessages = messagesRef.current;
    const userMessageIndex = originalMessages.findIndex(msg => msg.id === messageId);
    if (userMessageIndex === -1) {
        setLoadingState({ type: 'idle' });
        setError("Could not find the message to edit.");
        return;
    }
    const modelMessage = originalMessages[userMessageIndex + 1];

    const updatedMessages = [...originalMessages];
    updatedMessages[userMessageIndex] = { ...updatedMessages[userMessageIndex], content: newContent, timestamp: new Date().toISOString() };
    updatedMessages[userMessageIndex + 1] = { ...modelMessage, content: '', nutritionData: undefined, activityData: undefined };
    setMessages(updatedMessages);

    try {
      await streamModelResponse(
        newContent,
        (modelResponse) => setMessages(prev => prev.map(m => m.id === modelMessage.id ? { ...m, content: modelResponse } : m)),
        ({ nutritionData, activityData, remainingText }) => setMessages(prev => prev.map(m => m.id === modelMessage.id ? { ...m, content: remainingText ?? '', nutritionData, activityData } : m))
      );
    } catch (e) {
        setError(`Failed to get response: ${e instanceof Error ? e.message : "An unknown error occurred."}`);
        setMessages(originalMessages);
    } finally {
        setLoadingState({ type: 'idle' });
    }
  }, []);

  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const groupedMessages = useMemo(() => {
    const groups: { [date: string]: ChatMessage[] } = {};
    messages.forEach(msg => {
        if (!msg.timestamp) return;
        const dateKey = new Date(msg.timestamp).toDateString();
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(msg);
    });
    return Object.entries(groups).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());
  }, [messages]);

  useEffect(() => { if (!editingMessageId) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [groupedMessages, editingMessageId]);

  return (
    <div className="flex flex-col h-screen bg-transparent text-zinc-200 font-sans">
      <header className="bg-[var(--glass-bg)] backdrop-blur-lg p-3 flex items-center justify-between gap-3 sticky top-0 z-20 border-b border-[var(--glass-border)]">
        <h1 className="text-xl font-medium text-[var(--text-primary)]">SukeshFIT</h1>
        <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => setIsHistoryOpen(true)} title="Daily History" className="p-2 text-[var(--icon-color)] hover:text-pink-500 transition-colors"><CalendarIcon className="w-6 h-6"/></button>
            <button onClick={() => setIsReportsOpen(true)} title="Weekly/Monthly Reports" className="p-2 text-[var(--icon-color)] hover:text-rose-500 transition-colors"><ChartBarIcon className="w-6 h-6"/></button>
            <button onClick={() => setIsProfileOpen(true)} title="Profile" className="p-2 text-[var(--icon-color)] hover:text-fuchsia-500 transition-colors"><UserIcon className="w-6 h-6"/></button>
            <ThemeToggle />
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto w-full h-full">
          {messages.length === 0 ? (
            <Greeting
              onOpenHeyCoach={() => setIsHeyCoachOpen(true)}
              onOpenDietAnalysis={() => setIsDietAnalysisOpen(true)}
              onOpenFastingTracker={() => setIsFastingTrackerOpen(true)}
              onOpenWhatIfFood={() => setIsWhatIfFoodOpen(true)}
            />
          ) : (
            <>
            {groupedMessages.map(([date, messagesForDay]) => (
                <div key={date} className="my-4">
                    <div className="flex justify-center my-4">
                        <span className="bg-[var(--component-bg)] backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-[var(--text-secondary)]">{getRelativeDate(date)}</span>
                    </div>
                    {messagesForDay.map((msg) => {
                        const globalIndex = messages.findIndex(m => m.id === msg.id);
                        const isMealLog = msg.role === MessageRole.USER && globalIndex + 1 < messages.length && messages[globalIndex + 1].role === MessageRole.MODEL && !!messages[globalIndex + 1].nutritionData;
                        const isAnalyzedLogMessage = msg.role === MessageRole.MODEL && ((!!msg.nutritionData && msg.nutritionData.length > 0) || (!!msg.activityData && msg.activityData.length > 0));

                        return (
                          <div key={msg.id} className={`flex w-full ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                              <ChatMessageBubble
                                  message={msg} isMealLog={isMealLog}
                                  isEditing={editingMessageId === msg.id} onStartEdit={setEditingMessageId}
                                  onCancelEdit={() => setEditingMessageId(null)} onEditMessage={handleEditMessage}
                                  isProcessing={loadingState.type !== 'idle'}
                                  isCurrentlySavingEdit={loadingState.type === 'editing' && loadingState.id === msg.id}
                                  isAnalyzedLogMessage={isAnalyzedLogMessage}
                                  messagesForSummary={messages} dailyTargets={userProfile?.dailyTargets}
                              />
                          </div>
                        );
                    })}
                </div>
            ))}
            <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </main>
    
      <footer className="w-full px-4 pb-4 sticky bottom-0 bg-gradient-to-t from-[var(--bg-gradient-to)] via-[var(--bg-gradient-to)]/95 to-transparent pt-4">
        <div className="max-w-4xl mx-auto w-full">
            {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-sm mb-2 text-center">{error}</div>}
            <ChatInput
                onSendMessage={handleSendMessage}
                isSending={loadingState.type === 'sending'}
                isSubmitting={loadingState.type !== 'idle'}
                onImageForAnalysis={handleImageForAnalysis}
            />
        </div>
      </footer>

      <DailySummaryHistory isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <Reports isOpen={isReportsOpen} onClose={() => setIsReportsOpen(false)} />
      <DuplicateWarningModal isOpen={duplicateWarning.show} duplicateContent={duplicateWarning.content} minutesAgo={duplicateWarning.minutesAgo} onConfirm={handleConfirmDuplicate} onCancel={handleCancelDuplicate} />
      {isProfileOpen && <ProfilePage userProfile={userProfile} onSave={handleSaveProfile} onClose={() => setIsProfileOpen(false)} />}
      
      {isHeyCoachOpen && <HeyCoach isOpen={isHeyCoachOpen} onClose={() => setIsHeyCoachOpen(false)} userProfile={userProfile} dailySummaries={allDailySummaries} />}
      {isDietAnalysisOpen && <DietAnalysis isOpen={isDietAnalysisOpen} onClose={() => setIsDietAnalysisOpen(false)} userProfile={userProfile} allDailySummaries={allDailySummaries} />}
      {isFastingTrackerOpen && <FastingTracker isOpen={isFastingTrackerOpen} onClose={() => setIsFastingTrackerOpen(false)} />}
      {isWhatIfFoodOpen && <WhatIfFood isOpen={isWhatIfFoodOpen} onClose={() => setIsWhatIfFoodOpen(false)} userProfile={userProfile} dailySummaries={allDailySummaries} />}
    </div>
  );
};

export default App;