import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { ChatMessage, MessageRole, Ingredient, SavedMeal } from './types';
import ChatInput from './components/ChatInput';
import ChatMessageBubble from './components/ChatMessage';
import DailySummaryView from './components/DailySummaryView';
import Greeting from './components/Greeting';
import { GeminiStarIcon, ChartBarIcon } from './components/Icons';
import VideoGenerator from './components/VideoGenerator';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { safeLocalStorage, StorageError } from './utils/storage';

const SYSTEM_INSTRUCTION = `You are a helpful and knowledgeable health coach. Your goal is to provide insightful nutritional feedback and encourage healthier choices in a supportive but witty manner.

When the user describes a meal, your response must begin with a JSON object with a nutritional breakdown. This JSON object must be inside a \`\`\`json code block. This JSON + conversational feedback format should be used whenever a meal is described, not just for the first message.

The JSON structure is an array of objects, each with keys: "ingredient", "calories", "protein", "fat", "notes", and "isHealthy".
The "isHealthy" key must be a boolean value (true for healthy, false for unhealthy).

- For healthy foods, the 'notes' should be positive and informative.
- For unhealthy foods, the 'notes' must be a single, witty, sarcastic one-liner.

Example JSON:
\`\`\`json
[
  {
    "ingredient": "Glazed Donut",
    "calories": 260,
    "protein": 3,
    "fat": 14,
    "notes": "The fastest way to get a sugar rush and a subsequent nap.",
    "isHealthy": false
  },
  {
    "ingredient": "Greek Yogurt",
    "calories": 100,
    "protein": 18,
    "fat": 0,
    "notes": "Excellent source of protein to keep you full.",
    "isHealthy": true
  }
]
\`\`\`

Following the JSON block, provide conversational feedback in Markdown.
- If the meal is generally healthy, be encouraging.
- If the meal contains unhealthy items, provide a concise suggestion for improvement (no more than 2 lines) after your comment.
- Keep all conversational feedback brief, within a 4-5 line maximum.

Example conversational feedback for the donut:
"That donut is quite the indulgence. For a breakfast with more staying power, you could try a whole-wheat bagel with a bit of cream cheese next time."

For all subsequent messages, continue the conversation in this helpful but witty tone.

Do not provide medical advice. Just your expert nutritional judgment.`;

const SAVED_MEALS_KEY = 'gemini-food-copilot-saved-meals';

