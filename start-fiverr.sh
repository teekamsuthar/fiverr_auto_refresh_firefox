#!/bin/bash
LOG_FILE="/home/teekamsuthar/fiverr-startup.log"

echo "--- Script started at $(date) ---" >> "$LOG_FILE"

echo "Initial directory: $(pwd)" >> "$LOG_FILE"
cd /home/teekamsuthar/Downloads/fiverr_auto_refresh_firefox || { echo "cd failed" >> "$LOG_FILE"; exit 1; }
echo "Changed directory to: $(pwd)" >> "$LOG_FILE"

echo "Running git pull..." >> "$LOG_FILE"
git pull origin main >> "$LOG_FILE" 2>&1

echo "Running web-ext..." >> "$LOG_FILE"
web-ext run \
  --firefox-profile="/home/teekamsuthar/.mozilla/firefox/zjgiz0vq.default-esr" \
  --keep-profile-changes \
  --start-url="https://www.fiverr.com/seller_dashboard" >> "$LOG_FILE" 2>&1

echo "--- Script finished at $(date) ---" >> "$LOG_FILE"

# chmod +x start-fiverr.sh to make it executable
# Method 1 LXDE autostart file
# Create the autostart folder (if it doesn't exist already):

# bash
# mkdir -p ~/.config/lxsession/LXDE-pi
# Edit (or create) the autostart file:

# bash
# nano ~/.config/lxsession/LXDE-pi/autostart
# Add this line at the end (replace with your actual path):


# @/home/pi/start-fiverr.sh
# Save (Ctrl + O, Enter) and exit (Ctrl + X).

# On your next boot (and auto-login into the desktop), your script will run automatically.