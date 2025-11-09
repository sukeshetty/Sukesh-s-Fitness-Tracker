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
    <div className={`flex w-full my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`group flex items-start gap-3 ${isUser ? 'max-w-[80%] flex-row-reverse' : 'max-w-[85%]'}`}>
        {/* Avatar - only for AI messages in new design */}
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center self-start mt-1">
            <GeminiStarIcon className="w-5 h-5" />
          </div>
        )}

        <div className={`flex-1 flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2 min-w-0`}>
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
                      <div className="w-full max-w-xs rounded-xl overflow-hidden ring-1 ring-white/20">
                          <img src={message.imageUrl} alt="User upload" className="w-full h-auto object-cover"/>
                      </div>
                  )}

                  {message.content && (
                      <div
                        className={`relative px-4 py-3 rounded-2xl ${
                          isUser
                            ? 'bg-gradient-to-br from-[#7F00FF] to-[#E100FF] text-white rounded-br-sm'
                            : 'bg-white/10 backdrop-blur-md border border-white/10 text-gray-200 rounded-bl-sm'
                        }`}
                      >
                        <div className="flex items-start gap-2 w-full">
                          <div
                              className={`prose prose-invert prose-p:my-1 prose-headings:my-2 max-w-none prose-p:text-inherit prose-strong:text-inherit ${isUser ? '[&_p]:text-right w-full' : 'prose-p:text-left flex-1'}`}
                              dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
                          />
                          {!isUser && <TTSButton textToSpeak={message.content} />}
                        </div>
                        <span className="text-[10px] opacity-60 mt-1 block">
                          {new Date(message.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                  )}

                  {!isUser && message.nutritionData && message.nutritionData.length > 0 && (
                      <div className="w-full space-y-3">
                          <TotalNutritionCard data={message.nutritionData} timestamp={message.timestamp} />
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {message.nutritionData.map((item, index) => (
                              <NutritionCard key={index} data={item} />
                              ))}
                          </div>
                      </div>
                  )}

                  {!isUser && message.activityData && message.activityData.length > 0 && (
                      <div className="w-full">
                          <TotalActivityCard data={message.activityData} timestamp={message.timestamp} />
                      </div>
                  )}

                  {isAnalyzedLogMessage && (
                      <div className="w-full">
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
              <div className="flex self-start mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                   <button
                      onClick={() => onStartEdit(message.id)}
                      className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Edit meal"
                      aria-label="Edit meal"
                      disabled={isProcessing}
                      >
                      <EditIcon className="w-4 h-4" />
                  </button>
              </div>
            )}
      </div>
    </div>
  );
};

export default React.memo(ChatMessageBubble);