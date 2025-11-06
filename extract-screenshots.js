// This script extracts screenshots from localStorage and saves them as files
// Run this in browser console after uploading screenshots

(function extractScreenshots() {
  const screenshots = JSON.parse(localStorage.getItem('ui-screenshots') || '[]');

  if (screenshots.length === 0) {
    console.log('No screenshots found in localStorage');
    return;
  }

  console.log(`Found ${screenshots.length} screenshots`);

  screenshots.forEach((screenshot, index) => {
    // Create a download link
    const link = document.createElement('a');
    link.href = screenshot.dataUrl;
    link.download = `ui-screenshot-${index + 1}-${screenshot.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  console.log('Download links created for all screenshots');
})();

// To use this script:
// 1. Open your app in the browser
// 2. Upload screenshots via the Profile page
// 3. Open browser console (F12)
// 4. Paste this entire script and press Enter
// 5. Screenshots will be downloaded automatically
