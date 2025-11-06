# UI Screenshot Upload Feature

## How to Use

### Uploading Screenshots

1. **Open the Profile Page**
   - Click the User icon in the top-right header of the app
   - Scroll down to the "📸 UI Issue Screenshots" section

2. **Upload Screenshots**
   - Tap the "📷 Upload Screenshots" button
   - Select one or multiple screenshots from your device
   - The screenshots will be displayed in a gallery below

3. **Manage Screenshots**
   - View all uploaded screenshots with timestamps
   - Delete individual screenshots by clicking the "Delete" button
   - Screenshots are automatically saved to your browser's localStorage

### For Developers: Accessing Screenshots

Since the screenshots are stored in localStorage, you can access them in two ways:

#### Method 1: Using Browser Console

1. Open the app in your browser
2. Open Developer Tools (F12)
3. Go to Application > Local Storage > [your domain]
4. Find the key `ui-screenshots`
5. The value contains all screenshots as base64 encoded images

#### Method 2: Using the Extract Script

1. Open the app in your browser
2. Make sure you've uploaded screenshots via the Profile page
3. Open Developer Console (F12)
4. Copy the entire contents of `extract-screenshots.js`
5. Paste into the console and press Enter
6. All screenshots will be automatically downloaded to your computer

## Technical Details

- Screenshots are stored as base64-encoded data URLs in localStorage
- Each screenshot includes:
  - Unique ID
  - Base64 data URL
  - Upload timestamp
- Multiple images can be uploaded at once
- Supported formats: All standard image formats (JPEG, PNG, WebP, etc.)

## Use Cases

- Report UI alignment issues on mobile devices
- Document responsive layout problems
- Track visual bugs across different screen sizes
- Share screenshots with developers for debugging
- Keep a history of UI issues and fixes
