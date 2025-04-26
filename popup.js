const timerDisplay = document.getElementById('timer');
const statusDisplay = document.getElementById('status');
const minIntervalInput = document.getElementById('minInterval');
const maxIntervalInput = document.getElementById('maxInterval');
const urlListInput = document.getElementById('urlList');
const saveButton = document.getElementById('saveButton');
const saveStatusDisplay = document.getElementById('saveStatus');

let intervalId = null;

function formatTime(totalSeconds) {
    if (totalSeconds === null || totalSeconds < 0) {
        return '--:--';
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updatePopup() {
    // Request state and settings from background
    browser.runtime.sendMessage({ command: 'getTimerState' }).then(response => {
        if (browser.runtime.lastError) {
            statusDisplay.textContent = 'Error connecting.';
            console.error(`Popup Error: ${browser.runtime.lastError.message}`);
            clearInterval(intervalId);
            intervalId = null;
            return;
        }

        if (response) {
            // --- Update Timer Display ---
            if (typeof response.remainingSeconds !== 'undefined') {
                timerDisplay.textContent = formatTime(response.remainingSeconds);
                statusDisplay.textContent = response.status;

                // Clear existing interval if state changes significantly (e.g., timer stops)
                if (response.remainingSeconds <= 0 && intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }

                // Start interval only if needed and not already running
                if (response.remainingSeconds > 0 && !intervalId) {
                    intervalId = setInterval(updatePopup, 1000);
                }
            } else {
                timerDisplay.textContent = '--:--';
                statusDisplay.textContent = response.status || 'No active timer.';
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            }

            // --- Populate Settings Inputs (only if they haven't been modified by user) ---
            if (document.activeElement !== minIntervalInput) {
                minIntervalInput.value = response.minIntervalS ? response.minIntervalS / 60 : 5;
            }
            if (document.activeElement !== maxIntervalInput) {
                maxIntervalInput.value = response.maxIntervalS ? response.maxIntervalS / 60 : 10;
            }
            if (document.activeElement !== urlListInput) {
                urlListInput.value = response.urlList ? response.urlList.join('\n') : '';
            }

        } else {
            // Handle case where response is unexpectedly null/undefined
            statusDisplay.textContent = 'Error receiving data.';
            timerDisplay.textContent = '--:--';
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }
    }).catch(error => {
        statusDisplay.textContent = 'Error.';
        console.error(`Popup Error: ${error}`);
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    });
}

function saveSettings() {
    const minIntervalMins = parseInt(minIntervalInput.value, 10);
    const maxIntervalMins = parseInt(maxIntervalInput.value, 10);
    const urlsString = urlListInput.value.trim();

    // Basic Validation
    if (isNaN(minIntervalMins) || minIntervalMins < 1) {
        alert('Minimum interval must be at least 1 minute.');
        return;
    }
    if (isNaN(maxIntervalMins) || maxIntervalMins < minIntervalMins) {
        alert('Maximum interval must be equal to or greater than the minimum interval.');
        return;
    }

    // Split primarily by newline, trim whitespace from each line, filter empty lines and non-fiverr links
    const urls = urlsString
        .split(/\r?\n/) // Split by newline (Windows or Unix)
        .map(url => url.trim())
        .filter(url => url.length > 0 && url.toLowerCase().includes('fiverr.com'));

    if (urls.length === 0) {
        alert('Please provide at least one valid Fiverr URL.');
        return;
    }

    const settings = {
        minIntervalS: minIntervalMins * 60,
        maxIntervalS: maxIntervalMins * 60,
        urlList: urls
    };

    browser.runtime.sendMessage({ command: 'saveSettings', settings: settings })
        .then(response => {
            saveStatusDisplay.textContent = 'Settings saved!';
            setTimeout(() => { saveStatusDisplay.textContent = ''; }, 2000); // Clear message after 2s
            // Refresh popup display with potentially new timer state
            updatePopup();
        })
        .catch(error => {
            saveStatusDisplay.textContent = 'Error saving!';
            console.error("Error sending saveSettings message:", error);
            setTimeout(() => { saveStatusDisplay.textContent = ''; }, 3000);
        });
}

// Initial update when popup opens
document.addEventListener('DOMContentLoaded', updatePopup);

// Save button listener
saveButton.addEventListener('click', saveSettings);

// Cleanup interval when the popup closes
window.addEventListener('unload', () => {
    if (intervalId) {
        clearInterval(intervalId);
    }
}); 