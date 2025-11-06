import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ChatMessage, MessageRole, DailyTargets } from '../types';
import { UserIcon, GeminiStarIcon, EditIcon } from './Icons';
import NutritionCard from './NutritionCard';
import TotalNutritionCard from './TotalNutritionCard';
import Spinner from './Spinner';
import DailySummaryCard from './DailySummaryCard';
import TTSButton from './TTSButton';
import TotalActivityCard from './TotalActivityCard';

interface ChatMessageProps {
  message: ChatMessage;
  isMealLog: boolean;
  isEditing: boolean;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  isProcessing: boolean; // Is any request in flight?
  isCurrentlySavingEdit: boolean; // Is this specific message's edit being saved?
  isAnalyzedLogMessage: boolean;
  messagesForSummary: ChatMessage[];
  dailyTargets?: DailyTargets;
}

const LoadingIndicator: React.FC = () => {
    const loadingTexts = ["Thinking...", "Analyzing your input...", "Assessing your details..."];
    const [text, setText] = useState(loadingTexts[0]);

    useEffect(() => {
        const interval = setInterval(() => {
            setText(currentText => {
                const currentIndex = loadingTexts.indexOf(currentText);
                const nextIndex = (currentIndex + 1) % loadingTexts.length;
                return loadingTexts[nextIndex];
            });
        }, 1800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center text-zinc-400">
            <span>{text}</span>
            <span className="inline-block w-2 h-5 bg-zinc-400 animate-pulse ml-2"></span>
        </div>
    );
};

const InlineEditForm: React.FC<{
    initialContent: string;
    onSave: (newContent: string) => void;
    onCancel: () => void;
    isProcessing: boolean;
}> = ({ initialContent, onSave, onCancel, isProcessing }) => {
    const [content, setContent] = useState(initialContent);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, []);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [content]);

    const handleSave = () => {
        if (content.trim()) {
            onSave(content);
        }
    };

    return (
        <div className="p-1 w-full">
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={1}
                className="w-full bg-zinc-800/80 border-zinc-600 focus:ring-blue-500 focus:border-blue-500 rounded-md p-2 text-white placeholder-zinc-300 resize-none max-h-60"
                disabled={isProcessing}
            />
            <div className="flex justify-end gap-2 mt-2">
                <button
                    onClick={onCancel}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 transition-colors text-zinc-200"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isProcessing || !content.trim()}
                    className="text-xs font-semibold px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-500 disabled:cursor-not-allowed transition-colors flex items-center text-white"
                >
                    {isProcessing ? <Spinner /> : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};


const ChatMessageBubble: React.FC<ChatMessageProps> = ({ message, isMealLog, isEditing, onStartEdit, onCancelEdit, onEditMessage, isProcessing, isCurrentlySavingEdit, isAnalyzedLogMessage, messagesForSummary, dailyTargets }) => {
  const isUser = message.role === MessageRole.USER;

  const rawMarkup = marked.parse(message.content, { breaks: true, gfm: true });
  const sanitizedMarkup = DOMPurify.sanitize(rawMarkup as string);

  const isLoading = message.role === MessageRole.MODEL && !message.content && !message.nutritionData && !message.activityData;
  
  useEffect(() => {
    // This is a blob URL from an image upload. We must revoke it when the component
    // is no longer in use to prevent a memory leak.
    const isBlobUrl = message.imageUrl && message.imageUrl.startsWith('blob:');
    if (isBlobUrl) {
      return () => {
        URL.revokeObjectURL(message.imageUrl!);
      };
    }
  }, [message.imageUrl]);

  return (
    <div className={`group flex items-start gap-4 my-6 w-full ${isUser ? 'max-w-2xl flex-row-reverse' : 'max-w-4xl'}`}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center self-start">
        {isUser ? <UserIcon className="w-5 h-5 text-zinc-400" /> : <GeminiStarIcon className="w-6 h-6" />}
      </div>
      
      <div className={`flex-1 flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1 min-w-0`}>
         <p className={`w-full font-semibold text-[var(--text-primary)] text-md ${isUser ? 'text-right' : 'text-left'}`}>{isUser ? 'You' : 'SukeshFIT'}</p>
        {isEditing ? (
             <InlineEditForm 
                initialContent={message.content}
                onSave={(newContent) => onEditMessage(message.id, newContent)}
                onCancel={onCancelEdit}
                isProcessing={isCurrentlySavingEdit}
             />
        ) : (
            <>
                {message.imageUrl && (
                    <div className="mt-2 mb-2 w-full max-w-xs rounded-lg overflow-hidden ring-1 ring-[var(--glass-border)]">
                        <img src={message.imageUrl} alt="User upload" className="w-full h-auto object-cover"/>
                    </div>
                )}
                {!isUser && message.nutritionData && message.nutritionData.length > 0 && (
                    <div className="w-full my-2">
                        <TotalNutritionCard data={message.nutritionData} timestamp={message.timestamp} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {message.nutritionData.map((item, index) => (
                            <NutritionCard key={index} data={item} />
                            ))}
                        </div>
                    </div>
                )}

                {!isUser && message.activityData && message.activityData.length > 0 && (
                    <div className="w-full my-2">
                        <TotalActivityCard data={message.activityData} timestamp={message.timestamp} />
                    </div>
                )}
                
                {message.content ? (
                    <div className="flex items-center gap-2 w-full">
                        <div
                            className={`prose prose-invert prose-p:my-2 prose-headings:my-3 max-w-none text-[var(--text-primary)] prose-p:text-[var(--text-primary)] prose-strong:text-[var(--text-primary)] ${isUser ? '[&_p]:text-right w-full' : 'prose-p:text-left'}`}
                            dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
                        />
                        {!isUser && <TTSButton textToSpeak={message.content} />}
                    </div>
                ) : null}

                {isAnalyzedLogMessage && (
                    <div className="w-full mt-4">
                        <DailySummaryCard 
                          messages={messagesForSummary.filter(m => new Date(m.timestamp) <= new Date(message.timestamp))}
                          dailyTargets={dailyTargets}
                        />
                    </div>
                )}

                {isLoading && <LoadingIndicator />}
            </>
        )}
      </div>

       {isUser && isMealLog && !isEditing && (
            <div className="flex self-center mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 gap-1">
                 <button
                    onClick={() => onStartEdit(message.id)}
                    className="text-zinc-400 hover:text-zinc-100 p-2 rounded-full hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Edit meal"
                    aria-label="Edit meal"
                    disabled={isProcessing}
                    >
                    <EditIcon className="w-4 h-4" />
                </button>
            </div>
          )}
    </div>
  );
};

export default React.memo(ChatMessageBubble);