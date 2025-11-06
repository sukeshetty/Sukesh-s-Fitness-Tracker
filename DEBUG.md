# Debugging Steps for SukeshFIT

## Issue: No response from inputs or buttons

### Step 1: Check Browser Console
1. Open the app in browser
2. Press F12 (or Right-click → Inspect)
3. Go to Console tab
4. Look for errors (red text)

### Step 2: Check API Key
1. Make sure you have a `.env.local` file
2. It should contain: `GEMINI_API_KEY=your_actual_key`
3. Restart the dev server after adding

### Step 3: Test Greeting Buttons
1. Click on any greeting suggestion card
2. Check console for: "Suggestion clicked: [title]"
3. If nothing appears, the click handler isn't working

### Step 4: Test Input Field
1. Type something in the bottom input
2. Press Enter or click send button
3. Check console for: "handleSendMessage called with: [text]"

### Step 5: Check Network Tab
1. Open DevTools → Network tab
2. Try sending a message
3. Look for requests to Gemini API
4. Check if any fail (red status)

## Common Fixes

### If API Key Error:
```bash
# Create .env.local file
echo "GEMINI_API_KEY=your_key_here" > .env.local
```

### If Nothing Happens:
- Check if JavaScript is enabled
- Check if React is loading (see React icon in DevTools)
- Look for CORS errors in console

### If Buttons Don't Work:
- Check if onClick handlers are attached
- Look for "Cannot read property of undefined" errors
- Verify components are rendering
