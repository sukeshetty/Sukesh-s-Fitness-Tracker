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
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  nutritionData?: Ingredient[];
  timestamp: string;
}

export interface SavedMeal {
  name: string;
  content: string;
}
