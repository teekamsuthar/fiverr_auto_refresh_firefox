const FIVERR_REGEX = /^https?:\/\/([^.]+\.)?fiverr\.com(\/.*)?$/i;
const ALARM_NAME = 'fiverrRefreshAlarm';

// Default settings (in seconds)
const DEFAULT_MIN_INTERVAL_S = 5 * 60; // 5 minutes
const DEFAULT_MAX_INTERVAL_S = 10 * 60; // 10 minutes
// Updated Default URL list
const DEFAULT_URL_LIST = [
  "https://www.fiverr.com/inbox",
  "https://www.fiverr.com/briefs/overview/matches",
  "https://www.fiverr.com/catalog/manage",
  "https://www.fiverr.com/seller/levels",
  "https://www.fiverr.com/seller_dashboard"
];

let activeFiverrTabId = null;
let nextRefreshTime = null; // Store timestamp (Date.now() + delayMs)
let minIntervalS = DEFAULT_MIN_INTERVAL_S;
let maxIntervalS = DEFAULT_MAX_INTERVAL_S;
let fiverrUrls = [...DEFAULT_URL_LIST]; // Store the list of URLs to cycle through
let currentUrlIndex = 0; // Index for the fiverrUrls list
let badgeUpdateIntervalId = null; // Added for badge updates

// --- Badge Management ---

function formatBadgeTime(totalSeconds) {
  if (totalSeconds === null || totalSeconds < 0) {
    return '';
  }
  if (totalSeconds >= 60) {
    const minutes = Math.ceil(totalSeconds / 60); // Use ceil for minutes > 0
    return `${minutes}m`;
  } else {
    return `${totalSeconds}s`;
  }
}

async function updateBadgeText() {
  let remainingSeconds = null;
  if (nextRefreshTime) {
    const now = Date.now();
    remainingSeconds = Math.max(0, Math.round((nextRefreshTime - now) / 1000));
  }

  const badgeText = formatBadgeTime(remainingSeconds);
  try {
    await browser.browserAction.setBadgeText({ text: badgeText });
    if (badgeText && !badgeUpdateIntervalId) {
      // Start interval only if badge has text and interval not running
      badgeUpdateIntervalId = setInterval(updateBadgeText, 1000);
    } else if (!badgeText && badgeUpdateIntervalId) {
      // Stop interval if badge is cleared
      clearInterval(badgeUpdateIntervalId);
      badgeUpdateIntervalId = null;
    }
  } catch (e) {
    console.error("Error setting badge text:", e);
    if (badgeUpdateIntervalId) {
      clearInterval(badgeUpdateIntervalId);
      badgeUpdateIntervalId = null;
    }
  }
}

async function clearBadge() {
  try {
    await browser.browserAction.setBadgeText({ text: '' });
    if (badgeUpdateIntervalId) {
      clearInterval(badgeUpdateIntervalId);
      badgeUpdateIntervalId = null;
    }
  } catch (e) {
    console.error("Error clearing badge text:", e);
  }
}

async function setBadgeColor() {
  try {
    await browser.browserAction.setBadgeBackgroundColor({ color: '#007bff' }); // Blue color
  } catch (e) {
    console.error("Error setting badge background color:", e);
  }
}

// --- Initialization ---

async function initialize() {
  await setBadgeColor(); // Set color on startup
  await clearBadge(); // Ensure badge is clear initially
  // Load settings from storage
  try {
    // Added urlList to retrieval
    const data = await browser.storage.local.get(['minIntervalS', 'maxIntervalS', 'urlList']);
    minIntervalS = data.minIntervalS || DEFAULT_MIN_INTERVAL_S;
    maxIntervalS = data.maxIntervalS || DEFAULT_MAX_INTERVAL_S;
    // Use stored list if available and not empty, otherwise use default
    fiverrUrls = (data.urlList && data.urlList.length > 0) ? data.urlList : [...DEFAULT_URL_LIST];
    currentUrlIndex = 0; // Reset index on load
    console.log(`Settings loaded: Interval ${minIntervalS}-${maxIntervalS}s, URLs:`, fiverrUrls);
  } catch (e) {
    console.error("Error loading settings:", e);
    // Use defaults if loading fails
    minIntervalS = DEFAULT_MIN_INTERVAL_S;
    maxIntervalS = DEFAULT_MAX_INTERVAL_S;
    fiverrUrls = [...DEFAULT_URL_LIST];
    currentUrlIndex = 0;
  }

  // Set initial state based on currently active tab
  await checkActiveTabAndManageTimer();
}

// --- Timer Management ---

