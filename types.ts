export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export interface Ingredient {
  ingredient: string;
  calories: number | string;
  protein: number | string;
  fat: number | string;
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