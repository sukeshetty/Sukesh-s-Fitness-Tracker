import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData } from '../utils/audio';
import { SpeakerIcon, PlayIcon, StopIcon } from './Icons';
import Spinner from './Spinner';

interface TTSButtonProps {
  textToSpeak: string;
}

const TTSButton: React.FC<TTSButtonProps> = ({ textToSpeak }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setStatus('idle');
  }, []);

  const handlePlay = async () => {
    if (status === 'playing') {
      stopPlayback();
      return;
    }
    
    setStatus('loading');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('No audio data received.');
      }

      // FIX: Cast window to `any` to allow access to `webkitAudioContext` for older browsers.
      audioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        stopPlayback();
      };
      source.start();

      sourceRef.current = source;
      setStatus('playing');

    } catch (error) {
      console.error('TTS failed:', error);
      setStatus('idle');
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Spinner />;
      case 'playing':
        return <StopIcon className="w-4 h-4" />;
      default:
        return <PlayIcon className="w-4 h-4" />;
    }
  };
  
  const getTitle = () => {
    switch (status) {
        case 'playing':
            return 'Stop audio';
        default:
            return 'Play audio';
    }
  }

  return (
    <button
      onClick={handlePlay}
      disabled={status === 'loading'}
      title={getTitle()}
      aria-label={getTitle()}
      className="p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 transition-colors disabled:opacity-50"
    >
      {getIcon()}
    </button>
  );
};

export default TTSButton;
