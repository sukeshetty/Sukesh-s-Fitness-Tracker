import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ChatMessage, MessageRole } from '../types';
import { UserIcon, BotIcon, BookmarkIcon } from './Icons';
import NutritionCard from './NutritionCard';
import TotalNutritionCard from './TotalNutritionCard';

interface ChatMessageProps {
  message: ChatMessage;
  isMealLog: boolean;
  onSaveMeal: (content: string) => void;
}

const formatTimestamp = (isoString: string) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const ChatMessageBubble: React.FC<ChatMessageProps> = ({ message, isMealLog, onSaveMeal }) => {
  const isUser = message.role === MessageRole.USER;

  // We only parse the content part for markdown
  const rawMarkup = marked.parse(message.content);
  const sanitizedMarkup = DOMPurify.sanitize(rawMarkup as string);

  const isLoading = message.role === MessageRole.MODEL && !message.content && !message.nutritionData;

  return (
    <div className={`group flex items-start gap-4 my-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
          <BotIcon className="w-6 h-6 text-cyan-400" />
        </div>
      )}
      <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`max-w-2xl px-5 py-3 rounded-2xl shadow-md ${
              isUser
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'bg-slate-700 text-slate-200 rounded-bl-none'
            }`}
          >
            {!isUser && message.nutritionData && message.nutritionData.length > 0 && (
              <div className="mb-3 border-b border-slate-600 pb-3">
                <TotalNutritionCard data={message.nutritionData} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {message.nutritionData.map((item, index) => (
                    <NutritionCard key={index} data={item} />
                    ))}
                </div>
              </div>
            )}
            
            {message.content && (
                <div
                className="prose prose-invert prose-p:my-2 prose-headings:my-3 max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizedMarkup }}
                />
            )}
            
            {isLoading && (
                <div className="flex items-center justify-center space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                </div>
            )}
          </div>
          {message.timestamp && (
            <p className="text-xs text-slate-500 mt-1 px-2">
              {formatTimestamp(message.timestamp)}
            </p>
          )}
        </div>
        {isUser && isMealLog && (
            <button
              onClick={() => onSaveMeal(message.content)}
              className="self-center mb-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-cyan-300 transition-all duration-200 p-1"
              title="Save meal"
              aria-label="Save meal"
            >
              <BookmarkIcon className="w-5 h-5" />
            </button>
          )}
      </div>

       {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
          <UserIcon className="w-6 h-6 text-slate-400" />
        </div>
      )}
    </div>
  );
};

export default ChatMessageBubble;