const CACHE_NAME = 'sukeshfit-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  '/utils/audio.ts',
  '/components/contexts/ThemeContext.tsx',
  '/components/AnimatedNumber.tsx',
  '/components/ChatInput.tsx',
  '/components/ChatMessage.tsx',
  '/components/DailySummaryCard.tsx',
  '/components/DailySummaryHistory.tsx',
  '/components/DietAnalysis.tsx',
  '/components/DuplicateWarningModal.tsx',
  '/components/FastingTracker.tsx',
  '/components/Greeting.tsx',
  '/components/HeyCoach.tsx',
  '/components/Icons.tsx',
  '/components/NutritionCard.tsx',
  '/components/ProfilePage.tsx',
  '/components/Reports.tsx',
  '/components/Spinner.tsx',
  '/components/ThemeToggle.tsx',
  '/components/TotalActivityCard.tsx',
  '/components/TotalNutritionCard.tsx',
  '/components/TTSButton.tsx',
  '/components/WhatIfFood.tsx',
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/react@^19.2.0/',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/@google/genai@^1.28.0',
  'https://aistudiocdn.com/marked@^16.4.1',
  'https://aistudiocdn.com/dompurify@^3.3.0'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
