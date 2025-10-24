let timerInterval;
let isRunning = false;  // Add this to track state in memory
let audioContext;  // Web Audio API context for beep sound

// Section timer variables
let sectionTimerInterval;
let currentSectionIndex = 0;
let sectionTimer = null;
let isSectionTimerRunning = false;
let isTransitioning = false; // Flag to prevent multiple beeps during transitions
let isModalMinimized = false; // Track modal minimized state

// Timer sections configuration
const timerSections = [
    { name: 'Lead Gen', duration: 60 },
    { name: 'Prospects', duration: 120 },
    { name: 'Pod 1', duration: 180 },
    { name: 'Pod 2', duration: 180 },
    { name: 'Pod 3', duration: 90 }
];

function initializeTimer() {
    // Initialize simple beep sound using Web Audio API
    initializeBeepSound();

    // Check if section timer has any saved state
    const sectionTimerState = JSON.parse(localStorage.getItem('sectionTimerState') || '{}');
    console.log('Section timer state on page load:', sectionTimerState);
    
    if (sectionTimerState.currentSectionIndex !== undefined) {
        // Show modal and initialize section timer with saved state
        const modal = document.getElementById('sectionTimerModal');
        if (modal) {
            modal.style.display = 'block';
        }
        hideFloatingButton();
        initializeSectionTimer();
    } else {
        // Show floating button initially, hide modal
        const modal = document.getElementById('sectionTimerModal');
        if (modal) {
            modal.style.display = 'none';
        }
        showFloatingButton();
        // Initialize fresh section timer (but don't show modal yet)
        initializeSectionTimer();
    }

    function startTimer(initialTime) {
        if (isRunning) return; // Prevent multiple starts
        
        isRunning = true;
        clearInterval(timerInterval);
        
        const timeLeft = initialTime || 10 * 60; // 10 minutes in seconds
        const endTime = Date.now() + (timeLeft * 1000);
        
        localStorage.setItem('timerState', JSON.stringify({
            isRunning: true,
            endTime: endTime
        }));

        updateTimerDisplay(timeLeft);
        timerBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Timer';
        timerBtn.classList.add('running');
        timerDisplay.classList.add('active');
        
        timerInterval = setInterval(() => {
            const currentTime = Date.now();
            const remaining = Math.ceil((endTime - currentTime) / 1000);
            
            if (remaining <= 0) {
                stopTimer();
                playAlarm();
                alert('Timer finished!');
                return;
            }
            
            updateTimerDisplay(remaining);
        }, 1000);
    }

    function stopTimer() {
        if (!isRunning) return; // Prevent multiple stops
        
        isRunning = false;
        clearInterval(timerInterval);
        timerInterval = null;
        localStorage.removeItem('timerState');
        timerBtn.innerHTML = '<i class="fas fa-play"></i> Start Timer';
        timerBtn.classList.remove('running');
        timerDisplay.classList.remove('active');
        timerDisplay.textContent = '10:00';
    }

    function updateTimerDisplay(timeLeft) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function playAlarm() {
        playBeep();
    }

    // Old timer button removed - section timer is now always visible
}

// Section Timer Functions
function showFloatingButton() {
    const floatingBtn = document.getElementById('floatingStartTimerBtn');
    if (floatingBtn) {
        floatingBtn.style.display = 'flex';
    }
}

function hideFloatingButton() {
    const floatingBtn = document.getElementById('floatingStartTimerBtn');
    if (floatingBtn) {
        floatingBtn.style.display = 'none';
    }
}

function openSectionTimerModal() {
    const modal = document.getElementById('sectionTimerModal');
    
    if (modal) {
        modal.style.display = 'block';
        hideFloatingButton();
        initializeSectionTimer();
    }
}

function closeSectionTimerModal() {
    const modal = document.getElementById('sectionTimerModal');
    
    if (modal) {
        modal.style.display = 'none';
        showFloatingButton();
        // Don't stop the timer when closing modal - let it continue running
    }
}

function saveSectionTimerState() {
    const state = {
        isRunning: isSectionTimerRunning,
        currentSectionIndex: currentSectionIndex,
        sectionTimer: sectionTimer
    };
    localStorage.setItem('sectionTimerState', JSON.stringify(state));
}

