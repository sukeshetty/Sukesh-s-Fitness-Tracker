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