async function scheduleNextRefresh(forceSchedule = false) {
  await browser.alarms.clear(ALARM_NAME); // Clear any existing alarm
  await clearBadge(); // Clear badge initially when scheduling starts

  if (activeFiverrTabId === null && !forceSchedule) {
    console.log("No active Fiverr tab. Timer stopped.");
    nextRefreshTime = null;
    // Ensure badge is cleared if timer stops
    // clearBadge(); // Already called above
    return;
  }

  // Ensure intervals are valid using current settings
  const minMs = Math.max(10000, minIntervalS * 1000); // Minimum 10 seconds
  const maxMs = Math.max(minMs, maxIntervalS * 1000);
  const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  const delayMinutes = delayMs / 60000;

  try {
    browser.alarms.create(ALARM_NAME, { delayInMinutes: delayMinutes });
    nextRefreshTime = Date.now() + delayMs;
    // Update badge immediately after scheduling
    await updateBadgeText();
    const nextUrl = fiverrUrls[currentUrlIndex] || 'current page';
    console.log(`Alarm scheduled for tab ${activeFiverrTabId}. Next action (~${Math.round(delayMs / 1000)}s): Navigate to ${nextUrl}`);
  } catch (e) {
    console.error("Error creating alarm:", e);
    nextRefreshTime = null;
    await clearBadge(); // Clear badge on error
  }
}

// --- Event Listeners ---

// On alarm trigger
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log("Alarm triggered.");
    nextRefreshTime = null; // Clear scheduled time
    await clearBadge(); // Clear badge immediately on trigger

    if (activeFiverrTabId !== null) {
      try {
        // Verify the tab still exists and is active (or just exists?)
        const tab = await browser.tabs.get(activeFiverrTabId);

        // Check if the tab still exists and is a Fiverr tab (might have navigated away manually)
        // We proceed even if it's not the *same* Fiverr URL, as we will navigate it.
        if (tab && FIVERR_REGEX.test(tab.url)) {

          // Get the next URL from the list
          const urlToNavigate = fiverrUrls[currentUrlIndex];
          if (!urlToNavigate) {
            console.warn("URL list seems empty or index out of bounds, cannot navigate.");
            // Optionally, just reload instead?
            // await browser.tabs.reload(activeFiverrTabId, { bypassCache: true });
          } else {
            console.log(`Navigating tab ${activeFiverrTabId} to ${urlToNavigate}`);
            await browser.tabs.update(activeFiverrTabId, { url: urlToNavigate });
          }

          // Advance the index for the next cycle
          currentUrlIndex = (currentUrlIndex + 1) % fiverrUrls.length;

          // Reschedule automatically after action
          await scheduleNextRefresh(); // This will update the badge again

        } else {
          console.log(`Tab ${activeFiverrTabId} is no longer a valid Fiverr tab or doesn't exist. Stopping timer.`);
          activeFiverrTabId = null;
          currentUrlIndex = 0; // Reset index
          await browser.alarms.clear(ALARM_NAME);
          await clearBadge(); // Ensure badge is cleared when stopping
        }
      } catch (e) {
        console.error(`Error accessing or updating tab ${activeFiverrTabId}:`, e);
        // Tab likely closed, clear state
        activeFiverrTabId = null;
        nextRefreshTime = null;
        currentUrlIndex = 0;
        await browser.alarms.clear(ALARM_NAME);
        await clearBadge(); // Ensure badge is cleared on error
      }
    } else {
      console.log("Alarm triggered but no active Fiverr tab identified. Clearing alarm.");
      await browser.alarms.clear(ALARM_NAME);
      await clearBadge(); // Ensure badge is cleared
    }
  }
});

// On Tab Activation Change
browser.tabs.onActivated.addListener(async (activeInfo) => {
  console.log(`Tab activated: ${activeInfo.tabId}`);
  await checkSpecificTabAndManageTimer(activeInfo.tabId);
});

// On Tab Update (URL change, loading complete)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check only when the URL changes or loading completes, and it's the active tab
  if ((changeInfo.url || changeInfo.status === 'complete') && tab.active) {
    console.log(`Tab updated: ${tabId}, Status: ${changeInfo.status}, URL Changed: ${!!changeInfo.url}`);
    // Re-check if the current active tab is still Fiverr and manage timer accordingly
    await checkSpecificTabAndManageTimer(tabId);
  } else if (changeInfo.status === 'loading' && tabId === activeFiverrTabId) {
    // If the active tab starts loading, we might want to temporarily pause or just let the cycle continue
  }
});

// On Tab Close
browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (tabId === activeFiverrTabId) {
    console.log(`Active Fiverr tab ${tabId} closed.`);
    activeFiverrTabId = null;
    nextRefreshTime = null;
    currentUrlIndex = 0; // Reset index
    await browser.alarms.clear(ALARM_NAME);
    await clearBadge(); // Clear badge when tab closes
    console.log("Timer stopped.");
  }
});

