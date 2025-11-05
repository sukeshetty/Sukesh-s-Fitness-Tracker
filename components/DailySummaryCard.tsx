import React from 'react';
import { ChatMessage, MessageRole } from '../types';
import AnimatedNumber from './AnimatedNumber';

interface DailySummaryCardProps {
  messages: ChatMessage[];
}

const Stat: React.FC<{ label: string; value: React.ReactNode; suffix?: string }> = ({ label, value, suffix }) => (
    <div>
        <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-zinc-100">{value}{suffix}</p>
    </div>
);

const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ messages }) => {
    const getFormattedDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        let relativeDay = '';
        if (date.toDateString() === today.toDateString()) {
          relativeDay = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
          relativeDay = 'Yesterday';
        }

        const fullDate = date.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        return relativeDay ? `${relativeDay} · ${fullDate}` : fullDate;
    };

    const dailyTotals = messages.reduce(
        (acc, msg) => {
            if (msg.role === MessageRole.MODEL && msg.nutritionData) {
                msg.nutritionData.forEach(item => {
                    acc.calories += Number(item.calories) || 0;
                    acc.protein += Number(item.protein) || 0;
                    acc.fat += Number(item.fat) || 0;
                });
            }
            return acc;
        },
        { calories: 0, protein: 0, fat: 0 }
    );
    
    if (dailyTotals.calories === 0 && dailyTotals.protein === 0 && dailyTotals.fat === 0) {
        return null;
    }

    const lastMessage = messages[messages.length - 1];
    const dateString = lastMessage ? getFormattedDate(lastMessage.timestamp) : '';

    return (
        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-xl ring-1 ring-white/10 shadow-lg flex flex-col gap-4">
            <p className="text-xs text-center text-zinc-400 border-b border-zinc-700/50 pb-2">
                {dateString}
            </p>
            <h3 className="font-bold text-blue-400 text-lg text-center">
                Daily Totals
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
                <Stat label="Calories" value={<AnimatedNumber value={Math.round(dailyTotals.calories)} />} />
                <Stat label="Protein" value={<AnimatedNumber value={Math.round(dailyTotals.protein)} />} suffix="g" />
                <Stat label="Fat" value={<AnimatedNumber value={Math.round(dailyTotals.fat)} />} suffix="g" />
            </div>
        </div>
    );
};

export default DailySummaryCard;
