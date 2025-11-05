import React, { useState, useEffect } from 'react';
import { FavoriteFood } from '../types';
import { StarIcon, TrashIcon } from './Icons';

interface FavoriteFoodsProps {
  onSelectFood: (foodDescription: string) => void;
}

const FAVORITE_FOODS_KEY = 'gemini-food-copilot-favorite-foods';

const FavoriteFoods: React.FC<FavoriteFoodsProps> = ({ onSelectFood }) => {
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const interval = setInterval(loadFavorites, 1000); // Poll for updates from other components
    loadFavorites();
    return () => clearInterval(interval);
  }, []);

  const loadFavorites = () => {
    const saved = localStorage.getItem(FAVORITE_FOODS_KEY);
    if (saved) {
      const favs: FavoriteFood[] = JSON.parse(saved);
      favs.sort((a, b) => b.useCount - a.useCount);
      setFavorites(favs);
    }
  };

  const handleSelectFood = (food: FavoriteFood) => {
    const updated = favorites.map(f => f.name === food.name ? { ...f, useCount: f.useCount + 1, lastUsed: new Date().toISOString() } : f);
    localStorage.setItem(FAVORITE_FOODS_KEY, JSON.stringify(updated));
    onSelectFood(food.content);
  };

  const handleDeleteFood = (foodName: string) => {
    if (confirm(`Remove "${foodName}" from favorites?`)) {
      const updated = favorites.filter(f => f.name !== foodName);
      localStorage.setItem(FAVORITE_FOODS_KEY, JSON.stringify(updated));
      loadFavorites(); // Re-load to update UI
    }
  };

  const filteredFavorites = favorites.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayFavorites = showAll ? filteredFavorites : filteredFavorites.slice(0, 6);

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-lg rounded-xl p-4 ring-1 ring-[var(--glass-border)] mb-4">
      <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><StarIcon className="w-5 h-5 text-yellow-400" /><h3 className="font-semibold text-[var(--text-primary)]">Favorite Foods</h3></div><span className="text-xs text-[var(--text-secondary)]">{favorites.length} saved</span></div>
      {favorites.length > 0 && <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search favorites..." className="w-full bg-zinc-800/80 border border-zinc-600 rounded-lg p-2 text-sm text-white placeholder-zinc-500 mb-3" />}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {displayFavorites.map((food) => (
          <div key={food.name} className="group relative bg-[var(--component-bg)] hover:bg-zinc-800 rounded-lg p-3 cursor-pointer ring-1 ring-white/5 hover:ring-white/20" onClick={() => handleSelectFood(food)}>
            <div className="flex items-start justify-between mb-1"><h4 className="font-medium text-zinc-200 text-sm truncate pr-2">{food.name}</h4><button onClick={(e) => { e.stopPropagation(); handleDeleteFood(food.name); }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"><TrashIcon className="w-3 h-3" /></button></div>
            <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{food.content}</p>
            <div className="flex items-center gap-2 text-xs text-zinc-500"><span>🔥 {food.useCount}x</span></div>
          </div>
        ))}
      </div>
      {filteredFavorites.length > 6 && <button onClick={() => setShowAll(!showAll)} className="w-full mt-3 py-2 text-sm text-blue-400 hover:text-blue-300 font-medium">{showAll ? 'Show Less' : `Show All (${filteredFavorites.length - 6} more)`}</button>}
      {favorites.length === 0 && <div className="text-center py-6"><StarIcon className="w-12 h-12 text-zinc-600 mx-auto mb-2" /><p className="text-sm text-zinc-500">No favorite foods yet</p></div>}
    </div>
  );
};

export default FavoriteFoods;
