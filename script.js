document.addEventListener('DOMContentLoaded', function() {
    const tbody = document.querySelector('tbody');
    const container = document.querySelector('.container');
    
    // Theme Toggle Functionality
    const themeToggle = document.querySelector('.theme-button');
    const root = document.documentElement;
    const overlay = document.querySelector('.theme-transition-overlay');
    
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
    
    // Initialize time format from localStorage or default to 12-hour
    let timeFormat = localStorage.getItem('timeFormat') || '12';
    document.querySelector(`input[name="timeFormat"][value="${timeFormat}"]`).checked = true;
    
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
    
    // Function to format time based on selected format
    function formatTime(timeStr) {
        if (!timeStr) return '';
        
        // Parse the time string (assuming format like "04:30" or "16:45")
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        
        if (timeFormat === '24') {
            // Return 24-hour format
            return `${hours}:${minutes}`;
        } else {
            // Convert to 12-hour format with AM/PM
            const period = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
            return `${hour12}:${minutes} ${period}`;
        }
    }
    
    // Function to update all displayed times
    function updateAllDisplayedTimes() {
        // Update table cells
        document.querySelectorAll('tbody td:not(:first-child)').forEach(cell => {
            const timeText = cell.textContent.trim();
            if (timeText && timeText.includes(':')) {
                // Extract just the time part if it has AM/PM
                const timePart = timeText.split(' ')[0];
                cell.textContent = formatTime(timePart);
            }
        });
        
        // Update prayer times in header
        document.querySelectorAll('.time').forEach(timeElement => {
            const timeText = timeElement.textContent.trim();
            if (timeText && timeText.includes(':')) {
                // Extract just the time part if it has AM/PM
                const timePart = timeText.split(' ')[0];
                timeElement.textContent = formatTime(timePart);
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

    // Function to get prayer times
    async function getPrayerTimes(latitude, longitude, date) {
        const response = await fetch(`https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=2`);
        const data = await response.json();
        return data.data.timings;
    }

    // Update the getRamadanDates function
    async function getRamadanDates(year = 2025) {
        // Hardcode the start date for Ramadan 2025 (March 1st)
        // We'll use this as a fallback if the API fails
        const startDate = new Date(2025, 2, 1); // Month is 0-based, so 2 is March
        const dates = [];
        
        try {
            const response = await fetch(`https://api.aladhan.com/v1/hijriCalendar/1446/9`);
            const data = await response.json();
            
            if (data.code === 200 && data.data && data.data.length > 0) {
                // Use API date if available
                const apiStartDate = new Date(data.data[0].gregorian.date);
                // Generate 30 days of Ramadan using API date
                for (let i = 0; i < 30; i++) {
                    const date = new Date(apiStartDate);
                    date.setDate(apiStartDate.getDate() + i);
                    dates.push(date);
                }
            } else {
                // Fallback to hardcoded date if API fails
                for (let i = 0; i < 30; i++) {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    dates.push(date);
                }
            }
        } catch (error) {
            console.error('Error fetching Ramadan dates:', error);
            // Fallback to hardcoded date if API fails
            for (let i = 0; i < 30; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                dates.push(date);
            }
        }
        
        return dates;
    }

    // Function to format date as "D MMM"
    function formatDate(date) {
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        return `${day} ${month}`;
    }

    // Function to update UI with prayer times
    function updatePrayerTimes(timings) {
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
            return; // No need to continue with time-specific logic for past days
        }
        
        // If this is a future day, mark all prayers as future
        if (isFutureDay) {
            document.querySelectorAll('.prayer-time').forEach(el => {
                el.classList.add('future');
            });
            return; // No need to continue with time-specific logic for future days
        }
        
        // Update main times with formatted time
        document.querySelector('.time-block:first-child .time').textContent = formatTime(timings.Fajr);
        document.querySelector('.time-block:last-child .time').textContent = formatTime(timings.Maghrib);

        // Update prayer blocks with formatted time
        const prayerElements = document.querySelectorAll('.prayer-time .time');
        prayerElements[0].textContent = formatTime(timings.Fajr);
        prayerElements[1].textContent = formatTime(timings.Dhuhr);
        prayerElements[2].textContent = formatTime(timings.Asr);
        prayerElements[3].textContent = formatTime(timings.Maghrib);
        prayerElements[4].textContent = formatTime(timings.Isha);
        
        // Update only sunrise time indicator
        const timeIndicators = document.querySelectorAll('.time-indicator .time');
        timeIndicators[0].textContent = formatTime(timings.Sunrise);

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
        const ramadanStartDate = new Date(2025, 2, 1); // March 1st, 2025
        const ramadanEndDate = new Date(2025, 2, 30); // March 30th, 2025
        
        for (const date of ramadanDates) {
            const dateStr = date.toISOString().split('T')[0];
            const timings = await getPrayerTimes(latitude, longitude, dateStr);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(date)}</td>
                <td>${formatTime(timings.Fajr)}</td>
                <td>${formatTime(timings.Fajr)}</td>
                <td>${formatTime(timings.Dhuhr)}</td>
                <td>${formatTime(timings.Asr)}</td>
                <td>${formatTime(timings.Maghrib)}</td>
                <td>${formatTime(timings.Maghrib)}</td>
                <td>${formatTime(timings.Isha)}</td>
            `;
            
            // Only highlight if today is within Ramadan 2025 and matches the current date
            if (today >= ramadanStartDate && today <= ramadanEndDate && 
                date.getDate() === today.getDate() && 
                date.getMonth() === today.getMonth() && 
                date.getFullYear() === today.getFullYear()) {
                row.classList.add('current-day');
            }
            
            tbody.appendChild(row);
        }
        
        // Add click event listeners to all table cells
        addCellClickHandlers();
    }
    
    // Add this function to handle cell clicks with celebration animation
    function addCellClickHandlers() {
        const cells = document.querySelectorAll('tbody td');
        
        cells.forEach(cell => {
            // Skip Sehr, Iftar, and Date columns (1st, 2nd and 6th columns)
            const cellIndex = cell.cellIndex;
            if (cellIndex === 0 || cellIndex === 1 || cellIndex === 5) { // 0-based index, so 0, 1 and 5
                return; // Skip these columns
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
                
                // Toggle completed state
                this.classList.toggle('completed');
                
                // Only show celebration when completing, not when uncompleting
                if (!wasCompleted) {
                    createCelebration(this);
                }
                
                // Save completed state to localStorage
                saveCompletedCells();
                
                // Sync with prayer box
                syncTableCellWithPrayerBox(this);
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

    // Update date navigation to include animations for all elements
    function setupDateNavigation() {
        const prevDateBtn = document.querySelector('.prev-date');
        const nextDateBtn = document.querySelector('.next-date');
        const header = document.querySelector('.header');
        let currentDate = new Date();
        
        // Update displayed date with animation
        function updateDisplayedDate(direction) {
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
            
            // Get Hijri date
            const dateStr = currentDate.toISOString().split('T')[0];
            getHijriDate(dateStr).then(islamicDate => {
                document.querySelector('.date p').textContent = islamicDate;
            });
            
            // Update prayer times for the selected date
            const { lat, lng } = getDefaultCoordinates();
            getPrayerTimes(lat, lng, dateStr).then(timings => {
                updatePrayerTimes(timings);
                
                // Update progress bar after prayer times are updated
                setTimeout(() => {
                    updateProgressBar();
                    restorePrayerBoxStates(); // Restore prayer box states for the new date
                }, 100);
            });
            
            // Reset progress bar animation state
            const progressBar = document.querySelector('.progress');
            progressBar.classList.remove('animated');
        }
        
        // Get Hijri date (extracted from initialize function)
        async function getHijriDate(dateStr) {
            try {
                const response = await fetch(`https://api.aladhan.com/v1/gToH?date=${dateStr}`);
                const data = await response.json();
                
                if (data.code === 200 && data.data) {
                    const hijri = data.data.hijri;
                    return `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
                } else {
                    // Fallback to local calculation
                    const hijriDate = gregorianToHijri(new Date(dateStr));
                    return `${hijriDate.day} ${hijriDate.month} ${hijriDate.year} AH`;
                }
            } catch (error) {
                console.error('Error fetching Hijri date:', error);
                // Fallback to local calculation
                const hijriDate = gregorianToHijri(new Date(dateStr));
                return `${hijriDate.day} ${hijriDate.month} ${hijriDate.year} AH`;
            }
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
        
        // Initial call without animation
        updateDisplayedDate();
        
        // Return the update function so it can be called from elsewhere if needed
        return updateDisplayedDate;
    }

    // Update the initialize function to ensure setupDateNavigation is called properly
    async function initialize() {
        const { lat, lng } = getDefaultCoordinates();
        
        // Use actual today's date for the header
        const realToday = new Date();
        const todayStr = realToday.toISOString().split('T')[0];
        
        // Set Gregorian date
        const gregorianDate = realToday.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        document.querySelector('.date h1').textContent = gregorianDate;
        
        // Get accurate Hijri date using API
        try {
            const response = await fetch(`https://api.aladhan.com/v1/gToH?date=${todayStr}`);
            const data = await response.json();
            
            if (data.code === 200 && data.data) {
                const hijri = data.data.hijri;
                const islamicDate = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
                document.querySelector('.date p').textContent = islamicDate;
            } else {
                // Fallback to local calculation if API fails
                const hijriDate = gregorianToHijri(realToday);
                const islamicDate = `${hijriDate.day} ${hijriDate.month} ${hijriDate.year} AH`;
                document.querySelector('.date p').textContent = islamicDate;
            }
        } catch (error) {
            console.error('Error fetching Hijri date:', error);
            // Fallback to local calculation
            const hijriDate = gregorianToHijri(realToday);
            const islamicDate = `${hijriDate.day} ${hijriDate.month} ${hijriDate.year} AH`;
            document.querySelector('.date p').textContent = islamicDate;
        }
        
        // Get prayer times for today
        const timings = await getPrayerTimes(lat, lng, todayStr);
        updatePrayerTimes(timings);
        await generateRamadanData(lat, lng);
        
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

    // Start the application
    initialize();

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

    // Update the scroll event listener
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const header = document.querySelector('.header');
        
        if (scrollTop > 10) {
            container.classList.add('is-scrolled');
            
            // Calculate opacity based on scroll position
            const opacity = Math.max(0, 1 - (scrollTop / 200));
            header.style.opacity = opacity;
            
            // Calculate vertical movement (move up max 20px, and only for first 100px of scroll)
            const moveUp = Math.min(20, (scrollTop < 100 ? scrollTop / 5 : 20));
            const newTop = 40 - moveUp / 2; // Start from 40% and move up slightly
            header.style.top = `${newTop}%`;
            
            // When almost invisible, hide it completely
            if (opacity < 0.05) {
                header.style.visibility = 'hidden';
            } else {
                header.style.visibility = 'visible';
            }
        } else {
            container.classList.remove('is-scrolled');
            header.style.opacity = 1;
            header.style.visibility = 'visible';
            header.style.top = '40%'; // Reset to original position
        }
    });

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
                    cellIndex = 2; // 3rd column (0-indexed)
                    break;
                case 'ZUHR':
                    cellIndex = 3; // 4th column
                    break;
                case 'ASR':
                    cellIndex = 4; // 5th column
                    break;
                case 'MAGHRIB':
                    cellIndex = 6; // 7th column
                    break;
                case 'ISHA':
                    cellIndex = 7; // 8th column
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

    // Function to save prayer box states
    function savePrayerBoxStates() {
        const completedBoxes = [];
        document.querySelectorAll('.prayer-time.completed').forEach((box, index) => {
            // Get the prayer name for identification
            const prayerName = box.querySelector('.label').textContent;
            const date = document.querySelector('.date h1').textContent;
            completedBoxes.push(`${date}-${prayerName}`);
        });
        
        localStorage.setItem('ramadanCompletedPrayers', JSON.stringify(completedBoxes));
    }

    // Function to restore prayer box states
    function restorePrayerBoxStates() {
        const savedBoxes = localStorage.getItem('ramadanCompletedPrayers');
        if (savedBoxes) {
            const completedBoxes = JSON.parse(savedBoxes);
            const currentDate = document.querySelector('.date h1').textContent;
            
            document.querySelectorAll('.prayer-time').forEach(box => {
                const prayerName = box.querySelector('.label').textContent;
                if (completedBoxes.includes(`${currentDate}-${prayerName}`)) {
                    box.classList.add('completed');
                    
                    // Sync with table cell without triggering the event
                    syncPrayerBoxWithTableCell(box);
                } else {
                    box.classList.remove('completed');
                }
            });
        }
    }

    // Function to sync table cell with corresponding prayer box
    function syncTableCellWithPrayerBox(cell) {
        // Get the row and column index
        const row = cell.parentElement;
        const cellIndex = cell.cellIndex;
        
        // Get the date from the first cell in the row
        const dateText = row.querySelector('td:first-child').textContent.trim();
        
        // Get the current date from the header
        const currentDate = document.querySelector('.date h1').textContent;
        const formattedCurrentDate = formatDateForTable(new Date(currentDate));
        
        // Only sync if the row date matches the current displayed date
        if (dateText === formattedCurrentDate) {
            // Determine which prayer based on cell index
            let prayerName = '';
            
            switch (cellIndex) {
                case 2: // 3rd column (0-indexed)
                    prayerName = 'FAJR';
                    break;
                case 3: // 4th column
                    prayerName = 'ZUHR';
                    break;
                case 4: // 5th column
                    prayerName = 'ASR';
                    break;
                case 6: // 7th column
                    prayerName = 'MAGHRIB';
                    break;
                case 7: // 8th column
                    prayerName = 'ISHA';
                    break;
            }
            
            if (prayerName) {
                // Find the corresponding prayer box
                const prayerBoxes = document.querySelectorAll('.prayer-time');
                let targetBox = null;
                
                for (const box of prayerBoxes) {
                    const boxLabel = box.querySelector('.label').textContent.trim();
                    if (boxLabel === prayerName) {
                        targetBox = box;
                        break;
                    }
                }
                
                if (targetBox) {
                    // Update prayer box state to match cell
                    if (cell.classList.contains('completed')) {
                        targetBox.classList.add('completed');
                        
                        // Add celebration to prayer box if it's being completed
                        if (!targetBox.querySelector('.celebration')) {
                            setTimeout(() => createCelebration(targetBox), 50);
                        }
                    } else {
                        targetBox.classList.remove('completed');
                        
                        // Remove celebration if uncompleting
                        const existingCelebration = targetBox.querySelector('.celebration');
                        if (existingCelebration) {
                            existingCelebration.remove();
                        }
                    }
                    
                    // Save prayer box states to localStorage
                    savePrayerBoxStates();
                }
            }
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
            progressBar.style.left = window.innerWidth <= 480 ? '20%' : '15%';
            progressBar.style.right = window.innerWidth <= 480 ? '20%' : '15%';
            progressBar.style.width = window.innerWidth <= 480 ? '60%' : '70%';
            progressBar.style.top = '50%';
            progressBar.style.transform = window.innerWidth <= 480 ? 'translateY(15px)' : 'translateY(10px)';
            progressBar.style.height = '4px';
            progressBar.style.backgroundColor = 'var(--border-color)';
            progressBar.style.borderRadius = '2px';
            progressBar.style.zIndex = '1';
            
            // Fix the progress indicator
            const progress = document.querySelector('.progress');
            if (progress) {
                progress.style.position = 'absolute';
                progress.style.height = '100%';
                progress.style.backgroundColor = 'var(--accent-color)';
                progress.style.left = '0';
                progress.style.top = '0';
                progress.style.minWidth = '4px';
                progress.style.borderRadius = '2px';
                progress.style.zIndex = '1';
                
                // Force progress bar to update
                updateProgressBar();
            }
        } else {
            // Reset to original styles for desktop
            document.body.classList.remove('mobile-view');
            
            // Re-enable scroll handler
            window.addEventListener('scroll', headerScrollHandler);
            
            // Reset all styles
            header.style = '';
            header.style.position = 'fixed';
            header.style.left = '50%';
            header.style.top = '40%';
            header.style.transform = 'translate(-50%, -50%)';
            
            // Reset table container margin
            tableContainer.style.marginTop = '65vh';
            
            // Reset all other elements
            document.querySelectorAll('.prayer-blocks, .main-times, .progress-bar, .progress, .time-block, .time-block .time, .time-block .label')
                .forEach(el => el.style = '');
        }
        
        // Trigger scroll event to update header state
        window.dispatchEvent(new Event('scroll'));
    }

    // Store the scroll handler as a named function so we can remove it
    function headerScrollHandler() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const header = document.querySelector('.header');
        const container = document.querySelector('.container');
        
        if (scrollTop > 10) {
            container.classList.add('is-scrolled');
            
            // Calculate opacity based on scroll position
            const opacity = Math.max(0, 1 - (scrollTop / 200));
            header.style.opacity = opacity;
            
            // Calculate vertical movement
            const moveUp = Math.min(20, (scrollTop < 100 ? scrollTop / 5 : 20));
            const newTop = 40 - moveUp / 2;
            header.style.top = `${newTop}%`;
            
            // When almost invisible, hide it completely
            if (opacity < 0.05) {
                header.style.visibility = 'hidden';
            } else {
                header.style.visibility = 'visible';
            }
        } else {
            container.classList.remove('is-scrolled');
            header.style.opacity = 1;
            header.style.visibility = 'visible';
            header.style.top = '40%';
        }
    }
}); 