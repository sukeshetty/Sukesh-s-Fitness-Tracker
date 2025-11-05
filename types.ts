
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export interface Ingredient {
  ingredient: string;
  calories: number;
  protein: number;
  fat: number;
  notes: string;
  isHealthy: boolean;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  imageUrl?: string;
  nutritionData?: Ingredient[];
  timestamp: string;
}

export interface SavedMeal {
  name: string;
  content: string;
}

// NEW: User Profile Interface
export interface UserProfile {
  age: number;
  gender: 'male' | 'female' | 'other';
  weight: number; // in kg
  height: number; // in cm
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'lose_weight' | 'maintain' | 'gain_muscle';
  healthConditions: string[];
  dailyTargets: DailyTargets;
}

// NEW: Daily Targets Interface
export interface DailyTargets {
  calories: number;
  protein: number;
  fat: number;
  isCustom: boolean; 
  lastUpdatedBy: 'ai' | 'user';
}