// Listen for messages from popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'getTimerState') {
    let remainingSeconds = null;
    let status = "Inactive";

    if (nextRefreshTime) {
      const now = Date.now();
      remainingSeconds = Math.max(0, Math.round((nextRefreshTime - now) / 1000));
    }

    if (activeFiverrTabId !== null) {
      if (remainingSeconds !== null) {
        const nextUrl = fiverrUrls[currentUrlIndex] || "N/A";
        status = `Next: ${nextUrl.split('/').pop() || 'page'} in...`; // Show last part of URL
      } else {
        status = "Waiting to schedule...";
      }
    } else {
      status = "No active Fiverr tab.";
      remainingSeconds = null; // Ensure consistency
    }

    // Include current settings in the response
    sendResponse({
      remainingSeconds: remainingSeconds,
      status: status,
      isActive: activeFiverrTabId !== null,
      minIntervalS: minIntervalS,
      maxIntervalS: maxIntervalS,
      urlList: fiverrUrls // Send the array
    });
    return true; // Indicates asynchronous response

  } else if (request.command === 'saveSettings') {
    console.log("Received saveSettings request:", request.settings);
    const { minIntervalS: newMin, maxIntervalS: newMax, urlList: newUrls } = request.settings;

    // Basic validation on background side as well
    if (typeof newMin === 'number' && newMin >= 10 && // Min 10 seconds
      typeof newMax === 'number' && newMax >= newMin &&
      Array.isArray(newUrls) && newUrls.length > 0) {

      minIntervalS = newMin;
      maxIntervalS = newMax;
      fiverrUrls = newUrls;
      currentUrlIndex = 0; // Reset index when URLs change

      browser.storage.local.set({ minIntervalS, maxIntervalS, urlList: fiverrUrls })
        .then(() => {
          console.log("Settings saved to storage.");
          // If a timer is running, reschedule it immediately with new interval
          if (activeFiverrTabId !== null) {
            console.log("Rescheduling timer with new settings.");
            scheduleNextRefresh(true); // This will also update the badge
          } else {
            clearBadge(); // Ensure badge is clear if timer isn't running
          }
          sendResponse({ success: true });
        })
        .catch(e => {
          console.error("Error saving settings to storage:", e);
          sendResponse({ success: false, error: e.message });
        });

    } else {
      console.error("Invalid settings received:", request.settings);
      sendResponse({ success: false, error: "Invalid settings data" });
    }
    return true; // Indicates asynchronous response
  }
});


// --- Utility Functions ---

async function checkSpecificTabAndManageTimer(tabId) {
  try {
    const tab = await browser.tabs.get(tabId);
    // Only act if the tab we're checking is currently active in its window
    if (!tab.active) {
      // If the tab that became inactive *was* our tracked tab, stop the timer.
      if (tabId === activeFiverrTabId) {
        console.log(`Tracked Fiverr tab ${tabId} is no longer active. Stopping timer.`);
        activeFiverrTabId = null;
        nextRefreshTime = null;
        currentUrlIndex = 0;
        await browser.alarms.clear(ALARM_NAME);
        await clearBadge(); // Clear badge
      }
      return;
    }

    // Now check if this newly active tab is a Fiverr tab
    if (tab && FIVERR_REGEX.test(tab.url)) {
      if (activeFiverrTabId !== tabId) {
        console.log(`Switched active Fiverr tab to ${tabId}. Restarting timer.`);
        activeFiverrTabId = tabId;
        currentUrlIndex = 0; // Reset index for the new tab context
        await scheduleNextRefresh(true); // Force schedule
      } else {
        console.log(`Active Fiverr tab ${tabId} remains the same.`);
        // If timer isn't set (e.g., after settings save), ensure it is.
        const alarm = await browser.alarms.get(ALARM_NAME);
        if (!alarm && nextRefreshTime === null) {
          console.log("Timer was not active, restarting.");
          await scheduleNextRefresh(); // This updates the badge
        } else if (alarm && nextRefreshTime !== null) {
          // Ensure badge is up-to-date if already running
          await updateBadgeText();
        }
      }
    } else {
      // The active tab is NOT Fiverr
      if (activeFiverrTabId !== null) {
        console.log(`Active tab ${tabId} is not Fiverr. Stopping timer.`);
        activeFiverrTabId = null;
        nextRefreshTime = null;
        currentUrlIndex = 0;
        await browser.alarms.clear(ALARM_NAME);
        await clearBadge(); // Clear badge
      }
    }
  } catch (e) {
    console.error(`Error checking tab ${tabId}:`, e);
    // Tab might be closed or inaccessible
    if (tabId === activeFiverrTabId) {
      activeFiverrTabId = null;
      nextRefreshTime = null;
      currentUrlIndex = 0;
      await browser.alarms.clear(ALARM_NAME);
      await clearBadge(); // Clear badge
    }
  }
}

async function checkActiveTabAndManageTimer() {
  try {
    // Query for the active tab in the *current* window
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      await checkSpecificTabAndManageTimer(tabs[0].id);
    } else {
      // No active tab in the current window, maybe the window lost focus or was closed.
      // We should stop the timer if it was running.
      if (activeFiverrTabId !== null) {
        console.log("No active tab found in current window. Stopping timer.");
        activeFiverrTabId = null;
        nextRefreshTime = null;
        currentUrlIndex = 0;
        await browser.alarms.clear(ALARM_NAME);
        await clearBadge(); // Clear badge
      }
    }
  } catch (e) {
    console.error("Error querying active tab:", e);
    // Clear state on error
    activeFiverrTabId = null;
    nextRefreshTime = null;
    currentUrlIndex = 0;
    await browser.alarms.clear(ALARM_NAME);
    await clearBadge(); // Clear badge
  }
}


// --- Start ---
initialize();
