
import React from 'react';
import { Ingredient } from '../types';

interface NutritionCardProps {
  data: Ingredient;
}

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</p>
    <p className="text-lg font-semibold text-zinc-100">{value}</p>
  </div>
);


const NutritionCard: React.FC<NutritionCardProps> = ({ data }) => {
  return (
    <div className="bg-white/5 backdrop-blur-lg p-4 rounded-xl ring-1 ring-white/10 shadow-lg flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">{data.isHealthy ? '🌟' : '💩'}</span>
        <h3 className="font-bold text-blue-400 text-md truncate" title={data.ingredient}>
            {data.ingredient}
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Calories" value={data.calories} />
        <Stat label="Protein" value={`${data.protein}g`} />
        <Stat label="Fat" value={`${data.fat}g`} />
      </div>
      {data.notes && (
        <p className="text-xs text-zinc-300 pt-2 border-t border-zinc-700/50">
          {data.notes}
        </p>
      )}
    </div>
  );
};

export default NutritionCard;