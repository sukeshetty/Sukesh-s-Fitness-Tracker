
import React from 'react';
import { GeminiStarIcon } from './Icons';

interface SuggestionCardProps {
  title: string;
  description: string;
  onClick: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ title, description, onClick }) => (
  <button
    onClick={onClick}
    className="bg-white/5 backdrop-blur-lg p-4 rounded-xl w-full text-left hover:bg-white/10 transition-colors border border-white/10"
  >
    <p className="font-semibold text-zinc-200">{title}</p>
    <p className="text-sm text-zinc-400">{description}</p>
  </button>
);

interface GreetingProps {
  onSuggestionClick: (message: string) => void;
}

const Greeting: React.FC<GreetingProps> = ({ onSuggestionClick }) => {
  const suggestions = [
    {
      title: 'Log my breakfast',
      description: '2 eggs, a slice of whole wheat toast, and black coffee',
      prompt: 'For breakfast I had 2 eggs, a slice of whole wheat toast, and a black coffee'
    },
    {
      title: 'Analyze my lunch',
      description: 'A turkey sandwich with a side of potato chips',
      prompt: 'I ate a turkey sandwich and a bag of potato chips for lunch'
    },
    {
      title: 'Review my dessert',
      description: 'A slice of chocolate cake with a scoop of vanilla ice cream',
      prompt: 'I had a slice of chocolate cake and vanilla ice cream for dessert.'
    },
    {
      title: 'What about this snack?',
      description: 'A handful of almonds and an apple',
      prompt: 'My afternoon snack was a handful of almonds and an apple'
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full w-full pb-20">
      <div className="text-center">
        <h1 className="text-5xl md:text-6xl font-medium bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text mb-4">
          Hello, there.
        </h1>
        <p className="text-zinc-400 text-xl">How can I help you today?</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full max-w-2xl">
        {suggestions.map((s, i) => (
          <SuggestionCard 
            key={i} 
            title={s.title} 
            description={s.description} 
            onClick={() => onSuggestionClick(s.prompt)} 
          />
        ))}
      </div>
    </div>
  );
};

export default Greeting;