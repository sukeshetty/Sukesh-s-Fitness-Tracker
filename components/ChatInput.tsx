import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, BookmarkIcon, TrashIcon } from './Icons';
import Spinner from './Spinner';
import { SavedMeal } from '../types';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  savedMeals: SavedMeal[];
  onDeleteSavedMeal: (name: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, savedMeals, onDeleteSavedMeal }) => {
  const [input, setInput] = useState('');
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const savedMealsRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (savedMealsRef.current && !savedMealsRef.current.contains(event.target as Node)) {
        setShowSavedMeals(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={savedMealsRef}>
      {showSavedMeals && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 border border-slate-700 z-10">
            {savedMeals.length === 0 ? (
                <p className="text-slate-400 text-center p-4">No saved meals yet.</p>
            ) : (
                <ul className="divide-y divide-slate-700/50">
                    {savedMeals.map((meal) => (
                        <li key={meal.name} className="p-2 group flex justify-between items-center hover:bg-slate-700/50 rounded-md transition-colors">
                            <button
                                onClick={() => {
                                    setInput(meal.content);
                                    setShowSavedMeals(false);
                                }}
                                className="text-left flex-1"
                            >
                                <p className="font-semibold text-slate-100">{meal.name}</p>
                                <p className="text-sm text-slate-400 truncate pr-2">{meal.content}</p>

                            </button>
                            <button
                                onClick={() => onDeleteSavedMeal(meal.name)}
                                className="ml-4 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title={`Delete "${meal.name}"`}
                                aria-label={`Delete "${meal.name}"`}
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center p-2 bg-slate-700 rounded-xl shadow-inner gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., For breakfast I had two eggs and a slice of toast..."
          rows={1}
          className="flex-1 bg-transparent border-none focus:ring-0 resize-none placeholder-slate-400 text-slate-100 px-2 py-2 max-h-40"
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={() => setShowSavedMeals(s => !s)}
          className="text-slate-300 hover:text-cyan-400 p-3 rounded-lg transition-all duration-200"
          aria-label="Show saved meals"
        >
          <BookmarkIcon className="w-5 h-5" />
        </button>
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg transition-all duration-200"
          aria-label="Send message"
        >
          {isLoading ? <Spinner /> : <SendIcon className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
};

export default ChatInput;