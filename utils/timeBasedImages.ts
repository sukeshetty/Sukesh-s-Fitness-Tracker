// Pre-generated placeholder images for different times of day
// These are simple gradient-based SVG images to avoid API costs
// Replace these with actual Imagen-generated images if needed

const createGradientSVG = (colors: string[], emoji: string) => {
  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill="url(#grad)" rx="20"/>
      <text x="100" y="120" font-size="80" text-anchor="middle" fill="white">${emoji}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// Pre-generated images for different times of day
export const TIME_BASED_IMAGES = {
  earlyMorning: createGradientSVG(['#667eea', '#764ba2'], '🌅'), // 5 AM - 8 AM
  midMorning: createGradientSVG(['#f093fb', '#f5576c'], '☀️'),   // 8 AM - 12 PM
  afternoon: createGradientSVG(['#4facfe', '#00f2fe'], '🌤️'),    // 12 PM - 5 PM
  evening: createGradientSVG(['#fa709a', '#fee140'], '🌆'),      // 5 PM - 8 PM
  night: createGradientSVG(['#30cfd0', '#330867'], '🌙'),         // 8 PM - 5 AM
};

// Get image based on current time
export const getImageForTime = (timestamp?: string): string => {
  const date = timestamp ? new Date(timestamp) : new Date();
  const hour = date.getHours();

  if (hour >= 5 && hour < 8) {
    return TIME_BASED_IMAGES.earlyMorning;
  } else if (hour >= 8 && hour < 12) {
    return TIME_BASED_IMAGES.midMorning;
  } else if (hour >= 12 && hour < 17) {
    return TIME_BASED_IMAGES.afternoon;
  } else if (hour >= 17 && hour < 20) {
    return TIME_BASED_IMAGES.evening;
  } else {
    return TIME_BASED_IMAGES.night;
  }
};

// Optional: If you want to use actual Imagen-generated images,
// replace the URLs below with your pre-generated image URLs from Imagen
export const USE_IMAGEN_IMAGES = false;

export const IMAGEN_TIME_BASED_IMAGES = {
  earlyMorning: '', // Add your Imagen-generated URL here
  midMorning: '',   // Add your Imagen-generated URL here
  afternoon: '',    // Add your Imagen-generated URL here
  evening: '',      // Add your Imagen-generated URL here
  night: '',        // Add your Imagen-generated URL here
};