function initializeSectionTimer() {
    // Always check current page first to determine which section to start
    const currentPage = window.location.pathname.split('/').pop();
    console.log('Current page:', currentPage);
    
    // Check if there's a saved section timer state
    const savedState = JSON.parse(localStorage.getItem('sectionTimerState') || '{}');
    console.log('Saved state:', savedState);
    
    // Always default to Lead Gen section (index 0)
    let targetSectionIndex = 0;
    let shouldAutoStart = false;
    
    // If there's saved state, restore it
    if (savedState.currentSectionIndex !== undefined) {
        // Restore the timer state
        currentSectionIndex = savedState.currentSectionIndex;
        sectionTimer = savedState.sectionTimer;
        isSectionTimerRunning = false; // Reset running state
        
        // If timer was running and has time left, resume it automatically
        if (savedState.isRunning && sectionTimer > 0) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                startSectionTimer();
            }, 100);
            console.log('Auto-resuming timer that was running');
        } else {
            console.log('Restored timer state but keeping it stopped');
        }
    } else {
        // Start fresh with Lead Gen section
        currentSectionIndex = targetSectionIndex;
        sectionTimer = timerSections[targetSectionIndex].duration;
        isSectionTimerRunning = false;
    }
    
    updateSectionDisplay();
}

function startSectionTimer() {
    if (isSectionTimerRunning) {
        console.log('Timer already running, skipping start');
        return;
    }
    
    console.log('Starting section timer, current section:', currentSectionIndex, 'time left:', sectionTimer, 'isRunning:', isSectionTimerRunning);
    
    // Clear any existing interval first
    if (sectionTimerInterval) {
        clearInterval(sectionTimerInterval);
        sectionTimerInterval = null;
    }
    
    isSectionTimerRunning = true;
    const currentSection = timerSections[currentSectionIndex];
    
    // If sectionTimer is null, use the full duration, otherwise use the saved time
    if (sectionTimer === null) {
        sectionTimer = currentSection.duration;
    }
    
    console.log('Starting timer with section:', currentSection.name, 'duration:', sectionTimer);
    
    console.log('Timer started with time:', sectionTimer);
    
    // Save state to localStorage
    saveSectionTimerState();
    
    updateSectionDisplay();
    
    sectionTimerInterval = setInterval(() => {
        sectionTimer--;
        console.log('Timer tick:', sectionTimer);
        updateSectionDisplay();
        
        // Save state every second
        saveSectionTimerState();
        
        if (sectionTimer <= 0) {
            // Stop the timer completely before transitioning
            isSectionTimerRunning = false;
            clearInterval(sectionTimerInterval);
            sectionTimerInterval = null;
            
            // Small delay to ensure timer is fully stopped
            setTimeout(() => {
                nextSection();
            }, 50);
        }
    }, 1000);
}

function stopSectionTimer() {
    console.log('Stopping section timer, current time:', sectionTimer);
    isSectionTimerRunning = false;
    clearInterval(sectionTimerInterval);
    sectionTimerInterval = null;
    
    // Don't clear sectionTimer or localStorage - allow resuming
    // Save the paused state
    saveSectionTimerState();
    
    // Update the display to show the Start button
    updateSectionDisplay();
    console.log('Timer stopped, isRunning now:', isSectionTimerRunning);
}

function nextSection() {
    // Timer is already stopped and interval cleared
    isSectionTimerRunning = false; // Ensure running state is false
    
    // Play beep once
    playBeep();
    
    currentSectionIndex++;
    
    if (currentSectionIndex >= timerSections.length) {
        // All sections completed
        alert('All timer sections completed!');
        localStorage.removeItem('sectionTimerState');
        closeSectionTimerModal();
        return;
    }
    
    // Reset timer to the new section's full duration
    const newSection = timerSections[currentSectionIndex];
    sectionTimer = newSection.duration;
    
    console.log('Moving to section:', newSection.name, 'with duration:', sectionTimer);
    
    // Save the new section index and reset timer
    saveSectionTimerState();
    
    // Auto-start next section after a brief delay
    setTimeout(() => {
        startSectionTimer();
    }, 1000);
}

