import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { ChatMessage, MessageRole, Ingredient, UserProfile, DailySummaryEntry, FavoriteFood } from './types';
import ChatInput from './components/ChatInput';
import ChatMessageBubble from './components/ChatMessage';
import Greeting from './components/Greeting';
import { UserIcon, CalendarIcon, ChartBarIcon } from './components/Icons';
import DuplicateWarningModal from './components/DuplicateWarningModal';
import ProfilePage from './components/ProfilePage';
import DailySummaryHistory from './components/DailySummaryHistory';
import ExerciseLogger from './components/ExerciseLogger';
import Reports from './components/Reports';
import FavoriteFoods from './components/FavoriteFoods';
import ThemeToggle from './components/ThemeToggle';

const BASE_SYSTEM_INSTRUCTION = `You are a helpful and knowledgeable health coach. Your goal is to provide insightful nutritional feedback and encourage healthier choices in a supportive but witty manner.

When the user describes a meal, your response must begin with a JSON object with a nutritional breakdown. This JSON object must be inside a \`\`\`json code block. This JSON + conversational feedback format should be used whenever a meal is described, not just for the first message.

The JSON structure is an array of objects, each with keys: "ingredient", "calories", "protein", "fat", "notes", and "isHealthy".
The "isHealthy" key must be a boolean value (true for healthy, false for unhealthy).

- For healthy foods, the 'notes' should be positive and informative.
- For unhealthy foods, the 'notes' should be a single, witty, sarcastic one-liner.
- **CRITICAL**: If a food item conflicts with the user's health conditions (e.g., high sugar for diabetics, high sodium for hypertension), mark it as "isHealthy": false and include a specific health warning in the notes.

Example JSON for a user with diabetes:
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

Following the JSON block, provide conversational feedback in Markdown.
- If the meal is generally healthy, be encouraging.
- **If any food items conflict with the user's health conditions, provide a specific warning as the first line of your feedback.** (e.g., "⚠️ Warning: This meal contains high sugar which may affect your diabetes. Consider switching to...")
- If the meal contains unhealthy items (without a specific health warning), provide a concise suggestion for improvement (no more than 2 lines).
- Keep all conversational feedback brief, within a 4-5 line maximum.

Do not provide medical advice. Just your expert nutritional judgment with health-aware guidance.`;

const USER_PROFILE_KEY = 'gemini-food-copilot-user-profile';
const FAVORITE_FOODS_KEY = 'gemini-food-copilot-favorite-foods';
const DAILY_SUMMARIES_KEY = 'gemini-food-copilot-daily-summaries';

