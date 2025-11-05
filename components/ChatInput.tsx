import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, BookmarkIcon, TrashIcon, PaperclipIcon } from './Icons';
import Spinner from './Spinner';
import { SavedMeal } from '../types';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isSending: boolean;
  isSubmitting: boolean;
  savedMeals: SavedMeal[];
  onDeleteSavedMeal: (name: string) => void;
  onImageForAnalysis: (file: File) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isSending, isSubmitting, savedMeals, onDeleteSavedMeal, onImageForAnalysis }) => {
  const [input, setInput] = useState('');
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysisFileRef = useRef<HTMLInputElement>(null);

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
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const scrollHeight = textareaRef.current.scrollHeight;
        textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSavedMeals(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, handler: (file: File) => void) => {
    if (e.target.files && e.target.files[0]) {
        handler(e.target.files[0]);
    }
    e.target.value = ''; // Reset file input
  }

  return (
    <div className="relative" ref={containerRef}>
      {showSavedMeals && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-black/30 backdrop-blur-xl rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 border border-white/10 z-10">
            {savedMeals.length === 0 ? (
                <p className="text-zinc-400 text-center p-4">No saved meals yet.</p>
            ) : (
                <ul className="divide-y divide-zinc-700/50">
                    {savedMeals.map((meal) => (
                        <li key={meal.name} className="p-2 group flex justify-between items-center hover:bg-white/10 rounded-md transition-colors">
                            <button onClick={() => { setInput(meal.content); setShowSavedMeals(false); textareaRef.current?.focus(); }} className="text-left flex-1" >
                                <p className="font-semibold text-zinc-100">{meal.name}</p>
                                <p className="text-sm text-zinc-400 truncate pr-2">{meal.content}</p>
                            </button>
                            <button onClick={() => onDeleteSavedMeal(meal.name)} className="ml-4 p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title={`Delete "${meal.name}"`} aria-label={`Delete "${meal.name}"`} >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end p-2 bg-black/30 backdrop-blur-xl rounded-2xl shadow-lg border border-white/10">
        <button type="button" onClick={() => setShowSavedMeals(s => !s)} className="text-zinc-300 hover:text-zinc-100 p-3 rounded-full hover:bg-white/10 transition-colors flex-shrink-0" aria-label="Show saved meals" >
          <BookmarkIcon className="w-5 h-5" />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a food log or upload a photo..."
          rows={1}
          className="flex-1 bg-transparent border-none focus:ring-0 resize-none placeholder-zinc-400 text-zinc-100 px-2 py-[11px] max-h-48 overflow-y-auto"
          disabled={isSubmitting}
        />
        <div className="flex items-end flex-shrink-0">
            <input type="file" accept="image/*" ref={analysisFileRef} onChange={(e) => handleFileChange(e, onImageForAnalysis)} className="hidden" />
            
            <button type="button" onClick={() => analysisFileRef.current?.click()} className="text-zinc-300 hover:text-zinc-100 p-3 rounded-full hover:bg-white/10 transition-colors" aria-label="Upload photo for analysis" >
                <PaperclipIcon className="w-5 h-5" />
            </button>

            <button type="submit" disabled={isSubmitting || !input.trim()} className="bg-zinc-700/80 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-500 text-zinc-200 font-bold p-3 rounded-full transition-all duration-200 ml-1" aria-label="Send message" >
              {isSending ? <Spinner /> : <SendIcon className="w-5 h-5" />}
            </button>
        </div>
      </form>
       <p className="text-center text-xs text-zinc-500 mt-2 px-4">
        SukeshFIT can make mistakes. Consider checking important information.
      </p>
    </div>
  );
};

export default ChatInput;