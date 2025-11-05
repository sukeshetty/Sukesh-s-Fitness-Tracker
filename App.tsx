import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { ChatMessage, MessageRole, Ingredient, SavedMeal } from './types';
import ChatInput from './components/ChatInput';
import ChatMessageBubble from './components/ChatMessage';
import DailySummaryView from './components/DailySummaryView';
import { BotIcon, ChartBarIcon } from './components/Icons';

const SYSTEM_INSTRUCTION = `You are a helpful and knowledgeable health coach. Your goal is to provide insightful nutritional feedback and encourage healthier choices in a supportive but witty manner.

When the user describes a meal, your response must begin with a JSON object with a nutritional breakdown. This JSON object must be inside a \`\`\`json code block. This JSON + conversational feedback format should be used whenever a meal is described, not just for the first message.

The JSON structure is an array of objects, each with keys: "ingredient", "calories", "protein", "fat", and "notes".

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
    "notes": "The fastest way to get a sugar rush and a subsequent nap."
  },
  {
    "ingredient": "Greek Yogurt",
    "calories": 100,
    "protein": 18,
    "fat": 0,
    "notes": "Excellent source of protein to keep you full."
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

const parseNutritionResponse = (text: string): { nutritionData?: Ingredient[]; remainingText: string } => {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = text.match(jsonRegex);

    if (match && match[1]) {
        try {
            const jsonData = JSON.parse(match[1]);
            const remainingText = text.replace(jsonRegex, '').trim();
            return { nutritionData: jsonData, remainingText };
        } catch (error) {
            console.error("Failed to parse nutrition JSON:", error);
            // If JSON is malformed, return the whole text as content
            return { nutritionData: undefined, remainingText: text };
        }
    }

    return { nutritionData: undefined, remainingText: text };
};


const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
        const saved = localStorage.getItem(SAVED_MEALS_KEY);
        if (saved) {
            setSavedMeals(JSON.parse(saved));
        }
    } catch (error) {
        console.error("Could not load saved meals:", error);
    }
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem(SAVED_MEALS_KEY, JSON.stringify(savedMeals));
    } catch (error) {
        console.error("Could not save meals:", error);
    }
  }, [savedMeals]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const initializeChat = () => {
      try {
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
        setMessages([
          {
            role: MessageRole.MODEL,
            content: "Hello! Tell me what you ate, and I'll provide a nutritional overview. You can save frequent meals using the bookmark icon that appears on hover.",
            timestamp: new Date().toISOString(),
          },
        ]);
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

  const handleSendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);
    const userMessage: ChatMessage = { role: MessageRole.USER, content: userInput, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);

    try {
      if (!chatSessionRef.current) {
        throw new Error("Chat session not initialized.");
      }
      const stream = await chatSessionRef.current.sendMessageStream({ message: userInput });

      let modelResponse = '';
      setMessages(prev => [...prev, { role: MessageRole.MODEL, content: '', timestamp: new Date().toISOString() }]);

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
      setMessages(prev => prev.filter(msg => msg.content !== '')); // Remove the empty model message on error
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);
  
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

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white font-sans">
      <header className="bg-slate-800/50 backdrop-blur-sm p-4 border-b border-slate-700 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
            <BotIcon className="w-8 h-8 text-cyan-400"/>
            <h1 className="text-xl font-bold text-slate-100">Gemini Food Co-pilot</h1>
        </div>
        <button 
            onClick={() => setIsSummaryOpen(true)}
            className="p-2 text-slate-400 hover:text-cyan-300 transition-colors"
            aria-label="Show daily summary"
        >
            <ChartBarIcon className="w-6 h-6"/>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="max-w-4xl mx-auto w-full">
            {messages.map((msg, index) => {
              const nextMessage = messages[index + 1];
              const isMealLog = msg.role === MessageRole.USER && nextMessage?.role === MessageRole.MODEL && !!nextMessage.nutritionData;
              return (
                <ChatMessageBubble 
                  key={index} 
                  message={msg}
                  isMealLog={isMealLog}
                  onSaveMeal={handleSaveMeal}
                />
              );
            })}
            {error && (
                <div className="bg-red-500/20 text-red-300 p-3 rounded-lg max-w-4xl mx-auto w-full text-center">
                    <p><strong>Error:</strong> {error}</p>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-slate-800/50 backdrop-blur-sm p-2 border-t border-slate-700 sticky bottom-0">
         <div className="max-w-4xl mx-auto w-full">
            <ChatInput 
              onSendMessage={handleSendMessage} 
              isLoading={isLoading}
              savedMeals={savedMeals}
              onDeleteSavedMeal={handleDeleteSavedMeal}
            />
         </div>
      </footer>
      <DailySummaryView 
        messages={messages} 
        isOpen={isSummaryOpen} 
        onClose={() => setIsSummaryOpen(false)} 
      />
    </div>
  );
};

export default App;