const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const parseNutritionResponse = (text: string): { nutritionData?: Ingredient[]; remainingText: string } => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = text.match(jsonRegex);

    if (match && match[1]) {
        try {
            const jsonData = JSON.parse(match[1]);
            const normalizedData = jsonData.map((item: any) => ({
                ...item,
                calories: Number(item.calories) || 0,
                protein: Number(item.protein) || 0,
                fat: Number(item.fat) || 0,
            }));
            const remainingText = text.replace(jsonRegex, '').trim();
            return { nutritionData: normalizedData, remainingText };
        } catch (error) {
            console.error("Failed to parse nutrition JSON:", error);
            return { nutritionData: undefined, remainingText: text };
        }
    }

    return { nutritionData: undefined, remainingText: text };
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
  const [isExerciseOpen, setIsExerciseOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  
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
    } catch (error) {
      console.error("Could not load profile from localStorage:", error);
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
    const todayMessages = messages.filter(m => m.timestamp.startsWith(today) && m.role === MessageRole.MODEL && m.nutritionData);

    let totalCalories = 0, totalProtein = 0, totalFat = 0;
    todayMessages.forEach(msg => {
      msg.nutritionData?.forEach(item => {
        totalCalories += Number(item.calories) || 0;
        totalProtein += Number(item.protein) || 0;
        totalFat += Number(item.fat) || 0;
      });
    });

    const summary: DailySummaryEntry = {
      date: today,
      totals: { calories: Math.round(totalCalories), protein: Math.round(totalProtein), fat: Math.round(totalFat) },
      targets: userProfile.dailyTargets,
      mealsLogged: todayMessages.length,
      goalsMet: {
        calories: totalCalories <= userProfile.dailyTargets.calories * 1.1,
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
  }, [messages, userProfile]);

  useEffect(() => {
    if (messages.length > 0) saveDailySummary();
  }, [messages, saveDailySummary]);

  const getEnhancedSystemInstruction = useCallback(() => {
    if (!userProfile) return BASE_SYSTEM_INSTRUCTION;
    let instruction = BASE_SYSTEM_INSTRUCTION;
    if (userProfile.healthConditions.length > 0) {
      instruction += `\n\nUSER HEALTH CONDITIONS: ${userProfile.healthConditions.join(', ')}.`;
    }
    instruction += `\n\nUSER DAILY TARGETS: ${userProfile.dailyTargets.calories} calories, ${userProfile.dailyTargets.protein}g protein, ${userProfile.dailyTargets.fat}g fat.`;
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
  
  const streamModelResponse = async (message: string, onChunk: (text: string) => void, onComplete: (nutritionData?: Ingredient[], remainingText?: string) => void) => {
    if (!chatSessionRef.current) throw new Error("Chat session not initialized.");
    const stream = await chatSessionRef.current.sendMessageStream({ message });
    let modelResponse = '';
    for await (const chunk of stream) {
      modelResponse += chunk.text;
      onChunk(modelResponse);
    }
    const { nutritionData, remainingText } = parseNutritionResponse(modelResponse);
    onComplete(nutritionData, remainingText);
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
        (nutritionData, remainingText) => setMessages(prev => prev.map(m => m.id === modelMessage.id ? { ...m, content: remainingText ?? '', nutritionData } : m))
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
    const modelMessage: ChatMessage = { id: generateUniqueId(), role: MessageRole.MODEL, content: '', timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage, modelMessage]);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const imagePart = { inlineData: { data: await new Promise<string>(r => {const reader = new FileReader(); reader.onloadend = () => r((reader.result as string).split(',')[1]); reader.readAsDataURL(file);}), mimeType: file.type }};
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [ { text: "Describe the food items in this image for a nutrition log. Be descriptive and concise." }, imagePart ] } });
        const foodDescription = response.text;
        setMessages(prev => prev.map(msg => msg.id === userMessage.id ? { ...msg, content: foodDescription } : msg));
        
        await streamModelResponse(
          foodDescription,
          (modelResponse) => setMessages(prev => prev.map(m => m.id === modelMessage.id ? { ...m, content: modelResponse } : m)),
          (nutritionData, remainingText) => setMessages(prev => prev.map(m => m.id === modelMessage.id ? { ...m, content: remainingText ?? '', nutritionData } : m))
        );
    } catch (e) {
        setError(`Image analysis failed: ${e instanceof Error ? e.message : "An unknown error occurred."}`);
        setMessages(prev => prev.filter(msg => msg.id !== userMessage.id && msg.id !== modelMessage.id));
    } finally {
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
    updatedMessages[userMessageIndex + 1] = { ...modelMessage, content: '', nutritionData: undefined };
    setMessages(updatedMessages);

    try {
      await streamModelResponse(
        newContent,
        (modelResponse) => setMessages(prev => prev.map(m => m.id === modelMessage.id ? { ...m, content: modelResponse } : m)),
        (nutritionData, remainingText) => setMessages(prev => prev.map(m => m.id === modelMessage.id ? { ...m, content: remainingText ?? '', nutritionData } : m))
      );
    } catch (e) {
        setError(`Failed to get response: ${e instanceof Error ? e.message : "An unknown error occurred."}`);
        setMessages(originalMessages);
    } finally {
        setLoadingState({ type: 'idle' });
    }
  }, []);

  const handleSaveMealAsFavorite = useCallback((mealContent: string) => {
    const defaultName = mealContent.length > 25 ? `${mealContent.substring(0, 25)}...` : mealContent;
    const mealName = prompt("Enter a name for this favorite meal:", defaultName);
    if (mealName) {
        const saved = localStorage.getItem(FAVORITE_FOODS_KEY);
        const favorites: FavoriteFood[] = saved ? JSON.parse(saved) : [];
        const existingIndex = favorites.findIndex(f => f.name.toLowerCase() === mealName.trim().toLowerCase());

        if (existingIndex >= 0) {
            if (!confirm(`A favorite named "${mealName.trim()}" already exists. Overwrite it?`)) return;
            favorites[existingIndex] = { ...favorites[existingIndex], content: mealContent };
        } else {
            favorites.push({ name: mealName.trim(), content: mealContent, useCount: 1, lastUsed: new Date().toISOString() });
        }
        localStorage.setItem(FAVORITE_FOODS_KEY, JSON.stringify(favorites));
        alert(`"${mealName.trim()}" saved to favorites!`);
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
      <header className="bg-black/30 backdrop-blur-lg p-3 flex items-center justify-between gap-3 sticky top-0 z-20 border-b border-[var(--glass-border)]">
        <h1 className="text-xl font-medium text-[var(--text-primary)]">SukeshFIT</h1>
        <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => setIsExerciseOpen(true)} title="Log Exercise" className="p-2 text-zinc-400 hover:text-orange-400 transition-colors"><span className="text-xl">🏃</span></button>
            <button onClick={() => setIsHistoryOpen(true)} title="Daily History" className="p-2 text-zinc-400 hover:text-indigo-400 transition-colors"><CalendarIcon className="w-6 h-6"/></button>
            <button onClick={() => setIsReportsOpen(true)} title="Weekly/Monthly Reports" className="p-2 text-zinc-400 hover:text-purple-400 transition-colors"><ChartBarIcon className="w-6 h-6"/></button>
            <button onClick={() => setIsProfileOpen(true)} title="Profile" className="p-2 text-zinc-400 hover:text-blue-400 transition-colors"><UserIcon className="w-6 h-6"/></button>
            <ThemeToggle />
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto w-full h-full">
          {messages.length === 0 ? (
            <Greeting onSuggestionClick={(prompt) => handleSendMessage(prompt)} />
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
                        
                        return (
                          <div key={msg.id} className={`flex w-full ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
                              <ChatMessageBubble
                                  message={msg} isMealLog={isMealLog} onSaveMeal={handleSaveMealAsFavorite}
                                  isEditing={editingMessageId === msg.id} onStartEdit={setEditingMessageId}
                                  onCancelEdit={() => setEditingMessageId(null)} onEditMessage={handleEditMessage}
                                  isProcessing={loadingState.type !== 'idle'}
                                  isCurrentlySavingEdit={loadingState.type === 'editing' && loadingState.id === msg.id}
                                  isAnalyzedModelMessage={msg.role === MessageRole.MODEL && !!msg.nutritionData && msg.nutritionData.length > 0}
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
    
      <footer className="w-full px-4 pb-4 sticky bottom-0 bg-gradient-to-t from-[var(--bg-gradient-to)] via-[var(--bg-gradient-to)]/90 to-transparent">
        <div className="max-w-4xl mx-auto">
            {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-sm mb-2 text-center">{error}</div>}
            <FavoriteFoods onSelectFood={(content) => handleSendMessage(content)} />
            <ChatInput
                onSendMessage={handleSendMessage}
                isSending={loadingState.type === 'sending'}
                isSubmitting={loadingState.type !== 'idle'}
                onImageForAnalysis={handleImageForAnalysis}
            />
        </div>
      </footer>

      <DailySummaryHistory isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <ExerciseLogger isOpen={isExerciseOpen} onClose={() => setIsExerciseOpen(false)} />
      <Reports isOpen={isReportsOpen} onClose={() => setIsReportsOpen(false)} />
      <DuplicateWarningModal isOpen={duplicateWarning.show} duplicateContent={duplicateWarning.content} minutesAgo={duplicateWarning.minutesAgo} onConfirm={handleConfirmDuplicate} onCancel={handleCancelDuplicate} />
      {isProfileOpen && <ProfilePage userProfile={userProfile} onSave={handleSaveProfile} onClose={() => setIsProfileOpen(false)} />}
    </div>
  );
};

export default App;
