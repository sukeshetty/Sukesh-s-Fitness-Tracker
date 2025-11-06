# 🏃 SukeshFIT - AI-Powered Nutrition Tracker

AI-powered nutrition tracking Progressive Web App built with React, TypeScript, and Google Gemini API.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sukeshetty/Sukesh-s-Fitness-Tracker)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/sukeshetty/Sukesh-s-Fitness-Tracker)

## ✨ Features

- 🤖 **AI-Powered Analysis**: Get instant nutritional feedback from Google Gemini
- 📸 **Image Recognition**: Upload food photos for automatic analysis
- 📊 **Daily Summaries**: Track your nutrition progress over time
- 💾 **Saved Meals**: Quick-add frequently logged meals
- 🎯 **Smart Suggestions**: Personalized meal recommendations
- 📱 **Progressive Web App**: Install on your device, works offline
- 🌙 **Mobile Optimized**: Perfect experience on iOS and Android

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Google Gemini API Key ([Get one here](https://aistudio.google.com/apikey))

### Local Development

1. **Clone the repository**:
```bash
git clone https://github.com/sukeshetty/Sukesh-s-Fitness-Tracker.git
cd Sukesh-s-Fitness-Tracker
```

2. **Install dependencies**:
```bash
npm install
```

3. **Create environment file**:
```bash
# Create .env.local file
echo "GEMINI_API_KEY=your_api_key_here" > .env.local
```

4. **Start development server**:
```bash
npm run dev
```

5. **Open in browser**: http://localhost:3000

### Production Build

```bash
npm run build
npm run preview
```

## 📦 Deployment

**📘 See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for step-by-step instructions on deploying to:
- ✅ Vercel (recommended)
- ✅ Netlify
- ✅ Custom hosting

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5.8
- **Build Tool**: Vite 6.2
- **AI**: Google Gemini API (gemini-2.5-pro)
- **Styling**: Tailwind CSS
- **PWA**: Service Workers, Web Manifest

## 📱 Mobile Features

- Image compression before upload (reduces data by ~80%)
- Haptic feedback on all interactions
- Offline support with service worker
- iOS address bar auto-hide handling
- Pull-to-refresh prevention
- Safe area support for notched devices

## 📚 Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment walkthrough
- **[DEPLOYMENT_READY.md](./DEPLOYMENT_READY.md)** - Deployment checklist & verification
- **[MOBILE_PWA_AUDIT.md](./MOBILE_PWA_AUDIT.md)** - Mobile/PWA optimization audit

## 🐛 All Critical Bugs Fixed ✅

- ✅ Memory leaks from blob URLs
- ✅ Stale closure in error recovery
- ✅ Type safety issues (number/string)
- ✅ localStorage quota exceeded crashes
- ✅ Mobile viewport issues
- ✅ No offline support
- ✅ Large uncompressed images

See [MOBILE_PWA_AUDIT.md](./MOBILE_PWA_AUDIT.md) for full technical details.

## 🔐 Security

- API keys stored securely in environment variables
- No sensitive data in localStorage
- HTTPS required for PWA features
- Service worker cache strategy reviewed

## 📄 License

MIT

---

**Built with ❤️ using Google Gemini AI**

View original app in AI Studio: https://ai.studio/apps/drive/1HStTlTjMPZY3Qf8sV85kLBkXagYOjiet