const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const parseNutritionResponse = (text: string): { nutritionData?: Ingredient[]; remainingText: string } => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = text.match(jsonRegex);

    if (match && match[1]) {
        try {
            const jsonData = JSON.parse(match[1]);

            // Normalize to ensure numbers (fix type safety bug)
            const normalizedData = jsonData.map((item: any) => ({
              ...item,
              calories: typeof item.calories === 'string' ? parseFloat(item.calories) || 0 : item.calories,
              protein: typeof item.protein === 'string' ? parseFloat(item.protein) || 0 : item.protein,
              fat: typeof item.fat === 'string' ? parseFloat(item.fat) || 0 : item.fat,
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

type LoadingState = { type: 'idle' } | { type: 'sending' } | { type: 'editing', id: string };

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>({ type: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [selectedImageForVideo, setSelectedImageForVideo] = useState<File | null>(null);
  const [showVideoGenerator, setShowVideoGenerator] = useState(false);

  // Online/offline status detection
  const isOnline = useOnlineStatus();

  // Memory leak fix: Cleanup blob URLs
  useEffect(() => {
    return () => {
      messages.forEach(msg => {
        if (msg.imageUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(msg.imageUrl);
        }
      });
    };
  }, [messages]);

  useEffect(() => {
    try {
        const saved = safeLocalStorage.getItem(SAVED_MEALS_KEY);
        if (saved) {
            setSavedMeals(JSON.parse(saved));
        }
    } catch (error) {
        console.error("Could not load saved meals:", error);
    }
  }, []);

  useEffect(() => {
    try {
        safeLocalStorage.setItem(SAVED_MEALS_KEY, JSON.stringify(savedMeals));
    } catch (error) {
        if (error instanceof StorageError && error.isQuotaExceeded) {
          setError('Storage is full. Please delete some saved meals or clear old data.');
        } else {
          console.error("Could not save meals:", error);
        }
    }
  }, [savedMeals]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!editingMessageId) {
        scrollToBottom();
    }
  }, [messages, editingMessageId]);

  useEffect(() => {
    const initializeChat = () => {
      try {
        console.log('🔑 Initializing chat with API key:', process.env.API_KEY ? 'Key present ✅' : 'Key missing ❌');
        if (!process.env.API_KEY) {
          throw new Error("API_KEY environment variable not set.");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chat = ai.chats.create({
          model: 'gemini-2.5-pro',
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        });
        chatSessionRef.current = chat;
      } catch (e) {
        if (e instanceof Error) {
          setError(`Initialization failed: ${e.message}`);
        } else {
          setError("An unknown error occurred during initialization.");
        }
        console.error(e);
      }
    };
    initializeChat();
  }, []);

  const handleSendMessage = useCallback(async (userInput: string, imageUrl?: string) => {
    console.log('🚀 handleSendMessage called with:', userInput);

    if (!userInput.trim()) {
      console.log('⚠️ Empty input, returning');
      return;
    }

    const normalizedInput = userInput.trim().toLowerCase();
    const isDuplicate = messages.some(
      (msg) => msg.role === MessageRole.USER && msg.content.trim().toLowerCase() === normalizedInput && !msg.imageUrl
    );
  
    if (isDuplicate) {
      if (!confirm("This looks like a duplicate food log. Do you want to submit it again?")) {
        return;
      }
    }
  
    setError(null);
    setLoadingState({ type: 'sending' });
  
    const userMessage: ChatMessage = {
      id: generateUniqueId(),
      role: MessageRole.USER,
      content: userInput,
      imageUrl,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
  
    try {
      if (!chatSessionRef.current) {
        throw new Error("Chat session not initialized.");
      }
      const stream = await chatSessionRef.current.sendMessageStream({ message: userInput });
  
      let modelResponse = '';
      setMessages(prev => [...prev, { id: generateUniqueId(), role: MessageRole.MODEL, content: '', timestamp: new Date().toISOString() }]);
  
      for await (const chunk of stream) {
        modelResponse += chunk.text;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            content: modelResponse,
          };
          return newMessages;
        });
      }
  
      const { nutritionData, remainingText } = parseNutritionResponse(modelResponse);
  
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        newMessages[newMessages.length - 1] = {
          ...lastMessage,
          content: remainingText,
          nutritionData,
        };
        return newMessages;
      });
  
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(`Failed to get response: ${errorMessage}`);
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id).slice(0, -1));
      console.error(e);
    } finally {
      setLoadingState({ type: 'idle' });
    }
  }, [messages]);
  
  const handleImageForAnalysis = async (file: File) => {
    if (loadingState.type !== 'idle') return;
    setLoadingState({ type: 'sending' });
    setError(null);

    const imageUrl = URL.createObjectURL(file);
    const userMessage: ChatMessage = {
        id: generateUniqueId(),
        role: MessageRole.USER,
        content: "Analyzing image...",
        imageUrl,
        timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const imagePart = await fileToGenerativePart(file);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: "Describe the food items in this image for a nutrition log. Be descriptive and concise." },
                    imagePart,
                ],
            },
        });

        const foodDescription = response.text;

        setMessages(prev => prev.map(msg => msg.id === userMessage.id ? { ...msg, content: foodDescription } : msg));

        await handleSendMessage(foodDescription);

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(`Image analysis failed: ${errorMessage}`);
        setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
        // Fix: Cleanup blob URL on error
        URL.revokeObjectURL(imageUrl);
        console.error(e);
    } finally {
        setLoadingState({ type: 'idle' });
    }
  };

  const handleImageForVideo = (file: File) => {
    setSelectedImageForVideo(file);
    setShowVideoGenerator(true);
  };
  
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!newContent.trim()) return;

    setError(null);
    setLoadingState({ type: 'editing', id: messageId });
    setEditingMessageId(null);

    // Fix: Capture original state BEFORE modifications
    const originalMessages = [...messages];

    const userMessageIndex = messages.findIndex(msg => msg.id === messageId);
    if (userMessageIndex === -1) {
        setLoadingState({ type: 'idle' });
        setError("Could not find the message to edit.");
        return;
    }
    const modelMessageIndex = userMessageIndex + 1;

    const updatedMessages = [...messages];
    updatedMessages[userMessageIndex] = { ...updatedMessages[userMessageIndex], content: newContent, timestamp: new Date().toISOString() };
    updatedMessages[modelMessageIndex] = { id: generateUniqueId(), role: MessageRole.MODEL, content: '', timestamp: new Date().toISOString() };

    setMessages(updatedMessages);

    try {
        if (!chatSessionRef.current) {
            throw new Error("Chat session not initialized.");
        }
        const stream = await chatSessionRef.current.sendMessageStream({ message: newContent });

        let modelResponse = '';
        for await (const chunk of stream) {
            modelResponse += chunk.text;
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[modelMessageIndex] = {
                    ...newMessages[modelMessageIndex],
                    content: modelResponse,
                };
                return newMessages;
            });
        }

        const { nutritionData, remainingText } = parseNutritionResponse(modelResponse);
        setMessages(prev => {
            const newMessages = [...prev];
            newMessages[modelMessageIndex] = {
                ...newMessages[modelMessageIndex],
                content: remainingText,
                nutritionData,
            };
            return newMessages;
        });

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(`Failed to get response: ${errorMessage}`);
        // Fix: Use captured original state instead of stale closure
        setMessages(originalMessages);
        console.error(e);
    } finally {
        setLoadingState({ type: 'idle' });
    }
}, [messages]);


  const handleSaveMeal = useCallback((mealContent: string) => {
    const defaultName = mealContent.length > 25 ? `${mealContent.substring(0, 25)}...` : mealContent;
    const mealName = prompt("Enter a name for this meal:", defaultName);
    if (mealName) {
        const newMeal: SavedMeal = { name: mealName.trim(), content: mealContent };
        if (savedMeals.some(meal => meal.name.toLowerCase() === newMeal.name.toLowerCase())) {
            if (!confirm(`A meal named "${newMeal.name}" already exists. Overwrite it?`)) {
                return;
            }
            setSavedMeals(prev => prev.map(meal => meal.name.toLowerCase() === newMeal.name.toLowerCase() ? newMeal : meal));
        } else {
            setSavedMeals(prev => [...prev, newMeal]);
        }
    }
  }, [savedMeals]);

  const handleDeleteSavedMeal = useCallback((mealName: string) => {
    if (confirm(`Are you sure you want to delete the meal "${mealName}"?`)) {
        setSavedMeals(prev => prev.filter(meal => meal.name !== mealName));
    }
  }, []);

  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const groupedMessages = useMemo(() => {
    if (messages.length === 0) return [];
    
    const groups: { [date: string]: ChatMessage[] } = {};

    messages.forEach(msg => {
        if (!msg.timestamp) return;
        const dateKey = new Date(msg.timestamp).toDateString();
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(msg);
    });

    return Object.keys(groups)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .map(date => ({
            date,
            messagesForDay: groups[date],
        }));
  }, [messages]);


  return (
    <div className="flex flex-col h-screen bg-transparent text-white font-sans">
      <header className="bg-black/30 backdrop-blur-lg p-4 flex items-center justify-between gap-3 sticky top-0 z-20 border-b border-white/10">
        <div className="flex items-center gap-3">
            <h1 className="text-xl font-medium text-zinc-200">SukeshFIT</h1>
        </div>
        <button
            onClick={() => setIsSummaryOpen(true)}
            className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="Show daily summary"
        >
            <ChartBarIcon className="w-6 h-6"/>
        </button>
      </header>

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="bg-yellow-500/20 text-yellow-300 px-4 py-2 text-center text-sm border-b border-yellow-500/30">
          <span className="font-semibold">⚠️ You are offline</span>
          <span className="ml-2">Some features may not work properly</span>
        </div>
      )}

      <div className="flex-1 flex flex-col w-full">
        <main className="flex-1 overflow-y-auto px-4 md:px-6">
            <div className="max-w-4xl mx-auto w-full h-full">
              {messages.length === 0 ? (
                <Greeting onSuggestionClick={handleSendMessage} />
              ) : (
                <>
                {groupedMessages.map(({ date, messagesForDay }) => (
                    <div key={date} className="my-4">
                        <div className="flex justify-center my-4">
                            <span className="bg-zinc-800 text-xs font-semibold px-3 py-1 rounded-full text-zinc-400">{getRelativeDate(date)}</span>
                        </div>
                        
                        {messagesForDay.map((msg) => {
                            const globalIndex = messages.findIndex(m => m.id === msg.id);
                            const nextMessage = messages[globalIndex + 1];
                            const isMealLog = msg.role === MessageRole.USER && nextMessage?.role === MessageRole.MODEL && !!nextMessage.nutritionData;
                            
                            const isAnalyzedModelMessage = msg.role === MessageRole.MODEL && msg.nutritionData && msg.nutritionData.length > 0;
                            const isUser = msg.role === MessageRole.USER;
                            const isSomethingLoading = loadingState.type !== 'idle';
                            const isThisMessageBeingEditedAndSaved = loadingState.type === 'editing' && loadingState.id === msg.id;

                            return (
                                <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    <ChatMessageBubble 
                                    message={msg}
                                    isMealLog={isMealLog}
                                    onSaveMeal={handleSaveMeal}
                                    isEditing={editingMessageId === msg.id}
                                    onStartEdit={setEditingMessageId}
                                    onCancelEdit={() => setEditingMessageId(null)}
                                    onEditMessage={handleEditMessage}
                                    isProcessing={isSomethingLoading}
                                    isCurrentlySavingEdit={isThisMessageBeingEditedAndSaved}
                                    isAnalyzedModelMessage={isAnalyzedModelMessage}
                                    messagesForSummary={messagesForDay}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ))}
                </>
              )}
                {error && (
                    <div className="bg-red-500/20 text-red-300 p-3 rounded-lg max-w-4xl mx-auto w-full text-center">
                        <p><strong>Error:</strong> {error}</p>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        </main>
    
        <footer className="w-full px-4 pb-4 sticky bottom-0 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/90 to-transparent">
             <div className="max-w-4xl mx-auto w-full">
                <ChatInput 
                  onSendMessage={handleSendMessage} 
                  isSending={loadingState.type === 'sending'}
                  isSubmitting={loadingState.type !== 'idle'}
                  savedMeals={savedMeals}
                  onDeleteSavedMeal={handleDeleteSavedMeal}
                  onImageForAnalysis={handleImageForAnalysis}
                  onImageForVideo={handleImageForVideo}
                />
             </div>
        </footer>
      </div>
      <DailySummaryView 
        messages={messages} 
        isOpen={isSummaryOpen} 
        onClose={() => setIsSummaryOpen(false)} 
      />
      {showVideoGenerator && selectedImageForVideo && (
        <VideoGenerator
          isOpen={showVideoGenerator}
          onClose={() => {
            setShowVideoGenerator(false);
            setSelectedImageForVideo(null);
          }}
          imageFile={selectedImageForVideo}
        />
      )}
    </div>
  );
};

export default App;