import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { CloseIcon } from './Icons';
import Spinner from './Spinner';

interface VideoGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
};

type AspectRatio = '16:9' | '9:16';
type Status = 'idle' | 'checking_key' | 'needs_key' | 'generating' | 'done' | 'error';

const loadingMessages = [
    "Warming up the pixels...",
    "Choreographing the digital dance...",
    "Teaching electrons new tricks...",
    "Reticulating splines...",
    "This can take a few minutes, hang tight!",
    "The creative robots are hard at work...",
];

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ isOpen, onClose, imageFile }) => {
  const [status, setStatus] = useState<Status>('checking_key');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);

  const imageUrl = React.useMemo(() => URL.createObjectURL(imageFile), [imageFile]);

  const checkApiKey = useCallback(async () => {
    setStatus('checking_key');
    if (await window.aistudio.hasSelectedApiKey()) {
        setStatus('idle');
    } else {
        setStatus('needs_key');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
        checkApiKey();
    } else {
        // Reset state on close
        setStatus('checking_key');
        setPrompt('');
        setAspectRatio('16:9');
        setVideoUrl(null);
        setError(null);
    }
  }, [isOpen, checkApiKey]);

  useEffect(() => {
    // FIX: Use `number` type for setInterval handle in browser environments.
    let interval: number;
    if (status === 'generating') {
      interval = window.setInterval(() => {
        setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [status]);


  const handleGenerate = async () => {
    if (!prompt.trim()) {
        setError("Please enter a prompt for the video.");
        return;
    }
    setError(null);
    setStatus('generating');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const imageBytes = await fileToBase64(imageFile);
        
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            image: { imageBytes, mimeType: imageFile.type },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio,
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            try {
                operation = await ai.operations.getVideosOperation({ operation: operation });
            } catch (e: any) {
                 if (e.message?.includes("Requested entity was not found")) {
                    console.error("API Key error during polling. Resetting.");
                    setError("Your API Key seems to be invalid. Please select a valid key and try again.");
                    setStatus('needs_key');
                    return;
                }
                throw e; // Re-throw other errors
            }
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
            const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            const videoBlob = await response.blob();
            setVideoUrl(URL.createObjectURL(videoBlob));
            setStatus('done');
        } else {
            throw new Error("Video generation completed, but no download link was found.");
        }

    } catch (e: any) {
        console.error(e);
        const errorMessage = e.message?.includes("API key not valid") || e.message?.includes("entity was not found")
            ? "Your API Key seems to be invalid. Please select a valid key and try again."
            : `An error occurred: ${e.message}`;
        setError(errorMessage);
        if (errorMessage.includes("API Key")) {
            setStatus('needs_key');
        } else {
            setStatus('error');
        }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-black/50 backdrop-blur-xl rounded-2xl ring-1 ring-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-xl font-bold text-zinc-100">Create Video from Image</h2>
                <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100" aria-label="Close">
                    <CloseIcon className="w-6 h-6" />
                </button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                    <img src={imageUrl} alt="Selected for video generation" className="w-full rounded-lg object-contain max-h-80" />
                    <h3 className="font-semibold text-zinc-200">Video Configuration</h3>
                    <div>
                        <label htmlFor="prompt" className="block text-sm font-medium text-zinc-300 mb-1">Prompt</label>
                        <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full bg-zinc-800/80 border-zinc-600 focus:ring-blue-500 focus:border-blue-500 rounded-md p-2 text-white placeholder-zinc-400 resize-none" placeholder="e.g., A cinematic shot of this object on a beach at sunset." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Aspect Ratio</label>
                        <div className="flex gap-2">
                            {(['16:9', '9:16'] as AspectRatio[]).map(ratio => (
                                <button key={ratio} onClick={() => setAspectRatio(ratio)} className={`px-4 py-2 text-sm rounded-md transition-colors ${aspectRatio === ratio ? 'bg-blue-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'}`}>
                                    {ratio} {ratio === '16:9' ? '(Landscape)' : '(Portrait)'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center bg-zinc-900/50 rounded-lg p-4">
                    {status === 'generating' && (
                        <div className="text-center">
                            <Spinner />
                            <p className="mt-4 font-semibold text-zinc-200">Generating video...</p>
                            <p className="text-sm text-zinc-400 mt-2">{loadingMessage}</p>
                        </div>
                    )}
                    {status === 'done' && videoUrl && (
                        <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain rounded-md" />
                    )}
                    {(status === 'idle' || status === 'error' || status === 'needs_key') && (
                        <div className="text-center w-full">
                           <h3 className="font-semibold text-zinc-200 mb-4">Ready to Generate</h3>
                           <p className="text-sm text-zinc-400 mb-6">Enter a prompt, choose an aspect ratio, and start creating your video.</p>
                            {status === 'needs_key' && (
                                <div className="bg-yellow-500/10 text-yellow-300 p-3 rounded-md mb-4 text-sm">
                                    <p className="font-semibold">Action Required</p>
                                    <p>Video generation requires an API key. Please select one to continue.</p>
                                    <p className="mt-2 text-xs">For more information, see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">billing documentation</a>.</p>
                                    <button onClick={checkApiKey} className="mt-3 w-full bg-yellow-400 text-black font-bold py-2 px-4 rounded-md hover:bg-yellow-300 text-sm">Select API Key</button>
                                </div>
                            )}
                            <button onClick={handleGenerate} disabled={status !== 'idle'} className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 disabled:bg-zinc-600 disabled:cursor-not-allowed">
                                Generate Video
                            </button>
                            {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default VideoGenerator;
