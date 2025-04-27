#!/bin/bash

# --- OS Detection ---
OS_TYPE=$(uname -s)
FIREFOX_PROFILE_ARG="" # Default empty
SLEEP_CMD="" # Default empty

if [ "$OS_TYPE" = "Darwin" ]; then
  # macOS settings
  PROJECT_DIR="/Users/teekamsuthar/Downloads/fiverr_auto_refresh"
  LOG_FILE="$PROJECT_DIR/fiverr-startup.log" # Log inside project dir for macOS
elif [ "$OS_TYPE" = "Linux" ]; then
  # Raspberry Pi (Linux) settings
  PROJECT_DIR="/home/teekamsuthar/Downloads/fiverr_auto_refresh_firefox"
  LOG_FILE="/tmp/fiverr-startup.log" # Log to /tmp for Pi startup
  FIREFOX_PROFILE_ARG="--firefox-profile=/home/teekamsuthar/.mozilla/firefox/zjgiz0vq.default-esr"
  SLEEP_CMD="sleep 10" # Add delay for Pi startup
else
  echo "Unsupported OS: $OS_TYPE"
  exit 1
fi

# --- Script Execution ---
echo "--- Script started on $OS_TYPE at $(date) ---" >> "$LOG_FILE"

# Optional delay for Pi
$SLEEP_CMD

echo "Initial directory: $(pwd)" >> "$LOG_FILE"
cd "$PROJECT_DIR" || { echo "cd to $PROJECT_DIR failed" >> "$LOG_FILE"; exit 1; }
echo "Changed directory to: $(pwd)" >> "$LOG_FILE"

echo "Running git pull..." >> "$LOG_FILE"
# Consider adding full path to git if needed: /usr/bin/git pull ...
git pull origin main >> "$LOG_FILE" 2>&1

echo "Running web-ext..." >> "$LOG_FILE"
# Consider adding full path to web-ext if needed: /path/to/web-ext run ...
web-ext run \
  $FIREFOX_PROFILE_ARG \
  --keep-profile-changes \
  --start-url="https://www.fiverr.com/seller_dashboard" >> "$LOG_FILE" 2>&1

echo "--- Script finished at $(date) ---" >> "$LOG_FILE"

# --- Autostart Notes (for Pi) ---
# chmod +x start-fiverr.sh to make it executable
# Method 1 LXDE autostart file
# Create the autostart folder (if it doesn't exist already):

# bash
# mkdir -p ~/.config/lxsession/LXDE-pi
# Edit (or create) the autostart file:

# bash
# nano ~/.config/lxsession/LXDE-pi/autostart
# Add this line at the end (replace with your actual path):


# @/home/teekamsuthar/Downloads/fiverr_auto_refresh_firefox/start-fiverr.sh
# Save (Ctrl + O, Enter) and exit (Ctrl + X).

# On your next boot (and auto-login into the desktop), your script will run automatically.