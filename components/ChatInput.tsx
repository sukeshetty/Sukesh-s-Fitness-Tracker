import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, PaperclipIcon, CalendarIcon } from './Icons';
import Spinner from './Spinner';
import { triggerHapticFeedback } from '../utils/audio';
import { useTheme } from './contexts/ThemeContext';

interface ChatInputProps {
  onSendMessage: (message: string, date: string) => void;
  isSending: boolean;
  isSubmitting: boolean;
  onImageForAnalysis: (file: File, date: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isSending, isSubmitting, onImageForAnalysis }) => {
  const [input, setInput] = useState('');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const { theme } = useTheme();
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analysisFileRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      triggerHapticFeedback();
      onSendMessage(input, logDate);
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
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        triggerHapticFeedback();
        onImageForAnalysis(e.target.files[0], logDate);
    }
    if(e.target) e.target.value = ''; // Reset file input
  }

  // Handle clicks outside the date picker to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const toggleButton = (event.target as HTMLElement).closest('.date-picker-toggle');
        if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node) && !toggleButton) {
            setIsDatePickerOpen(false);
        }
    };
    if (isDatePickerOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDatePickerOpen]);
  
  const getRelativeDateString = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleDateSelect = (date: string) => {
      setLogDate(date);
      setIsDatePickerOpen(false);
      triggerHapticFeedback(10);
  };
  
  const getYesterdayISO = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  const hasContent = input.trim().length > 0;
  const isLight = theme === 'light';

  const dateInputClasses = isLight 
    ? 'bg-rose-100 border-rose-200 text-rose-900' 
    : 'bg-zinc-800/80 border-zinc-600 text-white';
  const quickDateButtonClasses = isLight
    ? 'bg-rose-100 hover:bg-rose-200 text-rose-800'
    : 'bg-white/5 hover:bg-white/10 text-[var(--text-primary)]';
  
  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className={`
          flex items-end bg-[var(--glass-bg)] backdrop-blur-xl
          rounded-3xl shadow-lg border border-[var(--glass-border)]
          transition-all duration-300 ease-in-out
          ${isFocused ? 'ring-2 ring-blue-500/50' : ''}
        `}
      >
        <div className="flex items-center pl-2">
            <input type="file" accept="image/*" ref={analysisFileRef} onChange={handleFileChange} className="hidden" />
            <button
              type="button"
              onClick={() => { analysisFileRef.current?.click(); triggerHapticFeedback(15); }}
              className="text-[var(--icon-color)] hover:text-[var(--text-primary)] p-3 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Upload photo for analysis"
            >
              <PaperclipIcon className="w-5 h-5" />
            </button>
            <div className="relative">
                 {isDatePickerOpen && (
                    <div ref={datePickerRef} className="absolute bottom-full mb-2 w-64 bg-[var(--component-bg)] backdrop-blur-xl rounded-xl ring-1 ring-[var(--glass-border)] shadow-lg p-3 animate-slideUp z-10">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button type="button" onClick={() => handleDateSelect(new Date().toISOString().split('T')[0])} className={`text-sm w-full text-center py-2 rounded-lg transition-colors ${quickDateButtonClasses}`}>Today</button>
                            <button type="button" onClick={() => handleDateSelect(getYesterdayISO())} className={`text-sm w-full text-center py-2 rounded-lg transition-colors ${quickDateButtonClasses}`}>Yesterday</button>
                        </div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1 px-1">Select another date</label>
                        <input
                            type="date"
                            value={logDate}
                            onChange={(e) => handleDateSelect(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className={`w-full rounded-lg p-2 text-sm border ${dateInputClasses}`}
                            aria-label="Select log date"
                        />
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => { setIsDatePickerOpen(prev => !prev); triggerHapticFeedback(15); }}
                    className="date-picker-toggle text-[var(--icon-color)] hover:text-[var(--text-primary)] p-3 rounded-full hover:bg-white/10 transition-colors flex items-center gap-1.5"
                    aria-label="Select log date"
                >
                    <CalendarIcon className="w-5 h-5" />
                    <span className="text-xs font-medium">{getRelativeDateString(logDate)}</span>
                </button>
            </div>
        </div>
        
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Enter a food log or activity..."
          rows={1}
          className="flex-1 bg-transparent border-none focus:ring-0 resize-none placeholder-[var(--text-secondary)] text-[var(--text-primary)] py-3.5 max-h-48 overflow-y-auto"
          disabled={isSubmitting}
        />
        
        <div className={`p-2 transition-all duration-200 ${hasContent ? 'opacity-100' : 'opacity-0 -translate-x-2 pointer-events-none'}`}>
          <button
            type="submit"
            disabled={isSubmitting || !hasContent}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white font-bold w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
            aria-label="Send message"
          >
            {isSending ? <Spinner /> : <SendIcon className="w-5 h-5" />}
          </button>
        </div>
      </form>
       <p className="text-center text-xs text-[var(--text-secondary)] mt-2 px-4">
        SukeshFIT can make mistakes. Consider checking important information.
      </p>
    </div>
  );
};

export default ChatInput;