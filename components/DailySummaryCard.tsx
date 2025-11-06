import React, { useMemo, useState, useEffect } from 'react';
import { ChatMessage, MessageRole, DailyTargets } from '../types';
import { GoogleGenAI } from '@google/genai';
import AnimatedNumber from './AnimatedNumber';
import { useTheme } from './contexts/ThemeContext';
import Spinner from './Spinner';

interface DailySummaryCardProps {
  messages: ChatMessage[];
  dailyTargets?: DailyTargets;
}

const Stat: React.FC<{ label: string; value: number; target: number; suffix?: string }> = ({ label, value, target, suffix = '' }) => {
    const isOver = value > target;
    return (
        <div className="text-center bg-black/20 p-3 rounded-lg">
            <p className="text-xs font-medium text-white/70 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold text-white`}>
                <AnimatedNumber value={value} duration={600} />
                <span className="text-sm font-normal text-white/60"> / {target}{suffix}</span>
            </p>
             {isOver && <p className="text-xs text-red-400 font-semibold mt-1">Over Target</p>}
        </div>
    );
};

const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ messages, dailyTargets }) => {
  const { theme } = useTheme();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState<boolean>(true);

  const dailyTotals = useMemo(() => {
    let caloriesIn = 0, protein = 0, fat = 0, caloriesOut = 0;
    const today = new Date(messages[messages.length-1].timestamp).toISOString().split('T')[0];
    
    messages.forEach((msg) => {
      if (msg.role === MessageRole.MODEL && msg.timestamp.startsWith(today)) {
        if (msg.nutritionData) {
          msg.nutritionData.forEach((item) => {
            caloriesIn += item.calories;
            protein += item.protein;
            fat += item.fat;
          });
        }
        if (msg.activityData) {
          msg.activityData.forEach((item) => {
            caloriesOut += item.caloriesBurned;
          });
        }
      }
    });
    return {
      caloriesIn: Math.round(caloriesIn),
      protein: Math.round(protein),
      fat: Math.round(fat),
      caloriesOut: Math.round(caloriesOut),
    };
  }, [messages]);
  
  const lastMessage = messages[messages.length - 1];
  const netCalories = dailyTotals.caloriesIn - dailyTotals.caloriesOut;
  
  useEffect(() => {
    const generateImage = async () => {
      if (!dailyTargets) return;
      setLoadingImage(true);

      const calorieStatus = netCalories <= dailyTargets.calories ? 'within' : 'over';
      const proteinStatus = dailyTotals.protein >= dailyTargets.protein * 0.9 ? 'good' : 'low';
      
      let prompt = 'A visually striking, artistic, abstract representation of a day of eating. ';
      if (calorieStatus === 'within' && proteinStatus === 'good') {
        prompt += 'Theme of balance, energy, and health. Vibrant colors like green and orange, clean lines, a feeling of success and wellness. Epic, beautiful, healthy food art.';
      } else if (calorieStatus === 'over') {
        prompt += 'Theme of excess and indulgence. Moody lighting, overflowing composition, rich but heavy textures using deep reds and purples. A sense of being over the limit. Abstract art.';
      } else {
        prompt += 'Theme of potential and progress. Some empty spaces, some vibrant spots. A journey not yet complete. Hopeful and motivational art with blues and yellows.';
      }
      prompt += ' Cinematic lighting, hyperrealistic, 8k, photorealistic.';

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '16:9' },
        });
        
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        const url = `data:image/jpeg;base64,${base64ImageBytes}`;
        setImageUrl(url);
      } catch (error) {
        console.error("Imagen generation failed:", error);
      } finally {
        setLoadingImage(false);
      }
    };

    if (dailyTargets && (dailyTotals.caloriesIn > 0 || dailyTotals.caloriesOut > 0)) {
        generateImage();
    }
  }, [dailyTotals.caloriesIn, dailyTotals.protein, dailyTotals.caloriesOut, dailyTargets]);

  if ((dailyTotals.caloriesIn === 0 && dailyTotals.caloriesOut === 0) || !dailyTargets) return null;

  return (
    <div
      className={`relative w-full aspect-[16/9] rounded-xl overflow-hidden ring-1 ring-white/10 shadow-lg bg-zinc-900 flex items-center justify-center text-white`}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      {loadingImage && <Spinner />}
      {imageUrl && <img src={imageUrl} alt="AI generated daily summary art" className="absolute w-full h-full object-cover animate-slideUp" />}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
      
      <div className="relative z-10 p-6 w-full animate-slideUp">
        <h3 className="font-bold text-2xl mb-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Today's Snapshot</h3>
        <p className="text-sm text-white/80 mb-4" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
          As of {new Date(lastMessage.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Net Calories" value={netCalories} target={dailyTargets.calories} />
            <Stat label="Protein" value={dailyTotals.protein} target={dailyTargets.protein} suffix="g" />
            <Stat label="Fat" value={dailyTotals.fat} target={dailyTargets.fat} suffix="g" />
        </div>
      </div>
    </div>
  );
};

export default DailySummaryCard;
