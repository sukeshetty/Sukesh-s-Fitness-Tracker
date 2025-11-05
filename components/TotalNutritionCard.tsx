import React from 'react';
import { Ingredient } from '../types';

interface TotalNutritionCardProps {
  data: Ingredient[];
}

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div>
    <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-bold text-slate-100">{value}</p>
  </div>
);

const TotalNutritionCard: React.FC<TotalNutritionCardProps> = ({ data }) => {
  const totals = data.reduce(
    (acc, item) => {
      // Ensure values are parsed as numbers, defaulting to 0 if invalid
      acc.calories += Number(item.calories) || 0;
      acc.protein += Number(item.protein) || 0;
      acc.fat += Number(item.fat) || 0;
      return acc;
    },
    { calories: 0, protein: 0, fat: 0 }
  );

  return (
    <div className="bg-slate-800/50 p-4 rounded-xl ring-1 ring-slate-700 shadow-lg flex flex-col gap-4 mb-3">
      <h3 className="font-bold text-cyan-400 text-lg text-center">
        Meal Summary
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <Stat label="Calories" value={Math.round(totals.calories)} />
        <Stat label="Protein" value={`${Math.round(totals.protein)}g`} />
        <Stat label="Fat" value={`${Math.round(totals.fat)}g`} />
      </div>
    </div>
  );
};

export default TotalNutritionCard;