// Goals page functionality
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication using the correct localStorage key
    if (!localStorage.getItem('isLoggedIn')) {
        window.location.href = 'index.html';
        return;
    }

    // Add navigation component
    const navElement = document.createElement('nav-menu');
    document.body.appendChild(navElement);

    // Update thermometer progress
    const updateThermometer = () => {
        const currentMRR = 94000; // Current MRR value
        const startMRR = 75000;   // Starting MRR value
        const targetMRR = 120000; // Final target MRR value
        const progress = ((currentMRR - startMRR) / (targetMRR - startMRR)) * 100;
        
        const thermometerProgress = document.querySelector('.thermometer-progress');
        if (thermometerProgress) {
            thermometerProgress.style.width = `${progress}%`;
        }
    };

    // Milestone details
    const milestoneDetails = {
        '94k': {
            title: '$94K MRR - Projected MRR Start',
            details: 'Starting point for our growth journey (May)'
        },
        '100k': {
            title: '$100K MRR - Team Celebration + Merch',
            details: 'Team Celebration with Branded Merchandise:\n• Vests\n• Shirts\n• Hats\n• Mugs'
        },
        '110k': {
            title: '$110K MRR - Major Perks Unlock',
            details: 'Comprehensive Benefits Package:\n• Private Brand Product Launch\n• MacBook Pro for All Team Members\n• Top Golf Membership\n• 401k for All Employees'
        },
        '115k': {
            title: '$115K MRR - Team Expansion',
            details: 'New Hire to Expand Team'
        },
        '120k': {
            title: '$120K MRR - Ultimate Team Experience',
            details: 'Team Retreat + $15K Giveaway (H4L?)'
        }
    };

    // Modal functionality
    const modal = document.getElementById('milestoneModal');
    const modalContent = document.getElementById('modalContent');
    const closeBtn = document.getElementsByClassName('close')[0];

    // Add click event to all milestone cards
    document.querySelectorAll('.milestone-card').forEach(card => {
        card.addEventListener('click', () => {
            const milestone = card.getAttribute('data-milestone');
            const details = milestoneDetails[milestone];
            
            modalContent.innerHTML = `
                <h2>${details.title}</h2>
                <div class="modal-details">${details.details.replace(/\n/g, '<br>')}</div>
            `;
            
            modal.style.display = 'block';
        });
    });

    // Close modal when clicking the X
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Initialize the page
    updateThermometer();
}); 