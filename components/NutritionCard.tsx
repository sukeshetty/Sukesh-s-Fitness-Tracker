import React from 'react';
import { Ingredient } from '../types';

interface NutritionCardProps {
  data: Ingredient;
}

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
    <p className="text-lg font-semibold text-slate-100">{value}</p>
  </div>
);


const NutritionCard: React.FC<NutritionCardProps> = ({ data }) => {
  return (
    <div className="bg-slate-800/50 p-4 rounded-xl ring-1 ring-slate-700 shadow-lg flex flex-col gap-3">
      <h3 className="font-bold text-cyan-400 text-md truncate" title={data.ingredient}>
        {data.ingredient}
      </h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Calories" value={data.calories} />
        <Stat label="Protein" value={`${data.protein}g`} />
        <Stat label="Fat" value={`${data.fat}g`} />
      </div>
      {data.notes && (
        <p className="text-xs text-slate-300 pt-2 border-t border-slate-700/50">
          {data.notes}
        </p>
      )}
    </div>
  );
};

export default NutritionCard;
