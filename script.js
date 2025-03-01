document.addEventListener('DOMContentLoaded', function() {
    const tbody = document.querySelector('tbody');
    const container = document.querySelector('.container');
    const locationOverlay = document.querySelector('.location-overlay');
    const allowLocationBtn = document.querySelector('.location-allow');
    const defaultLocationBtn = document.querySelector('.location-default');
    const changeLocationBtn = document.querySelector('.change-location-btn');
    
    // Theme Toggle Functionality
    const themeToggle = document.querySelector('.theme-button');
    const root = document.documentElement;
    const overlay = document.querySelector('.theme-transition-overlay');
    
    // Add DST detection and adjustment variables
    let dstAdjustment = 0; // Hours to adjust for DST
    let dstDetected = false;
    
    // Function to detect if a date is in DST
    function isInDST(date) {
        // Create a copy of the date to avoid modifying the original
        const checkDate = new Date(date);
        
        // Get the standard time offset for January 1st (non-DST period for most regions)
        const jan = new Date(checkDate.getFullYear(), 0, 1);
        const standardOffset = jan.getTimezoneOffset();
        
        // Get the offset for the check date
        const currentOffset = checkDate.getTimezoneOffset();
        
        // If current offset is less than standard offset, we're in DST
        // (getTimezoneOffset returns minutes, and is NEGATIVE in DST)
        const isDST = currentOffset < standardOffset;
        
        console.log(`DST check for ${checkDate.toDateString()}: Standard offset=${standardOffset}, Current offset=${currentOffset}, In DST=${isDST}`);
        
        return isDST;
    }
    
    // Function to calculate DST adjustment
    function calculateDSTAdjustment(date) {
        // Check if the date is in DST
        const isDST = isInDST(date);
        
        // Calculate the difference in hours
        if (isDST) {
            // Get the standard time offset for January 1st
            const jan = new Date(date.getFullYear(), 0, 1);
            const standardOffset = jan.getTimezoneOffset();
            
            // Get the offset for the current date
            const currentOffset = date.getTimezoneOffset();
            
            // Calculate the difference in hours
            const diffHours = (standardOffset - currentOffset) / 60;
            
            console.log(`DST adjustment: ${diffHours} hours`);
            return diffHours;
        }
        
        return 0;
    }
    
    // Set initial theme
    root.setAttribute('data-theme', 'dark');
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = root.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        root.setAttribute('data-theme', newTheme);
        // Update icon
        const icon = themeToggle.querySelector('i');
        icon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    });

    // Settings Toggle Functionality
    const settingsButton = document.querySelector('.settings-button');
    const settingsDropdown = document.querySelector('.settings-dropdown');
    const timeFormatRadios = document.querySelectorAll('input[name="timeFormat"]');
    const asrMethodRadios = document.querySelectorAll('input[name="asrMethod"]');
    
    // Initialize time format from localStorage or default to 12-hour
    let timeFormat = localStorage.getItem('timeFormat') || '12';
    document.querySelector(`input[name="timeFormat"][value="${timeFormat}"]`).checked = true;
    
    // Initialize Asr calculation method from localStorage or default to standard
    let asrMethod = localStorage.getItem('asrMethod') || 'standard';
    document.querySelector(`input[name="asrMethod"][value="${asrMethod}"]`).checked = true;
    
    // Toggle settings dropdown
    settingsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsDropdown.contains(e.target) && e.target !== settingsButton) {
            settingsDropdown.classList.remove('active');
        }
    });
    
    // Handle time format change
    timeFormatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            timeFormat = e.target.value;
            localStorage.setItem('timeFormat', timeFormat);
            
            // Update all displayed times
            updateAllDisplayedTimes();
            
            // Update prayer times for the current date
            const dateStr = new Date(document.querySelector('.date h1').textContent).toISOString().split('T')[0];
            const { lat, lng } = getDefaultCoordinates();
            getPrayerTimes(lat, lng, dateStr).then(timings => {
                updatePrayerTimes(timings);
            });
        });
    });
    
    // Handle Asr calculation method change
    asrMethodRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            asrMethod = e.target.value;
            localStorage.setItem('asrMethod', asrMethod);
            
            // Update prayer times for the current date with new Asr method
            const dateStr = new Date(document.querySelector('.date h1').textContent).toISOString().split('T')[0];
            const storedCoords = localStorage.getItem('userCoordinates');
            let coordinates;
            
            if (storedCoords) {
                coordinates = JSON.parse(storedCoords);
            } else {
                coordinates = getDefaultCoordinates();
            }
            
            // Refresh prayer times with new Asr method
            const timings = await getPrayerTimes(coordinates.lat, coordinates.lng, dateStr);
            updatePrayerTimes(timings);
            
            // Clear the table first
            tbody.innerHTML = '';
            
            // Regenerate the entire table with new Asr method
            await generateRamadanData(coordinates.lat, coordinates.lng);
            
            // Restore completed cells from localStorage
            restoreCompletedCells();
        });
    });
    
    // Function to format time based on selected format
    function formatTime(timeStr, isAlreadyAdjusted = false) {
        if (!timeStr) return '';
        
        // Parse the time string (assuming format like "04:30" or "16:45")
        const [hours, minutes] = timeStr.split(':');
        let hour = parseInt(hours);
        
        // Only apply DST adjustment if needed and not already adjusted
        if (dstDetected && !isAlreadyAdjusted) {
            hour = (hour + dstAdjustment) % 24;
        }
        
        // Format hours with leading zero if needed
        const formattedHour = hour.toString().padStart(2, '0');
        
        if (timeFormat === '24') {
            // Return 24-hour format
            return `${formattedHour}:${minutes}`;
        } else {
            // Convert to 12-hour format with AM/PM
            const period = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
            return `${hour12}:${minutes} ${period}`;
        }
    }
    
    // Function to adjust time for DST
    function adjustTimeForDST(timeStr) {
        if (!timeStr || !dstDetected) return timeStr;
        
        // Parse the time string
        const [hours, minutes] = timeStr.split(':');
        let hour = parseInt(hours);
        
        // Apply DST adjustment
        hour = (hour + dstAdjustment) % 24;
        
        // Format hours with leading zero if needed
        return `${hour.toString().padStart(2, '0')}:${minutes}`;
    }
    
    // Function to update all displayed times - pass the flag to formatTime
    function updateAllDisplayedTimes() {
        // Update table cells
        document.querySelectorAll('tbody td:not(:first-child)').forEach(cell => {
            const timeText = cell.textContent.trim();
            if (timeText && timeText.includes(':')) {
                // Extract just the time part if it has AM/PM
                const timePart = timeText.split(' ')[0];
                // Pass true to indicate times are already adjusted
                cell.textContent = formatTime(timePart, true);
            }
        });
        
        // Update prayer times in header
        document.querySelectorAll('.time').forEach(timeElement => {
            const timeText = timeElement.textContent.trim();
            if (timeText && timeText.includes(':')) {
                // Extract just the time part if it has AM/PM
                const timePart = timeText.split(' ')[0];
                // Pass true to indicate times are already adjusted
                timeElement.textContent = formatTime(timePart, true);
            }
        });
    }

    // Function to get default coordinates based on timezone
    function getDefaultCoordinates() {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Common timezone to coordinates mapping
        const timezoneMap = {
            'America/New_York': { lat: 40.7128, lng: -74.0060 }, // New York
            'America/Los_Angeles': { lat: 34.0522, lng: -118.2437 }, // Los Angeles
            'Europe/London': { lat: 51.5074, lng: -0.1278 }, // London
            'Asia/Dubai': { lat: 25.2048, lng: 55.2708 }, // Dubai
            'Asia/Karachi': { lat: 24.8607, lng: 67.0011 }, // Karachi
            'Asia/Kolkata': { lat: 28.6139, lng: 77.2090 }, // Delhi
            'Asia/Singapore': { lat: 1.3521, lng: 103.8198 }, // Singapore
            // Add more timezone mappings as needed
        };

        return timezoneMap[timezone] || { lat: 21.4225, lng: 39.8262 }; // Default to Mecca if timezone not found
    }

    // Function to get prayer times - updated to handle DST and Asr method
    async function getPrayerTimes(latitude, longitude, date) {
        // Get the Asr calculation method from localStorage
        const asrMethod = localStorage.getItem('asrMethod') || 'standard';
        
        // Convert to API method parameter
        // For more accurate results, we should use a method appropriate for the user's location
        // Let's use a more dynamic approach based on coordinates
        
        // Determine the best calculation method based on region
        let methodParam = 3; // Default to Muslim World League
        
        // Check region based on coordinates to select appropriate method
        if (longitude > -20 && longitude < 40 && latitude > 20 && latitude < 50) {
            // Europe, Middle East, North Africa
            methodParam = 3; // Muslim World League
        } else if (longitude > 40 && longitude < 100 && latitude > 20 && latitude < 45) {
            // South Asia
            methodParam = 1; // University of Islamic Sciences, Karachi
        } else if (longitude > -140 && longitude < -50 && latitude > 20 && latitude < 60) {
            // North America
            methodParam = 2; // Islamic Society of North America
        } else if (longitude > 100 && longitude < 180 && latitude > -10 && latitude < 60) {
            // East Asia, Australia
            methodParam = 11; // Singapore
        }
        
        // For Hanafi Asr, we need to use the school parameter
        const schoolParam = asrMethod === 'hanafi' ? 1 : 0; // 1 for Hanafi, 0 for Shafi
        
        // Build the API URL with explicit parameters
        const apiUrl = `https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=${methodParam}&school=${schoolParam}`;
        
        console.log(`Fetching prayer times with URL: ${apiUrl}`);
        console.log(`Current Asr method: ${asrMethod}, School param: ${schoolParam}, Method param: ${methodParam}`);
        
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data = await response.json();
            
            console.log("API response:", data);
            
            // Check if we need to adjust for DST using the improved function
            const dateObj = new Date(date);
            dstAdjustment = calculateDSTAdjustment(dateObj);
            dstDetected = dstAdjustment !== 0;
            
            console.log(`DST detected: ${dstDetected}, Adjustment: ${dstAdjustment} hours`);
            
            // If DST is detected, adjust all times
            if (dstDetected) {
                const timings = data.data.timings;
                const adjustedTimings = {};
                
                for (const [prayer, time] of Object.entries(timings)) {
                    adjustedTimings[prayer] = adjustTimeForDST(time);
                }
                
                // Add a flag to indicate these times are already adjusted
                adjustedTimings._dstAdjusted = true;
                return adjustedTimings;
            }
            
            return data.data.timings;
        } catch (error) {
            console.error('Error fetching prayer times:', error);
            // Return fallback times in case of API failure
            return getFallbackPrayerTimes(date, latitude, longitude);
        }
    }

    // Add a fallback function for prayer times in case the API fails
    function getFallbackPrayerTimes(date, latitude, longitude) {
        // Simple fallback calculation based on approximate times
        // This is not accurate but better than showing nothing
        const dateObj = new Date(date);
        const month = dateObj.getMonth();
        const isWinter = month >= 9 || month <= 2; // Oct-Mar
        
        // Adjust times based on season and rough latitude
        let fajrOffset = isWinter ? 90 : 60; // Minutes before sunrise
        let maghribOffset = 15; // Minutes after sunset
        let ishaOffset = isWinter ? 90 : 120; // Minutes after maghrib
        
        // Adjust for latitude (higher latitudes have more extreme times)
        if (Math.abs(latitude) > 45) {
            fajrOffset += 30;
            ishaOffset += 30;
        }
        
        // Calculate approximate sunrise and sunset based on latitude and date
        // This is a very rough approximation
        const dayOfYear = Math.floor((dateObj - new Date(dateObj.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const sunriseHour = isWinter ? 7 : 5;
        const sunsetHour = isWinter ? 17 : 20;
        
        // Create fallback times
        const fallbackTimes = {
            Fajr: formatTimeString(sunriseHour - Math.floor(fajrOffset / 60), 30),
            Sunrise: formatTimeString(sunriseHour, 0),
            Dhuhr: formatTimeString(12, 30),
            Asr: formatTimeString(15, 30),
            Sunset: formatTimeString(sunsetHour, 0),
            Maghrib: formatTimeString(sunsetHour, maghribOffset),
            Isha: formatTimeString(sunsetHour + Math.floor(ishaOffset / 60), (ishaOffset % 60)),
            _dstAdjusted: false
        };
        
        console.log("Using fallback prayer times:", fallbackTimes);
        return fallbackTimes;
    }

    // Helper function to format time string for fallback times
    function formatTimeString(hours, minutes) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Update the getRamadanDates function
    async function getRamadanDates(year = 2025) {
        const dates = [];
        
        try {
            // Instead of relying on the API, let's hardcode the Ramadan dates for 2025
            // March 1st is 1 Ramadan 1446
            const startDate = new Date(2025, 2, 1); // Month is 0-based, so 2 is March
            
            // Generate all 30 days of Ramadan
            for (let i = 0; i < 30; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                dates.push(date);
            }
            
            return dates;
        } catch (error) {
            console.error('Error generating Ramadan dates:', error);
            // Fallback to hardcoded dates
            const startDate = new Date(2025, 2, 1); // March 1st, 2025
            for (let i = 0; i < 30; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                dates.push(date);
            }
            return dates;
        }
    }

    // Function to format date as "D MMM"
    function formatDate(date) {
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        return `${day} ${month}`;
    }

    // Function to update UI with prayer times
    function updatePrayerTimes(timings) {
        // Check if timings are already DST-adjusted
        const isAlreadyAdjusted = timings._dstAdjusted === true;
        
        // Remove active class from all prayer times
        document.querySelectorAll('.prayer-time').forEach(el => {
            el.classList.remove('active');
            el.classList.remove('past'); // Reset past status
            el.classList.remove('future'); // Reset future status
            
            // Add checkmark span if it doesn't exist
            if (!el.querySelector('.checkmark')) {
                const checkmark = document.createElement('span');
                checkmark.className = 'checkmark';
                checkmark.innerHTML = '&#xf00c;'; // FontAwesome checkmark
                el.appendChild(checkmark);
            }
        });
        
        // Get current date and time
        const now = new Date();
        const displayedDate = new Date(document.querySelector('.date h1').textContent);
        
        // Set date objects to midnight for date comparison
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);
        
        const displayedMidnight = new Date(displayedDate);
        displayedMidnight.setHours(0, 0, 0, 0);
        
        // Check if displayed date is today, past, or future
        const isToday = todayMidnight.getTime() === displayedMidnight.getTime();
        const isPastDay = displayedMidnight < todayMidnight;
        const isFutureDay = displayedMidnight > todayMidnight;
        
        // If this is a past day, mark all prayers as past
        if (isPastDay) {
            document.querySelectorAll('.prayer-time').forEach(el => {
                el.classList.add('past');
            });
            // Continue with time updates even for past days
        }
        
        // If this is a future day, mark all prayers as future
        if (isFutureDay) {
            document.querySelectorAll('.prayer-time').forEach(el => {
                el.classList.add('future');
            });
            // Continue with time updates even for future days
        }
        
        // Update main times with formatted time
        document.querySelector('.time-block:first-child .time').textContent = 
            formatTime(timings.Fajr, isAlreadyAdjusted);
        document.querySelector('.time-block:last-child .time').textContent = 
            formatTime(timings.Maghrib, isAlreadyAdjusted);

        // Update prayer blocks with formatted time
        const prayerElements = document.querySelectorAll('.prayer-time .time');
        prayerElements[0].textContent = formatTime(timings.Fajr, isAlreadyAdjusted);
        prayerElements[1].textContent = formatTime(timings.Dhuhr, isAlreadyAdjusted);
        prayerElements[2].textContent = formatTime(timings.Asr, isAlreadyAdjusted);
        prayerElements[3].textContent = formatTime(timings.Maghrib, isAlreadyAdjusted);
        prayerElements[4].textContent = formatTime(timings.Isha, isAlreadyAdjusted);
        
        // Update only sunrise time indicator
        const timeIndicators = document.querySelectorAll('.time-indicator .time');
        timeIndicators[0].textContent = formatTime(timings.Sunrise, isAlreadyAdjusted);

        // Handle current day - mark past prayers and set active prayer
        if (isToday) {
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTime = currentHour * 60 + currentMinute;

            // Convert prayer times to minutes for comparison
            const prayers = [
                { name: 'Fajr', time: timings.Fajr, element: prayerElements[0].parentElement },
                { name: 'Dhuhr', time: timings.Dhuhr, element: prayerElements[1].parentElement },
                { name: 'Asr', time: timings.Asr, element: prayerElements[2].parentElement },
                { name: 'Maghrib', time: timings.Maghrib, element: prayerElements[3].parentElement },
                { name: 'Isha', time: timings.Isha, element: prayerElements[4].parentElement }
            ].map(prayer => {
                const [hours, minutes] = prayer.time.split(':');
                const totalMinutes = parseInt(hours) * 60 + parseInt(minutes);
                return { ...prayer, totalMinutes };
            });

            // Find current prayer time and mark past and future prayers
            let currentPrayer = prayers[0]; // Default to Fajr
            let foundActive = false;
            
            for (let i = 0; i < prayers.length; i++) {
                if (currentTime >= prayers[i].totalMinutes) {
                    // This prayer has passed
                    prayers[i].element.classList.add('past');
                    prayers[i].element.classList.remove('future');
                    currentPrayer = prayers[i];
                } else {
                    // This prayer is in the future
                    prayers[i].element.classList.add('future');
                    prayers[i].element.classList.remove('past');
                    // We found the next prayer, so the current one is the previous one
                    foundActive = true;
                    break;
                }
            }
            
            // Mark remaining prayers as future
            if (foundActive) {
                for (let i = prayers.indexOf(currentPrayer) + 2; i < prayers.length; i++) {
                    prayers[i].element.classList.add('future');
                    prayers[i].element.classList.remove('past');
                }
            }
            
            // Add active class to current prayer
            currentPrayer.element.classList.add('active');
            
            // Remove past and future classes from active prayer
            currentPrayer.element.classList.remove('past');
            currentPrayer.element.classList.remove('future');
        }
    }

    // Function to generate table rows for Ramadan
    async function generateRamadanData(latitude, longitude) {
        tbody.innerHTML = ''; // Clear existing rows
        const ramadanDates = await getRamadanDates();
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to midnight for date comparison
        
        // Get the current Asr method from localStorage
        const asrMethod = localStorage.getItem('asrMethod') || 'standard';
        
        for (const date of ramadanDates) {
            const dateStr = date.toISOString().split('T')[0];
            // Pass the current Asr method to getPrayerTimes
            const timings = await getPrayerTimes(latitude, longitude, dateStr);
            const isAlreadyAdjusted = timings._dstAdjusted === true;
            
            const row = document.createElement('tr');
            
            // Check if this date is in the future
            const rowDate = new Date(date);
            rowDate.setHours(0, 0, 0, 0); // Set to midnight for comparison
            if (rowDate > today) {
                row.classList.add('future-date'); // Add class for future dates
            }
            
            // Check if this date is today
            if (rowDate.getTime() === today.getTime()) {
                row.classList.add('current-date'); // Add class for current date
            }
            
            row.innerHTML = `
                <td>${formatDate(date)}</td>
                <td>${formatTime(timings.Fajr, isAlreadyAdjusted)}</td>
                <td>${formatTime(timings.Dhuhr, isAlreadyAdjusted)}</td>
                <td>${formatTime(timings.Asr, isAlreadyAdjusted)}</td>
                <td>${formatTime(timings.Maghrib, isAlreadyAdjusted)}</td>
                <td>${formatTime(timings.Isha, isAlreadyAdjusted)}</td>
            `;
            
            tbody.appendChild(row);
        }
        
        // Add click event listeners to all table cells
        addCellClickHandlers();
        
        // After restoring completed cells, check for fully completed rows
        setTimeout(checkCompletedRows, 100);
    }
    
    // Update the addCellClickHandlers function to fix the animation glitch
    function addCellClickHandlers() {
        const cells = document.querySelectorAll('tbody td');
        
        cells.forEach(cell => {
            // Skip only Date column (1st column)
            const cellIndex = cell.cellIndex;
            if (cellIndex === 0) { // 0-based index, so only skip the first column
                return; // Skip date column
            }
            
            // Skip cells in future date rows
            if (cell.parentElement.classList.contains('future-date')) {
                return; // Skip cells in future dates
            }
            
            // Wrap cell content in a span for animation
            const content = cell.innerHTML;
            cell.innerHTML = `<span class="cell-content">${content}</span>`;
            
            // Add click event listener to each cell
            cell.addEventListener('click', function() {
                const wasCompleted = this.classList.contains('completed');
                
                // Add tactile press animation
                this.classList.add('animate-press');
                setTimeout(() => {
                    this.classList.remove('animate-press');
                }, 300);
                
                // IMPORTANT: First remove any existing celebration to prevent glitches
                const existingCelebration = this.querySelector('.celebration');
                if (existingCelebration) {
                    existingCelebration.remove();
                }
                
                // Toggle completed state
                this.classList.toggle('completed');
                
                // Only show celebration when completing, not when uncompleting
                if (!wasCompleted && this.classList.contains('completed')) {
                    // Small delay to ensure the checkmark is visible first
                    setTimeout(() => createCelebration(this), 50);
                }
                
                // Save completed state to localStorage
                saveCompletedCells();
                
                // Sync with prayer box and localStorage
                syncTableCellWithLocalStorage(this);
            });
        });
    }
    
    // Function to create celebration particles - updated to fix positioning and glitch issues
    function createCelebration(element) {
        // Remove any existing celebration to prevent glitches
        const existingCelebration = element.querySelector('.celebration');
        if (existingCelebration) {
            existingCelebration.remove();
        }
        
        // Create container for particles
        const celebration = document.createElement('div');
        celebration.className = 'celebration';
        element.appendChild(celebration);
        
        // Create particles with better spacing
        const particles = [
            { icon: 'fa-star', delay: 0, size: '14px', tx: -20, ty: -20 },
            { icon: 'fa-moon', delay: 100, size: '12px', tx: 20, ty: -15 },
            { icon: 'fa-star', delay: 200, size: '10px', tx: -15, ty: -25 },
            { icon: 'fa-star', delay: 300, size: '8px', tx: 15, ty: -20 }
        ];
        
        particles.forEach((particle) => {
            const element = document.createElement('i');
            element.className = `fas ${particle.icon}`;
            element.style.fontSize = particle.size;
            
            // Use predefined positions with less randomness for more consistent placement
            const tx = particle.tx + (Math.random() - 0.5) * 10; // Reduced random offset
            const ty = particle.ty + (Math.random() - 0.5) * 10; // Reduced random offset
            const r = (Math.random() - 0.5) * 90; // Reduced rotation range
            
            element.style.setProperty('--tx', `${tx}px`);
            element.style.setProperty('--ty', `${ty}px`);
            element.style.setProperty('--r', `${r}deg`);
            element.style.animationDelay = `${particle.delay}ms`;
            
            celebration.appendChild(element);
        });
        
        // Remove celebration after animation completes
        setTimeout(() => {
            if (celebration && celebration.parentNode) {
                celebration.parentNode.removeChild(celebration);
            }
        }, 1500); // Reduced from 2000ms to prevent overlap with deselection
    }
    
    // Function to save completed cells to localStorage
    function saveCompletedCells() {
        const completedCells = [];
        document.querySelectorAll('tbody td.completed').forEach((cell, index) => {
            // Get row and column index for identification
            const rowIndex = cell.parentElement.rowIndex - 1; // -1 because of thead
            const cellIndex = cell.cellIndex;
            completedCells.push(`${rowIndex}-${cellIndex}`);
        });
        
        localStorage.setItem('ramadanCompletedCells', JSON.stringify(completedCells));
        
        // Check for fully completed rows
        checkCompletedRows();
    }
    
    // Function to restore completed cells from localStorage
    function restoreCompletedCells() {
        const savedCells = localStorage.getItem('ramadanCompletedCells');
        if (savedCells) {
            const completedCells = JSON.parse(savedCells);
            completedCells.forEach(cellId => {
                const [rowIndex, cellIndex] = cellId.split('-');
                const cell = document.querySelector(`tbody tr:nth-child(${parseInt(rowIndex) + 1}) td:nth-child(${parseInt(cellIndex) + 1})`);
                if (cell) {
                    cell.classList.add('completed');
                }
            });
        }
    }

    // Add a new function to check for rows with all prayers completed
    function checkCompletedRows() {
        const rows = document.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            // Skip future dates
            if (row.classList.contains('future-date')) {
                return;
            }
            
            // Get all prayer cells in this row (columns 2-6)
            const prayerCells = row.querySelectorAll('td:nth-child(2), td:nth-child(3), td:nth-child(4), td:nth-child(5), td:nth-child(6)');
            
            // Check if all prayer cells are completed
            let allCompleted = true;
            prayerCells.forEach(cell => {
                if (!cell.classList.contains('completed')) {
                    allCompleted = false;
                }
            });
            
            // Add or remove the all-completed class based on the check
            if (allCompleted && prayerCells.length > 0) {
                row.classList.add('all-completed');
            } else {
                row.classList.remove('all-completed');
            }
        });
    }

    // Function to setup date navigation
    function setupDateNavigation() {
        const prevDateBtn = document.querySelector('.prev-date');
        const nextDateBtn = document.querySelector('.next-date');
        const header = document.querySelector('.header');
        let currentDate = new Date();
        
        // Update displayed date with animation
        async function updateDisplayedDate(direction) {
            // Add animation class based on direction
            header.classList.remove('animate-left', 'animate-right');
            void header.offsetWidth; // Force reflow to restart animation
            
            if (direction === 'prev') {
                header.classList.add('animate-left');
            } else if (direction === 'next') {
                header.classList.add('animate-right');
            }
            
            // Set Gregorian date
            const gregorianDate = currentDate.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            document.querySelector('.date h1').textContent = gregorianDate;
            
            // Get the date string for API calls
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // IMPORTANT: Force Ramadan display for March 2024
            const month = currentDate.getMonth();
            const day = currentDate.getDate();
            const year = currentDate.getFullYear();
            
            // Direct hardcoded check for Ramadan 2024
            if (year === 2024 && month === 2 && day >= 1 && day <= 31) {
                document.querySelector('.date p').textContent = `${day} Ramadan 1445 AH`;
            } 
            // April 2024 (continuation of Ramadan)
            else if (year === 2024 && month === 3 && day <= 9) {
                const ramadanDay = day + 31;
                if (ramadanDay <= 30) {
                    document.querySelector('.date p').textContent = `${ramadanDay} Ramadan 1445 AH`;
                } else {
                    const shawwalDay = ramadanDay - 30;
                    document.querySelector('.date p').textContent = `${shawwalDay} Shawwal 1445 AH`;
                }
            }
            // Ramadan 2025
            else if (year === 2025 && month === 2 && day >= 1 && day <= 30) {
                document.querySelector('.date p').textContent = `${day} Ramadan 1446 AH`;
            }
            // For other dates, use the API
            else {
                try {
                    const islamicDate = await getHijriDate(dateStr);
                    document.querySelector('.date p').textContent = islamicDate;
                } catch (error) {
                    console.error('Error getting Hijri date:', error);
                    document.querySelector('.date p').textContent = "Islamic Date";
                }
            }
            
            // Use stored coordinates instead of requesting them again
            const storedCoords = localStorage.getItem('userCoordinates');
            let coordinates;
            
            if (storedCoords) {
                coordinates = JSON.parse(storedCoords);
            } else {
                coordinates = await getUserLocation();
            }
            
            // Update prayer times for the selected date using stored coordinates
            const timings = await getPrayerTimes(coordinates.lat, coordinates.lng, dateStr);
            updatePrayerTimes(timings);
            
            // Update progress bar after prayer times are updated
            setTimeout(() => {
                updateProgressBar();
                restorePrayerBoxStates(); // Restore prayer box states for the new date
            }, 100);
            
            // Reset progress bar animation state
            const progressBar = document.querySelector('.progress');
            progressBar.classList.remove('animated');
        }
        
        // Make sure to remove any existing event listeners before adding new ones
        prevDateBtn.removeEventListener('click', prevDateHandler);
        nextDateBtn.removeEventListener('click', nextDateHandler);
        
        // Define handlers as named functions so they can be removed if needed
        function prevDateHandler() {
            currentDate.setDate(currentDate.getDate() - 1);
            updateDisplayedDate('prev');
        }
        
        function nextDateHandler() {
            currentDate.setDate(currentDate.getDate() + 1);
            updateDisplayedDate('next');
        }
        
        // Add event listeners
        prevDateBtn.addEventListener('click', prevDateHandler);
        nextDateBtn.addEventListener('click', nextDateHandler);
        
        // Remove animation classes after animations complete
        header.addEventListener('animationend', function(e) {
            // Only remove classes when the last staggered animation finishes
            if (e.target.classList.contains('prayer-blocks')) {
                setTimeout(() => {
                    header.classList.remove('animate-left', 'animate-right');
                }, 50);
            }
        });
        
        // Add swipe gesture support for mobile
        setupSwipeGestures(header, prevDateHandler, nextDateHandler);
        
        // Initial call without animation
        updateDisplayedDate();
        
        // Return the update function so it can be called from elsewhere if needed
        return updateDisplayedDate;
    }

    // Function to setup swipe gestures for mobile
    function setupSwipeGestures(element, onSwipeLeft, onSwipeRight) {
        let touchStartX = 0;
        let touchEndX = 0;
        const minSwipeDistance = 50; // Minimum distance required for a swipe
        
        // Add touch event listeners
        element.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        element.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
        
        // Function to determine swipe direction and trigger appropriate handler
        function handleSwipe() {
            const swipeDistance = touchEndX - touchStartX;
            
            // Check if swipe distance exceeds minimum threshold
            if (Math.abs(swipeDistance) >= minSwipeDistance) {
                if (swipeDistance > 0) {
                    // Swipe right (previous date)
                    onSwipeLeft();
                } else {
                    // Swipe left (next date)
                    onSwipeRight();
                }
            }
        }
    }

    // Update the initialize function to ensure correct Hijri date display
    async function initialize() {
        // Get user coordinates with fallback to defaults - this should only happen once
        const coordinates = await getUserLocation();
        
        // Store coordinates in localStorage for future use
        localStorage.setItem('userCoordinates', JSON.stringify(coordinates));
        
        // Use actual today's date for the header
        const realToday = new Date();
        const todayStr = realToday.toISOString().split('T')[0];
        
        // Check for DST and set adjustment
        dstAdjustment = calculateDSTAdjustment(realToday);
        dstDetected = dstAdjustment !== 0;
        
        // Set Gregorian date
        const gregorianDate = realToday.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        document.querySelector('.date h1').textContent = gregorianDate;
        
        // Get Hijri date using our updated function
        try {
            const islamicDate = await getHijriDate(todayStr);
            document.querySelector('.date p').textContent = islamicDate;
        } catch (error) {
            console.error('Error setting Hijri date:', error);
            // Fallback to a simple message if there's an error
            document.querySelector('.date p').textContent = "Islamic Date";
        }
        
        // Get prayer times for today using user's coordinates
        const timings = await getPrayerTimes(coordinates.lat, coordinates.lng, todayStr);
        updatePrayerTimes(timings);
        await generateRamadanData(coordinates.lat, coordinates.lng);
        
        // Restore completed cells from localStorage
        restoreCompletedCells();
        
        // Setup date navigation - ensure this is called before other UI interactions
        setupDateNavigation();
        
        // Setup prayer box interactions
        setupPrayerBoxInteractions();
        
        // Reset animation state for progress bar
        const progressBar = document.querySelector('.progress');
        progressBar.classList.remove('animated');
        
        // Update progress bar
        updateProgressBar();
        
        // Add these lines at the end of the initialize function
        setupTableScrollIndicators();
        setupMobileLayout();
        
        // Add resize listener with debounce for better performance
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                setupMobileLayout();
            }, 250);
        });

        // Add this function to the end of your initialize function
        function setupMobilePulseAnimation() {
            // Create pulse elements for all prayer times
            document.querySelectorAll('.prayer-time').forEach(prayer => {
                // Create container
                const pulseContainer = document.createElement('div');
                pulseContainer.className = 'pulse-container';
                
                // Create dot
                const pulseDot = document.createElement('div');
                pulseDot.className = 'pulse-dot';
                
                // Create animation
                const pulseAnimation = document.createElement('div');
                pulseAnimation.className = 'pulse-animation';
                
                // Add to container
                pulseContainer.appendChild(pulseDot);
                pulseContainer.appendChild(pulseAnimation);
                
                // Add to prayer box
                prayer.appendChild(pulseContainer);
            });
        }

        // Call this function at the end of your initialize function
        setupMobilePulseAnimation();
    }

    // Show location overlay if no coordinates are stored
    function checkLocationPermission() {
        const storedCoords = localStorage.getItem('userCoordinates');
        
        if (!storedCoords) {
            // Show the location overlay
            locationOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        } else {
            // If we already have coordinates, proceed with initialization
            initialize();
        }
    }
    
    // Handle location permission buttons
    allowLocationBtn.addEventListener('click', function() {
        if (navigator.geolocation) {
            // Show loading state
            this.textContent = 'Getting location...';
            this.disabled = true;
            
            navigator.geolocation.getCurrentPosition(
                // Success callback
                function(position) {
                    const coordinates = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    // Store coordinates in localStorage
                    localStorage.setItem('userCoordinates', JSON.stringify(coordinates));
                    
                    // Hide overlay and initialize app
                    locationOverlay.classList.remove('active');
                    document.body.style.overflow = '';
                    initialize();
                },
                // Error callback
                function(error) {
                    console.error('Error getting location:', error);
                    allowLocationBtn.textContent = 'Allow Location Access';
                    allowLocationBtn.disabled = false;
                    
                    // Show error message
                    alert('Unable to get your location. Please try again or use the default location.');
                },
                // Options
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            alert('Geolocation is not supported by your browser. Please use the default location or enter coordinates manually.');
        }
    });
    
    // Handle default location button
    defaultLocationBtn.addEventListener('click', function() {
        const defaultCoords = getDefaultCoordinates();
        localStorage.setItem('userCoordinates', JSON.stringify(defaultCoords));
        
        // Hide overlay and initialize app
        locationOverlay.classList.remove('active');
        document.body.style.overflow = '';
        initialize();
    });
    
    // Handle change location button in settings
    changeLocationBtn.addEventListener('click', function() {
        // Close settings dropdown
        document.querySelector('.settings-dropdown').classList.remove('active');
        
        // Show location overlay
        locationOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // No need to pre-fill coordinates anymore since we removed that option
    });

    // Start the application by checking location permission first
    checkLocationPermission();

    // Update progress bar based on current time and selected date
    function updateProgressBar() {
        const now = new Date();
        const currentDate = new Date(document.querySelector('.date h1').textContent);
        const sehrTime = document.querySelector('.time-block:first-child .time').textContent;
        const iftarTime = document.querySelector('.time-block:last-child .time').textContent;
        
        const sehrDate = new Date(currentDate.toDateString() + ' ' + sehrTime);
        const iftarDate = new Date(currentDate.toDateString() + ' ' + iftarTime);
        
        let progress = 0;
        
        // Check if the displayed date is today, past, or future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const displayedDate = new Date(currentDate);
        displayedDate.setHours(0, 0, 0, 0);
        
        if (displayedDate.getTime() < today.getTime()) {
            // Past date - show 100% progress
            progress = 100;
        } else if (displayedDate.getTime() > today.getTime()) {
            // Future date - show 0% progress
            progress = 0;
        } else {
            // Current date - calculate actual progress
            const totalDuration = iftarDate - sehrDate;
            const elapsed = now - sehrDate;
            progress = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
        }
        
        const progressBar = document.querySelector('.progress');
        
        // Set the target progress as a CSS variable
        progressBar.style.setProperty('--target-progress', `${progress}%`);
        
        // For mobile view, directly set width
        if (document.body.classList.contains('mobile-view')) {
            progressBar.style.width = `${progress}%`;
        } else {
            // If this is the initial load and animation hasn't run yet
            if (!progressBar.classList.contains('animated')) {
                // First set width to 0
                progressBar.style.width = '0%';
                
                // Add animation class after a small delay
                setTimeout(() => {
                    progressBar.classList.add('animate');
                    progressBar.classList.add('animated'); // Mark as animated
                }, 300); // Small delay for better visual effect
            } else {
                // For subsequent updates, just set the width directly
                progressBar.style.width = `${progress}%`;
            }
        }
    }

    // Update progress bar every minute
    setInterval(updateProgressBar, 60000);
    updateProgressBar();

    // Improve the gregorianToHijri function with more accurate calculations
    function gregorianToHijri(date) {
        // This is a more accurate algorithm for Gregorian to Hijri conversion
        // Based on the Umm al-Qura calendar calculation
        
        const jd = gregorianToJulian(date);
        const l = jd - 1948440 + 10632;
        const n = Math.floor((l - 1) / 10631);
        const l1 = l - 10631 * n + 354;
        const j = Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) + Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
        const l2 = l1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
        const m = Math.floor((24 * l2) / 709);
        const d = l2 - Math.floor((709 * m) / 24);
        const y = 30 * n + j - 30;
        
        const islamicMonths = [
            "Muharram", "Safar", "Rabi Al-Awwal", "Rabi Al-Thani",
            "Jumada Al-Awwal", "Jumada Al-Thani", "Rajab", "Sha'ban",
            "Ramadan", "Shawwal", "Dhu Al-Qi'dah", "Dhu Al-Hijjah"
        ];
        
        return {
            day: d,
            month: islamicMonths[m - 1],
            year: y
        };
    }

    // Helper function to convert Gregorian date to Julian day
    function gregorianToJulian(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        let a = Math.floor((14 - month) / 12);
        let y = year + 4800 - a;
        let m = month + 12 * a - 3;
        
        let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
        
        return jd;
    }

    // Update the prayer box click handler to add tactile animation
    function setupPrayerBoxInteractions() {
        const prayerBoxes = document.querySelectorAll('.prayer-time');
        
        prayerBoxes.forEach(box => {
            // Add checkmark element if it doesn't exist
            if (!box.querySelector('.checkmark-icon')) {
                const checkmark = document.createElement('span');
                checkmark.className = 'checkmark-icon';
                checkmark.innerHTML = '&#xf00c;'; // FontAwesome checkmark
                box.appendChild(checkmark);
            }
            
            // Add click handler
            box.addEventListener('click', function() {
                const wasCompleted = this.classList.contains('completed');
                
                // Add tactile press animation
                this.classList.add('animate-press');
                setTimeout(() => {
                    this.classList.remove('animate-press');
                }, 300);
                
                // If unchecking, remove celebration first
                if (wasCompleted) {
                    const existingCelebration = this.querySelector('.celebration');
                    if (existingCelebration) {
                        existingCelebration.remove();
                    }
                }
                
                // Toggle completed state
                this.classList.toggle('completed');
                
                // Only show celebration when completing, not when uncompleting
                if (!wasCompleted) {
                    // Small delay to ensure the checkmark is visible first
                    setTimeout(() => createCelebration(this), 50);
                }
                
                // Save completed state to localStorage
                savePrayerBoxStates();
                
                // Sync with table cell
                syncPrayerBoxWithTableCell(this);
            });
        });
        
        // Restore states from localStorage
        restorePrayerBoxStates();
    }

    // Function to sync prayer box with corresponding table cell
    function syncPrayerBoxWithTableCell(prayerBox) {
        // Get the prayer name (e.g., "FAJR", "ASR")
        const prayerName = prayerBox.querySelector('.label').textContent.trim();
        
        // Get the current date from the header
        const currentDate = document.querySelector('.date h1').textContent;
        const formattedDate = formatDateForTable(new Date(currentDate));
        
        // Find the corresponding row in the table
        const tableRows = document.querySelectorAll('tbody tr');
        let targetRow = null;
        
        for (const row of tableRows) {
            const dateCell = row.querySelector('td:first-child');
            if (dateCell && dateCell.textContent.trim() === formattedDate) {
                targetRow = row;
                break;
            }
        }
        
        if (targetRow) {
            // Find the corresponding cell based on prayer name
            let cellIndex = -1;
            
            switch (prayerName) {
                case 'FAJR':
                    cellIndex = 1; // 2nd column (0-indexed)
                    break;
                case 'ZUHR':
                    cellIndex = 2; // 3rd column
                    break;
                case 'ASR':
                    cellIndex = 3; // 4th column
                    break;
                case 'MAGHRIB':
                    cellIndex = 4; // 5th column
                    break;
                case 'ISHA':
                    cellIndex = 5; // 6th column
                    break;
            }
            
            if (cellIndex >= 0) {
                const cell = targetRow.querySelector(`td:nth-child(${cellIndex + 1})`);
                if (cell) {
                    // Update cell state to match prayer box
                    if (prayerBox.classList.contains('completed')) {
                        cell.classList.add('completed');
                    } else {
                        cell.classList.remove('completed');
                    }
                    
                    // Save completed cells to localStorage
                    saveCompletedCells();
                }
            }
        }
    }

    // Function to format date for table comparison
    function formatDateForTable(date) {
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        return `${day} ${month}`;
    }

    // Function to save prayer box states - FIXED to use unique identifiers
    function savePrayerBoxStates() {
        const completedBoxes = [];
        document.querySelectorAll('.prayer-time.completed').forEach((box, index) => {
            // Get the prayer name for identification
            const prayerName = box.querySelector('.label').textContent;
            const date = document.querySelector('.date h1').textContent;
            completedBoxes.push(`${date}-${prayerName}`);
        });
        
        // Get existing saved states
        const existingSavedBoxes = localStorage.getItem('ramadanCompletedPrayers');
        let allCompletedBoxes = [];
        
        if (existingSavedBoxes) {
            // Parse existing saved states
            const existingBoxes = JSON.parse(existingSavedBoxes);
            
            // Get current date
            const currentDate = document.querySelector('.date h1').textContent;
            
            // Filter out any existing entries for the current date
            allCompletedBoxes = existingBoxes.filter(entry => {
                // Extract date part from the entry
                const entryDate = entry.split('-')[0];
                // Keep entries that don't match the current date
                return entryDate !== currentDate;
            });
        }
        
        // Add current day's completed prayers
        allCompletedBoxes = [...allCompletedBoxes, ...completedBoxes];
        
        // Save all completed prayers back to localStorage
        localStorage.setItem('ramadanCompletedPrayers', JSON.stringify(allCompletedBoxes));
    }

    // Function to restore prayer box states
    function restorePrayerBoxStates() {
        const savedBoxes = localStorage.getItem('ramadanCompletedPrayers');
        if (savedBoxes) {
            const completedBoxes = JSON.parse(savedBoxes);
            const currentDate = document.querySelector('.date h1').textContent;
            
            // Reset all prayer boxes first
            document.querySelectorAll('.prayer-time').forEach(box => {
                box.classList.remove('completed');
            });
            
            // Then apply completed state only to those matching current date
            document.querySelectorAll('.prayer-time').forEach(box => {
                const prayerName = box.querySelector('.label').textContent;
                if (completedBoxes.includes(`${currentDate}-${prayerName}`)) {
                    box.classList.add('completed');
                }
            });
        }
    }

    // Function to sync table cell with prayer box state in localStorage
    function syncTableCellWithLocalStorage(cell) {
        // Get the row and column index
        const row = cell.parentElement;
        const cellIndex = cell.cellIndex;
        
        // Get the date from the first cell in the row
        const dateText = row.querySelector('td:first-child').textContent.trim();
        const dateObj = parseTableDateFormat(dateText);
        
        if (!dateObj) return; // Invalid date format
        
        // Format the date to match the format stored in localStorage
        const fullDateStr = dateObj.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        // Determine which prayer based on cell index
        let prayerName = '';
        
        switch (cellIndex) {
            case 1: // 2nd column (0-indexed)
                prayerName = 'FAJR';
                break;
            case 2: // 3rd column
                prayerName = 'ZUHR';
                break;
            case 3: // 4th column
                prayerName = 'ASR';
                break;
            case 4: // 5th column
                prayerName = 'MAGHRIB';
                break;
            case 5: // 6th column
                prayerName = 'ISHA';
                break;
            default:
                return; // Not a prayer cell
        }
        
        // Create the key used in localStorage
        const storageKey = `${fullDateStr}-${prayerName}`;
        
        // Get existing saved states
        const existingSavedBoxes = localStorage.getItem('ramadanCompletedPrayers');
        if (!existingSavedBoxes) return;
        
        let completedBoxes = JSON.parse(existingSavedBoxes);
        
        // If cell is completed, add to localStorage if not already there
        if (cell.classList.contains('completed')) {
            if (!completedBoxes.includes(storageKey)) {
                completedBoxes.push(storageKey);
            }
        } else {
            // If cell is not completed, remove from localStorage
            completedBoxes = completedBoxes.filter(key => key !== storageKey);
        }
        
        // Save back to localStorage
        localStorage.setItem('ramadanCompletedPrayers', JSON.stringify(completedBoxes));
        
        // If this is the current displayed date, update the prayer box UI
        const currentDate = document.querySelector('.date h1').textContent;
        if (fullDateStr === currentDate) {
            restorePrayerBoxStates();
        }
        
        // After updating localStorage, check for completed rows
        checkCompletedRows();
    }

    // Helper function to parse date from table format (e.g., "1 Mar") to Date object
    function parseTableDateFormat(dateText) {
        try {
            const [day, monthShort] = dateText.split(' ');
            const currentYear = new Date().getFullYear();
            
            // Map of short month names to month numbers (0-based)
            const monthMap = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };
            
            // For Ramadan 2025 (March 1-30)
            const month = monthMap[monthShort];
            const year = (month === 2 && parseInt(day) >= 1 && parseInt(day) <= 30) ? 2025 : currentYear;
            
            return new Date(year, month, parseInt(day));
        } catch (e) {
            console.error('Error parsing date:', e);
            return null;
        }
    }

    // Add these functions to improve mobile experience

    // Function to handle horizontal scroll indicators
    function setupTableScrollIndicators() {
        const tableContainer = document.querySelector('.table-container');
        
        // Add scroll event listener to table container
        tableContainer.addEventListener('scroll', function() {
            // Calculate scroll position
            const scrollLeft = this.scrollLeft;
            const maxScroll = this.scrollWidth - this.clientWidth;
            
            // Add classes based on scroll position
            if (scrollLeft > 5) {
                this.classList.add('scrolled-right');
            } else {
                this.classList.remove('scrolled-right');
            }
            
            if (scrollLeft < maxScroll - 5) {
                this.classList.add('scrolled-left');
            } else {
                this.classList.remove('scrolled-left');
            }
        });
        
        // Trigger scroll event once to set initial state
        tableContainer.dispatchEvent(new Event('scroll'));
    }

    // Function to adjust header position for mobile
    function setupMobileLayout() {
        // Check if we're on mobile
        const isMobile = window.innerWidth <= 768;
        
        // Get elements
        const header = document.querySelector('.header');
        const container = document.querySelector('.container');
        const tableContainer = document.querySelector('.table-container');
        
        if (isMobile) {
            // Reset all inline styles first
            header.style = '';
            tableContainer.style.marginTop = '0';
            
            // Remove scroll event listener to prevent header movement on scroll
            window.removeEventListener('scroll', headerScrollHandler);
            
            // Add mobile-specific class
            document.body.classList.add('mobile-view');
            
            // Make header position static to prevent it from moving during scroll
            header.style.position = 'relative';
            header.style.transform = 'none';
            header.style.left = 'auto';
            header.style.top = 'auto';
            header.style.width = '100%';
            header.style.maxWidth = 'none';
            header.style.marginBottom = '10px';
            
            // Fix prayer blocks layout
            const prayerBlocks = document.querySelector('.prayer-blocks');
            prayerBlocks.style.display = 'flex';
            prayerBlocks.style.flexDirection = 'column';
            
            // Fix main times layout with better spacing
            const mainTimes = document.querySelector('.main-times');
            mainTimes.style.display = 'flex';
            mainTimes.style.flexDirection = 'row';
            mainTimes.style.justifyContent = 'space-between';
            mainTimes.style.position = 'relative';
            mainTimes.style.height = window.innerWidth <= 480 ? '70px' : '80px';
            mainTimes.style.margin = '25px 0';
            
            // Fix time blocks with better positioning
            const timeBlocks = document.querySelectorAll('.time-block');
            timeBlocks.forEach((block, index) => {
                block.style.width = 'auto';
                block.style.textAlign = index === 0 ? 'left' : 'right';
                block.style.zIndex = '2';
                block.style.position = 'relative';
                
                // Get the time and label elements
                const timeElement = block.querySelector('.time');
                const labelElement = block.querySelector('.label');
                
                // Style the time element with background to prevent overlap
                timeElement.style.fontSize = window.innerWidth <= 480 ? '24px' : '28px';
                timeElement.style.fontWeight = '500';
                timeElement.style.display = 'inline-block';
                timeElement.style.marginTop = window.innerWidth <= 480 ? '4px' : '5px';
                timeElement.style.backgroundColor = 'var(--card-bg)';
                timeElement.style.padding = '0 5px';
                timeElement.style.zIndex = '3';
                
                // Style the label element with background to prevent overlap
                labelElement.style.display = 'inline-block';
                labelElement.style.marginBottom = window.innerWidth <= 480 ? '6px' : '8px';
                labelElement.style.backgroundColor = 'var(--card-bg)';
                labelElement.style.padding = '0 5px';
                labelElement.style.zIndex = '3';
            });
            
            // Fix progress bar with better positioning
            const progressBar = document.querySelector('.progress-bar');
            progressBar.style.position = 'absolute';
            progressBar.style.left = window.innerWidth <= 480 ? '2%' : '5%';
            progressBar.style.right = window.innerWidth <= 480 ? '2%' : '5%';
            progressBar.style.width = window.innerWidth <= 480 ? '96%' : '90%';
            progressBar.style.top = '50%';
            progressBar.style.transform = window.innerWidth <= 480 ? 'translateY(15px)' : 'translateY(10px)';
            progressBar.style.height = '6px';
            progressBar.style.backgroundColor = 'var(--border-color)';
            progressBar.style.borderRadius = '3px';
            progressBar.style.zIndex = '1';
            
            // Fix the progress indicator
            const progress = document.querySelector('.progress');
            if (progress) {
                progress.style.position = 'absolute';
                progress.style.height = '100%';
                progress.style.backgroundColor = 'var(--accent-color)';
                progress.style.left = '0';
                progress.style.top = '0';
                progress.style.minWidth = '6px';
                progress.style.borderRadius = '3px';
                progress.style.zIndex = '1';
                
                // Force progress bar to update
                updateProgressBar();
            }
        } else {
            // Reset to original styles for desktop
            document.body.classList.remove('mobile-view');
            
            // Remove scroll event listener
            window.removeEventListener('scroll', headerScrollHandler);
            
            // Reset all styles
            header.style = '';
            header.style.position = 'relative';
            header.style.left = 'auto';
            header.style.top = 'auto';
            header.style.transform = 'none';
            header.style.width = 'calc(100% - 40px)';
            header.style.maxWidth = '1160px';
            header.style.marginBottom = '20px';
            
            // Reset table container margin
            tableContainer.style.marginTop = '20px';
            
            // Reset all other elements
            document.querySelectorAll('.prayer-blocks, .main-times, .progress-bar, .progress, .time-block, .time-block .time, .time-block .label')
                .forEach(el => el.style = '');
        }
    }

    // Add this function to get the user's location
    function getUserLocation() {
        return new Promise((resolve, reject) => {
            // First check if we already have stored coordinates
            const storedCoords = localStorage.getItem('userCoordinates');
            if (storedCoords) {
                resolve(JSON.parse(storedCoords));
                return;
            }
            
            // If no stored coordinates, show the location permission dialog
            locationOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // We'll resolve this promise when the user makes a choice
            // The event listeners for the location buttons will handle this
            // For now, resolve with default coordinates to prevent hanging
            const defaultCoords = getDefaultCoordinates();
            resolve(defaultCoords);
        });
    }

    // Update the getHijriDate function with correct Ramadan 2024 dates
    async function getHijriDate(dateStr) {
        console.log(`Getting Hijri date for: ${dateStr}, Date object:`, new Date(dateStr));
        try {
            // Get user coordinates from localStorage
            const storedCoords = localStorage.getItem('userCoordinates');
            let coordinates = getDefaultCoordinates(); // Default coordinates
            
            if (storedCoords) {
                coordinates = JSON.parse(storedCoords);
            }
            
            // Parse the date string to check if it's in Ramadan
            const date = new Date(dateStr);
            
            // IMPORTANT: For March 1, 2024 - this is 1 Ramadan 1445 AH in many countries
            // This is a hardcoded special case for North America and many other regions
            if (date.getFullYear() === 2024 && date.getMonth() === 2 && date.getDate() >= 1 && date.getDate() <= 31) {
                return `${date.getDate()} Ramadan 1445 AH`;
            }
            
            // For April 2024 (continuation of Ramadan 2024)
            if (date.getFullYear() === 2024 && date.getMonth() === 3 && date.getDate() <= 9) {
                const ramadanDay = date.getDate() + 31; // April 1 is 32 Ramadan (not possible, but we'll handle this)
                if (ramadanDay <= 30) {
                    return `${ramadanDay} Ramadan 1445 AH`;
                } else {
                    // After Ramadan ends (30 days), it's Shawwal
                    const shawwalDay = ramadanDay - 30;
                    return `${shawwalDay} Shawwal 1445 AH`;
                }
            }
            
            // For next year - Ramadan 2025 (March 1-30, 2025)
            if (date.getFullYear() === 2025 && date.getMonth() === 2 && date.getDate() >= 1 && date.getDate() <= 30) {
                return `${date.getDate()} Ramadan 1446 AH`;
            }
            
            // Include latitude, longitude, and method in the API request for location-specific Hijri date
            // Method 3 is Muslim World League, which is widely accepted
            const response = await fetch(`https://api.aladhan.com/v1/gToH?date=${dateStr}&latitude=${coordinates.lat}&longitude=${coordinates.lng}&method=3&adjustment=1`);
            const data = await response.json();
            
            if (data.code === 200 && data.data) {
                const hijri = data.data.hijri;
                const islamicDate = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
                return islamicDate;
            } else {
                throw new Error('Invalid API response');
            }
        } catch (error) {
            console.error('Error fetching Hijri date:', error);
            
            // Fallback to local calculation
            const date = new Date(dateStr);
            
            // Check for Ramadan 2024 in fallback as well
            if (date.getFullYear() === 2024 && date.getMonth() === 2 && date.getDate() >= 1 && date.getDate() <= 31) {
                return `${date.getDate()} Ramadan 1445 AH`;
            }
            
            // For April 2024 (continuation of Ramadan 2024)
            if (date.getFullYear() === 2024 && date.getMonth() === 3 && date.getDate() <= 9) {
                const ramadanDay = date.getDate() + 31;
                if (ramadanDay <= 30) {
                    return `${ramadanDay} Ramadan 1445 AH`;
                } else {
                    const shawwalDay = ramadanDay - 30;
                    return `${shawwalDay} Shawwal 1445 AH`;
                }
            }
            
            // Check for Ramadan 2025 in fallback as well
            if (date.getFullYear() === 2025 && date.getMonth() === 2 && date.getDate() >= 1 && date.getDate() <= 30) {
                return `${date.getDate()} Ramadan 1446 AH`;
            }
            
            const hijriDate = gregorianToHijri(date);
            const islamicDate = `${hijriDate.day} ${hijriDate.month} ${hijriDate.year} AH`;
            return islamicDate;
        }
    }
}); 