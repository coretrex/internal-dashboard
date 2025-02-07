let timerInterval;
let isRunning = false;  // Add this to track state in memory

function initializeTimer() {
    const timerBtn = document.getElementById('timerBtn');
    const timerDisplay = document.getElementById('timerDisplay');

    // Check if timer is already running
    const timerState = JSON.parse(localStorage.getItem('timerState') || '{}');
    if (timerState.isRunning) {
        const currentTime = Date.now();
        const endTime = timerState.endTime;
        if (currentTime < endTime) {
            // Resume timer
            const timeLeft = Math.ceil((endTime - currentTime) / 1000);
            startTimer(timeLeft);
        } else {
            // Timer should have ended
            localStorage.removeItem('timerState');
            stopTimer();
        }
    }

    function startTimer(initialTime) {
        if (isRunning) return; // Prevent multiple starts
        
        isRunning = true;
        clearInterval(timerInterval);
        
        const timeLeft = initialTime || 15 * 60; // 15 minutes in seconds
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
        timerDisplay.textContent = '15:00';
    }

    function updateTimerDisplay(timeLeft) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    timerBtn.addEventListener('click', () => {
        if (isRunning) {
            stopTimer();
        } else {
            startTimer();
        }
    });
}

// Initialize timer when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTimer); 