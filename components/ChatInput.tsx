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
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        triggerHapticFeedback();
        onImageForAnalysis(e.target.files[0], logDate);
    }
    if(e.target) e.target.value = ''; // Reset file input
  }

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
    <div className="w-full">
      <div className="bg-white/5 backdrop-blur-2xl rounded-2xl p-2 border border-white/10 transition-all duration-300">
        {/* Icons Row - Top border */}
        <div className="flex items-center justify-between px-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            {/* Camera/Attachment Icon */}
            <input type="file" accept="image/*" ref={analysisFileRef} onChange={handleFileChange} className="hidden" />
            <button
              type="button"
              onClick={() => { analysisFileRef.current?.click(); triggerHapticFeedback(15); }}
              className="text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Upload photo for analysis"
              title="Upload food photo"
            >
              <PaperclipIcon className="w-5 h-5" />
            </button>

            {/* Date Picker Icon */}
            <div className="relative">
              {isDatePickerOpen && (
                <div ref={datePickerRef} className="absolute bottom-full mb-2 w-64 bg-zinc-900/95 backdrop-blur-xl rounded-xl ring-1 ring-white/20 shadow-lg p-3 animate-slideUp z-10">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button type="button" onClick={() => handleDateSelect(new Date().toISOString().split('T')[0])} className="text-sm w-full text-center py-2 rounded-lg transition-colors bg-white/5 hover:bg-white/10 text-white">Today</button>
                    <button type="button" onClick={() => handleDateSelect(getYesterdayISO())} className="text-sm w-full text-center py-2 rounded-lg transition-colors bg-white/5 hover:bg-white/10 text-white">Yesterday</button>
                  </div>
                  <label className="block text-xs text-white/60 mb-1 px-1">Select another date</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => handleDateSelect(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg p-2 text-sm border bg-zinc-800/80 border-zinc-600 text-white"
                    aria-label="Select log date"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => { setIsDatePickerOpen(prev => !prev); triggerHapticFeedback(15); }}
                className="date-picker-toggle text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5"
                aria-label="Select log date"
                title={`Logging for ${getRelativeDateString(logDate)}`}
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Date Display */}
          <span className="text-xs text-white/50">
            {getRelativeDateString(logDate)}
          </span>
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-x-2 pt-2"
        >
          {/* Textarea */}
          <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="What did you eat?"
              rows={1}
              className="flex-1 min-h-[44px] max-h-32 resize-none bg-transparent border-none focus:ring-0 text-white placeholder-white/50 p-2"
              disabled={isSubmitting}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={isSubmitting || !hasContent}
            className={`flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#7F00FF] to-[#E100FF] text-white transition-all duration-200 ${
              hasContent ? 'hover:scale-105 active:scale-95' : 'opacity-50 cursor-not-allowed'
            }`}
            aria-label="Send message"
          >
            {isSending ? <Spinner /> : <SendIcon className="w-5 h-5" />}
          </button>
        </form>
      </div>
      <p className="text-center text-xs text-white/40 mt-2 px-4">
        SukeshFIT can make mistakes. Consider checking important information.
      </p>
    </div>
  );
};

export default ChatInput;