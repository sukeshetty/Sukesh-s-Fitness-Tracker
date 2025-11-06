# 🔧 SukeshFIT Troubleshooting Guide

## Problem: "Hey Coach" / Tabs / Inputs Not Working

### Current Status
I've checked your repository and here's what I found:

✅ **Files Present:**
- App.tsx (main application)
- ChatInput.tsx (input field at bottom)
- Greeting.tsx (welcome screen with 4 suggestion cards)
- All nutrition and display components

❌ **Files NOT Found in Repo:**
- ProfilePage.tsx
- ExerciseLogger.tsx
- FavoriteFoods.tsx
- DailySummaryHistory.tsx
- Reports.tsx
- ThemeToggle.tsx
- Any "Coach" or "Tabs" components

### ⚠️ Important: Google AI Studio vs Git Repository

**If you built features in Google AI Studio**, they won't automatically appear in your git repository. You need to:

1. Copy the code from Google AI Studio
2. Paste it into the appropriate files here
3. Commit to git

---

## 🐛 Step-by-Step Debugging

### Step 1: Open Browser Console
1. Open your app in browser
2. Press **F12** (Windows/Linux) or **Cmd+Option+I** (Mac)
3. Click **Console** tab
4. Keep it open while testing

### Step 2: Check What You Should See

When the app loads, you should see in console:
```
🔑 Initializing chat with API key: Key present ✅
```

If you see:
```
🔑 Initializing chat with API key: Key missing ❌
```
**→ Your API key is not set!** See "Fix API Key" section below.

### Step 3: Test Greeting Suggestions

1. On the welcome screen, click **any** of the 4 suggestion cards:
   - "Log my breakfast"
   - "Analyze my lunch"
   - "Review my dessert"
   - "What about this snack?"

2. You should see in console:
```
💡 Suggestion card clicked: Log my breakfast
🚀 handleSendMessage called with: For breakfast I had 2 eggs...
```

**If you DON'T see this:**
- The click handler is broken
- React isn't loading properly
- JavaScript errors are blocking execution

### Step 4: Test Manual Input

1. Type something in the bottom input field (e.g., "chicken and rice")
2. Press Enter or click the send button
3. You should see in console:
```
🚀 handleSendMessage called with: chicken and rice
```

**If you DON'T see this:**
- Input component isn't connected
- Form submission is blocked

### Step 5: Check Network Requests

1. In DevTools, click **Network** tab
2. Try sending a message
3. Look for requests to `generativelanguage.googleapis.com`
4. Click on the request to see details

**Common issues:**
- 401/403 error → Bad API key
- CORS error → API key restrictions
- No request at all → Code isn't reaching API call

---

## 🔧 Common Fixes

### Fix 1: Set API Key (Google AI Studio)

If you're in **Google AI Studio**:
1. Click the **key icon** in the top right
2. Select "Get API key"
3. Create or select your API key
4. The key is automatically set in the environment

### Fix 2: Set API Key (Local Development)

If running **locally with Vite**:

1. Create `.env.local` file in project root:
```bash
GEMINI_API_KEY=AIzaSy...your_key_here
```

2. Restart the dev server:
```bash
npm run dev
```

### Fix 3: Clear Browser Cache

1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. Or use Ctrl+Shift+R (Cmd+Shift+R on Mac)

### Fix 4: Check for JavaScript Errors

In Console tab, look for **red error messages** like:
- `Uncaught ReferenceError`
- `Cannot read property of undefined`
- `TypeError`

Copy the full error and investigate.

### Fix 5: Verify React is Loading

In Console, type:
```javascript
document.getElementById('root').innerHTML
```

You should see HTML content. If it's empty, React isn't rendering.

---

## 🔍 Advanced Debugging

### Check if handleSendMessage is Defined

In Console, type:
```javascript
window.handleSendMessage
```

If it returns `undefined`, the function isn't being exposed (which is normal for React components).

### Test Direct Message Sending

This won't work in production but helps debug:
```javascript
// In Console
const event = new CustomEvent('test');
// This won't work, but will show if React is listening
```

### Verify Component Rendering

In React DevTools:
1. Install React DevTools browser extension
2. Open DevTools → React tab
3. Find `App` component
4. Check if `handleSendMessage` is in props/hooks
5. Check `messages` state

---

## 📱 About "Hey Coach" and Tabs

### I Don't See These Features in Your Code

The current repository has:
- ✅ Welcome screen (Greeting.tsx)
- ✅ Food logging input
- ✅ Nutrition analysis
- ✅ Daily summary modal
- ✅ Video generator
- ✅ Text-to-speech

But **NOT**:
- ❌ "Hey Coach" feature
- ❌ Tab navigation
- ❌ Profile pages
- ❌ Exercise logger
- ❌ Multi-view navigation

### Did You Build These in Google AI Studio?

If yes, please:
1. Copy the code from AI Studio
2. Share it with me
3. I'll help you debug it

Or tell me:
- What URL are you accessing?
- Is this the AI Studio preview or a deployed version?
- Can you share a screenshot of what you're seeing?

---

## 🚀 Quick Test

Run this in your browser console:
```javascript
// Test if React is working
console.log(document.getElementById('root').innerHTML.length > 0 ? '✅ React rendered' : '❌ React not rendered');

// Test if localStorage works
localStorage.setItem('test', 'works');
console.log(localStorage.getItem('test') === 'works' ? '✅ localStorage works' : '❌ localStorage blocked');
```

---

## 📞 Next Steps

Please provide:
1. **Console errors** (copy/paste any red errors)
2. **What you see** when you click a suggestion card
3. **Console output** from the emoji logs (🚀 🔑 💡)
4. **Screenshot** of the app
5. **Clarification**: Where did you build the "Hey Coach" feature?

I've added debug logging to your code. The next time you:
- Load the app → Check console for 🔑
- Click a suggestion → Check console for 💡 and 🚀
- Type a message → Check console for 🚀

This will help us identify exactly where it's failing!
