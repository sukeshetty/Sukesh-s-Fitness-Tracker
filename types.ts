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

export interface DailyTargets {
  calories: number;
  protein: number;
  fat: number;
  isCustom: boolean; 
  lastUpdatedBy: 'ai' | 'user';
}

export interface FavoriteFood {
  name: string;
  content: string;
  useCount: number;
  lastUsed: string;
  tags?: string[];
}

export interface Exercise {
  id: string;
  type: string;
  duration: number; // in minutes
  caloriesBurned: number;
  notes: string;
  timestamp: string;
}

export interface ExerciseLog {
  date: string; // YYYY-MM-DD
  exercises: Exercise[];
  totalCaloriesBurned: number;
}

export interface DailySummaryEntry {
  date: string;
  totals: {
    calories: number;
    protein: number;
    fat: number;
  };
  targets: {
    calories: number;
    protein: number;
    fat: number;
  };
  mealsLogged: number;
  goalsMet: {
    calories: boolean;
    protein: boolean;
    fat: boolean;
  };
}