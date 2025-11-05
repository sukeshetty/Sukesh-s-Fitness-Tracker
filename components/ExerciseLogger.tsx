import React, { useState, useEffect } from 'react';
import { Exercise, ExerciseLog } from '../types';
import { CloseIcon, FireIcon } from './Icons';
import Spinner from './Spinner';
import { GoogleGenAI } from '@google/genai';

interface ExerciseLoggerProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXERCISE_TYPES = [
  { name: 'Running', icon: '🏃', caloriesPerMin: 10 }, { name: 'Walking', icon: '🚶', caloriesPerMin: 4 },
  { name: 'Cycling', icon: '🚴', caloriesPerMin: 8 }, { name: 'Swimming', icon: '🏊', caloriesPerMin: 11 },
  { name: 'Gym/Weights', icon: '🏋️', caloriesPerMin: 6 }, { name: 'Yoga', icon: '🧘', caloriesPerMin: 3 },
  { name: 'Sports', icon: '⚽', caloriesPerMin: 7 }, { name: 'Dancing', icon: '💃', caloriesPerMin: 5 },
];

const ExerciseLogger: React.FC<ExerciseLoggerProps> = ({ isOpen, onClose }) => {
  const [selectedType, setSelectedType] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [todayExercises, setTodayExercises] = useState<Exercise[]>([]);
  const [estimatingCalories, setEstimatingCalories] = useState(false);

  useEffect(() => { if (isOpen) loadTodayExercises(); }, [isOpen]);

  const loadTodayExercises = () => {
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem('exercise-logs');
    if (saved) {
      const logs: ExerciseLog[] = JSON.parse(saved);
      const todayLog = logs.find(log => log.date === today);
      if (todayLog) setTodayExercises(todayLog.exercises);
    }
  };

  const estimateCalories = async (type: string, durationNum: number): Promise<number> => {
    const basicEstimate = (EXERCISE_TYPES.find(e => e.name === type)?.caloriesPerMin || 5) * durationNum;
    const profileData = localStorage.getItem('user-profile');
    if (!profileData) return basicEstimate;
    const profile = JSON.parse(profileData);
    
    setEstimatingCalories(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Calculate calories burned for this exercise:
        Exercise: ${type}, Duration: ${durationNum} minutes
        User: ${profile.age}yo, ${profile.gender}, ${profile.weight}kg
        Provide ONLY the number of calories burned (no units).`;
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
      const calories = parseInt(response.text.replace(/[^\d]/g, ''));
      return isNaN(calories) ? basicEstimate : calories;
    } catch (err) {
      return basicEstimate;
    } finally {
      setEstimatingCalories(false);
    }
  };

  const handleAddExercise = async () => {
    if (!selectedType || !duration) return;
    const durationNum = parseInt(duration);
    const caloriesBurned = await estimateCalories(selectedType, durationNum);
    const newExercise: Exercise = { id: Date.now().toString(), type: selectedType, duration: durationNum, caloriesBurned, notes, timestamp: new Date().toISOString() };
    
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem('exercise-logs');
    let logs: ExerciseLog[] = saved ? JSON.parse(saved) : [];
    const todayLogIndex = logs.findIndex(log => log.date === today);
    if (todayLogIndex >= 0) {
      logs[todayLogIndex].exercises.push(newExercise);
      logs[todayLogIndex].totalCaloriesBurned += caloriesBurned;
    } else {
      logs.push({ date: today, exercises: [newExercise], totalCaloriesBurned: caloriesBurned });
    }
    localStorage.setItem('exercise-logs', JSON.stringify(logs));
    setTodayExercises(prev => [...prev, newExercise]);
    setSelectedType(''); setDuration(''); setNotes('');
  };

  const handleDeleteExercise = (exerciseId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem('exercise-logs');
    if (!saved) return;
    let logs: ExerciseLog[] = JSON.parse(saved);
    const todayLogIndex = logs.findIndex(log => log.date === today);
    if (todayLogIndex >= 0) {
      const exerciseToRemove = logs[todayLogIndex].exercises.find(e => e.id === exerciseId);
      logs[todayLogIndex].exercises = logs[todayLogIndex].exercises.filter(e => e.id !== exerciseId);
      if (exerciseToRemove) logs[todayLogIndex].totalCaloriesBurned -= exerciseToRemove.caloriesBurned;
      if (logs[todayLogIndex].exercises.length === 0) logs = logs.filter((_, i) => i !== todayLogIndex);
      localStorage.setItem('exercise-logs', JSON.stringify(logs));
      setTodayExercises(prev => prev.filter(e => e.id !== exerciseId));
    }
  };

  const totalCaloriesToday = todayExercises.reduce((sum, e) => sum + e.caloriesBurned, 0);
  const totalDurationToday = todayExercises.reduce((sum, e) => sum + e.duration, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black/50 backdrop-blur-xl rounded-2xl ring-1 ring-white/10 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-white/10"><div className="flex items-center gap-3"><FireIcon className="w-6 h-6 text-orange-400" /><h2 className="text-xl font-bold text-zinc-100">Exercise Logger</h2></div><button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100"><CloseIcon className="w-6 h-6" /></button></header>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-xl p-5 ring-1 ring-orange-500/30"><h3 className="font-semibold text-orange-300 mb-3">Today's Activity</h3><div className="grid grid-cols-2 gap-4"><div className="text-center bg-white/5 rounded-lg p-3"><p className="text-3xl font-bold text-zinc-100">{totalCaloriesToday}</p><p className="text-xs text-zinc-400">Calories Burned</p></div><div className="text-center bg-white/5 rounded-lg p-3"><p className="text-3xl font-bold text-zinc-100">{totalDurationToday}</p><p className="text-xs text-zinc-400">Minutes Active</p></div></div></div>
          <div className="bg-white/5 rounded-xl p-5 ring-1 ring-white/10"><h3 className="font-semibold text-zinc-100 mb-4">Log Exercise</h3><div className="grid grid-cols-4 gap-2 mb-4">{EXERCISE_TYPES.map(t=><button key={t.name} onClick={()=>setSelectedType(t.name)} className={`flex flex-col items-center gap-2 p-3 rounded-lg ${selectedType===t.name?'bg-blue-600 ring-2 ring-blue-400':'bg-zinc-800 hover:bg-zinc-700'}`}><span className="text-2xl">{t.icon}</span><span className="text-xs text-center">{t.name}</span></button>)}</div><div className="mb-4"><label className="block text-sm text-zinc-400 mb-2">Duration (minutes)</label><input type="number" value={duration} onChange={e=>setDuration(e.target.value)} className="w-full bg-zinc-800/80 border border-zinc-600 rounded-lg p-3" placeholder="30"/></div><div className="mb-4"><label className="block text-sm text-zinc-400 mb-2">Notes</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} className="w-full bg-zinc-800/80 border border-zinc-600 rounded-lg p-3 resize-none" rows={2} placeholder="e.g., Morning jog"/></div><button onClick={handleAddExercise} disabled={!selectedType||!duration||estimatingCalories} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 rounded-lg font-semibold flex items-center justify-center gap-2">{estimatingCalories?<Spinner/>:'➕ Add Exercise'}</button></div>
          {todayExercises.length>0&&<div className="space-y-3"><h3 className="font-semibold text-zinc-100">Today's Exercises</h3>{todayExercises.map(e=><div key={e.id} className="bg-white/5 rounded-lg p-4 ring-1 ring-white/10 flex items-center justify-between"><div className="flex items-center gap-3"><span className="text-2xl">{EXERCISE_TYPES.find(t=>t.name===e.type)?.icon||'🏃'}</span><div><h4 className="font-medium text-zinc-100">{e.type}</h4><p className="text-sm text-zinc-400">{e.duration} min • {e.caloriesBurned} cal</p>{e.notes&&<p className="text-xs text-zinc-500 mt-1">{e.notes}</p>}</div></div><button onClick={()=>handleDeleteExercise(e.id)} className="text-red-400 hover:text-red-300">Delete</button></div>)}</div>}
        </div>
      </div>
    </div>
  );
};

export default ExerciseLogger;