function skipSection() {
    console.log('Skip button clicked, current section:', currentSectionIndex, 'isRunning:', isSectionTimerRunning);
    
    // Clear the timer interval first to prevent multiple beeps
    if (sectionTimerInterval) {
        clearInterval(sectionTimerInterval);
        sectionTimerInterval = null;
    }
    
    playBeep();
    nextSection();
}

function resetSectionTimer() {
    // Stop any running timer
    if (sectionTimerInterval) {
        clearInterval(sectionTimerInterval);
        sectionTimerInterval = null;
    }
    
    // Reset all variables to initial state
    currentSectionIndex = 0;
    sectionTimer = null;
    isSectionTimerRunning = false;
    isTransitioning = false;
    
    // Clear saved state
    localStorage.removeItem('sectionTimerState');
    
    // Update display
    updateSectionDisplay();
    
    console.log('Timer reset to beginning');
}

function jumpToSection(sectionIndex) {
    // Validate section index
    if (sectionIndex < 0 || sectionIndex >= timerSections.length) {
        console.log('Invalid section index:', sectionIndex);
        return;
    }
    
    // Stop any running timer
    if (sectionTimerInterval) {
        clearInterval(sectionTimerInterval);
        sectionTimerInterval = null;
    }
    
    // Jump to the selected section
    currentSectionIndex = sectionIndex;
    sectionTimer = timerSections[sectionIndex].duration;
    isSectionTimerRunning = false;
    isTransitioning = false;
    
    // Save the new state
    saveSectionTimerState();
    
    // Update display
    updateSectionDisplay();
    
    // Auto-start the new section
    setTimeout(() => {
        startSectionTimer();
    }, 100);
    
    console.log('Jumped to section:', timerSections[sectionIndex].name);
}

function toggleModalMinimize() {
    const modal = document.getElementById('sectionTimerModal');
    const minimizeBtn = document.getElementById('minimizeBtn');
    
    if (modal && minimizeBtn) {
        isModalMinimized = !isModalMinimized;
        
        if (isModalMinimized) {
            modal.classList.add('minimized');
            minimizeBtn.innerHTML = '<i class="fas fa-plus"></i>';
        } else {
            modal.classList.remove('minimized');
            minimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
        }
        
        // Save minimized state
        localStorage.setItem('modalMinimized', isModalMinimized);
        
        console.log('Modal minimized:', isModalMinimized);
    }
}

function updateSectionDisplay() {
    const sectionNameEl = document.getElementById('currentSectionName');
    const sectionTimeEl = document.getElementById('sectionTimeDisplay');
    const progressEl = document.getElementById('sectionProgress');
    const currentSectionNumberEl = document.getElementById('currentSectionNumber');
    const skipBtn = document.getElementById('skipSectionBtn');
    const startBtn = document.getElementById('startSectionBtn');
    const stopBtn = document.getElementById('stopSectionBtn');
    const sectionItems = document.querySelectorAll('.section-item');
    
    // Summary elements for minimized view
    const summarySectionNameEl = document.getElementById('summarySectionName');
    const summaryTimeEl = document.getElementById('summaryTimeDisplay');
    
    if (currentSectionIndex >= timerSections.length) return;
    
    const currentSection = timerSections[currentSectionIndex];
    const totalSections = timerSections.length;
    
    // Update section name
    if (sectionNameEl) {
        sectionNameEl.textContent = currentSection.name;
    }
    
    // Update current section number
    if (currentSectionNumberEl) {
        currentSectionNumberEl.textContent = currentSectionIndex + 1;
    }
    
    // Update time display
    if (sectionTimeEl) {
        if (sectionTimer !== null) {
            const minutes = Math.floor(sectionTimer / 60);
            const seconds = sectionTimer % 60;
            sectionTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            sectionTimeEl.textContent = `${Math.floor(currentSection.duration / 60).toString().padStart(2, '0')}:${(currentSection.duration % 60).toString().padStart(2, '0')}`;
        }
    }
    
    // Update summary display (for minimized view)
    if (summarySectionNameEl) {
        summarySectionNameEl.textContent = currentSection.name;
    }
    if (summaryTimeEl) {
        if (sectionTimer !== null) {
            const minutes = Math.floor(sectionTimer / 60);
            const seconds = sectionTimer % 60;
            summaryTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            summaryTimeEl.textContent = `${Math.floor(currentSection.duration / 60).toString().padStart(2, '0')}:${(currentSection.duration % 60).toString().padStart(2, '0')}`;
        }
    }
    
    // Update progress
    if (progressEl) {
        const progress = ((currentSectionIndex + 1) / totalSections) * 100;
        progressEl.style.width = `${progress}%`;
    }
    
    // Update section list items
    sectionItems.forEach((item, index) => {
        item.classList.remove('current', 'completed', 'pending');
        if (index < currentSectionIndex) {
            item.classList.add('completed');
        } else if (index === currentSectionIndex) {
            item.classList.add('current');
        } else {
            item.classList.add('pending');
        }
    });
    
    // Update buttons
    if (skipBtn) {
        skipBtn.disabled = !isSectionTimerRunning;
    }
    if (startBtn) {
        startBtn.style.display = isSectionTimerRunning ? 'none' : 'inline-block';
    }
    if (stopBtn) {
        stopBtn.style.display = isSectionTimerRunning ? 'inline-block' : 'none';
    }
    
    console.log('Button states - isRunning:', isSectionTimerRunning, 'startBtn display:', startBtn?.style.display, 'stopBtn display:', stopBtn?.style.display);
}

