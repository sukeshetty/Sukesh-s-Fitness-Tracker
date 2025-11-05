import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, PaperclipIcon } from './Icons';
import Spinner from './Spinner';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isSending: boolean;
  isSubmitting: boolean;
  onImageForAnalysis: (file: File) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isSending, isSubmitting, onImageForAnalysis }) => {
  const [input, setInput] = useState('');
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
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        onImageForAnalysis(e.target.files[0]);
    }
    e.target.value = ''; // Reset file input
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-end p-2 bg-[var(--glass-bg)] backdrop-blur-xl rounded-2xl shadow-lg border border-[var(--glass-border)]">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a food log or upload a photo..."
          rows={1}
          className="flex-1 bg-transparent border-none focus:ring-0 resize-none placeholder-[var(--text-secondary)] text-[var(--text-primary)] px-2 py-[11px] max-h-48 overflow-y-auto"
          disabled={isSubmitting}
        />
        <div className="flex items-end flex-shrink-0">
            <input type="file" accept="image/*" ref={analysisFileRef} onChange={handleFileChange} className="hidden" />
            
            <button type="button" onClick={() => analysisFileRef.current?.click()} className="text-zinc-300 hover:text-zinc-100 p-3 rounded-full hover:bg-white/10 transition-colors" aria-label="Upload photo for analysis" >
                <PaperclipIcon className="w-5 h-5" />
            </button>

            <button type="submit" disabled={isSubmitting || !input.trim()} className="bg-zinc-700/80 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-500 text-zinc-200 font-bold p-3 rounded-full transition-all duration-200 ml-1" aria-label="Send message" >
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