function initializeBeepSound() {
    try {
        // Create audio context for beep sound
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
        console.log('Web Audio API not supported:', error);
    }
}

function playBeep() {
    if (!isTransitioning && audioContext) {
        isTransitioning = true;
        
        try {
            // Create oscillator for beep sound
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            // Connect oscillator to gain node to audio context
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Set beep frequency (800Hz for a clear beep)
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = 'sine';
            
            // Set volume (0.3 for moderate volume)
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            
            // Create envelope for clean beep (quick attack, quick decay)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            // Play the beep for 400ms
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
            
        } catch (error) {
            console.log('Could not play beep sound:', error);
        }
        
        // Reset the flag after a short delay
        setTimeout(() => {
            isTransitioning = false;
        }, 500);
    }
}

// Initialize timer when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTimer);

// Clean up intervals when page is about to unload
window.addEventListener('beforeunload', function() {
    if (sectionTimerInterval) {
        clearInterval(sectionTimerInterval);
    }
    if (timerInterval) {
        clearInterval(timerInterval);
    }
});

// Initialize section timer event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Close modal event listener
    const closeBtn = document.getElementById('closeSectionTimerModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSectionTimerModal);
    }
    
    // Start section button
    const startBtn = document.getElementById('startSectionBtn');
    if (startBtn) {
        startBtn.addEventListener('click', startSectionTimer);
    }
    
    // Stop section button
    const stopBtn = document.getElementById('stopSectionBtn');
    if (stopBtn) {
        stopBtn.addEventListener('click', stopSectionTimer);
    }
    
    // Skip section button
    const skipBtn = document.getElementById('skipSectionBtn');
    if (skipBtn) {
        skipBtn.addEventListener('click', skipSection);
    }
    
    // Reset section button
    const resetBtn = document.getElementById('resetSectionBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSectionTimer);
    }
    
    // Minimize button
    const minimizeBtn = document.getElementById('minimizeBtn');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', toggleModalMinimize);
    }
    
    // Agenda item click listeners
    const sectionItems = document.querySelectorAll('.section-item');
    sectionItems.forEach((item, index) => {
        item.addEventListener('click', function() {
            jumpToSection(index);
        });
    });
    
    // Floating Start Timer button
    const floatingStartBtn = document.getElementById('floatingStartTimerBtn');
    if (floatingStartBtn) {
        floatingStartBtn.addEventListener('click', function() {
            openSectionTimerModal();
            // Auto-start the timer after opening the modal
            setTimeout(() => {
                startSectionTimer();
            }, 150);
        });
    }
    
    // Initialize modal minimized state from saved preference
    const savedMinimized = localStorage.getItem('modalMinimized') === 'true';
    if (savedMinimized) {
        isModalMinimized = true;
        const modal = document.getElementById('sectionTimerModal');
        const minimizeBtn = document.getElementById('minimizeBtn');
        if (modal && minimizeBtn) {
            modal.classList.add('minimized');
            minimizeBtn.innerHTML = '<i class="fas fa-plus"></i>';
        }
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('sectionTimerModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeSectionTimerModal();
            }
        });
    }
}); 