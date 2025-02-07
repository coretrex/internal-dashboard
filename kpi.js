// Store KPI data in localStorage
const KPI_STORAGE_KEY = 'kpiData';

// Load existing KPI data
function loadKPIData() {
    const data = localStorage.getItem(KPI_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Save KPI data
function saveKPIData(data) {
    localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(data));
}

// Format date to display day of week
function formatDate(dateString) {
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
        formatted: dateString,
        day: days[date.getDay()]
    };
}

// Calculate conversion rate
function calculateConversionRate(calls, meetings) {
    if (calls === 0) return '0%';
    return ((meetings / calls) * 100).toFixed(1) + '%';
}

// Add this function to calculate stats for the last 14 days
function calculateRecentStats() {
    const kpiData = loadKPIData();
    
    // Initialize stats objects
    const stats = {
        greyson: { 
            current: { meetings: 0, calls: 0 },
            previous: { meetings: 0, calls: 0 }
        },
        robby: { 
            current: { meetings: 0, calls: 0 },
            previous: { meetings: 0, calls: 0 }
        }
    };
    
    // Group entries by owner
    const greysonEntries = kpiData.filter(entry => entry.owner === 'Greyson')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    const robbyEntries = kpiData.filter(entry => entry.owner === 'Robby')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Get current and previous 5 entries for each owner
    const greysonCurrent = greysonEntries.slice(0, 5);
    const greysonPrevious = greysonEntries.slice(5, 10);
    const robbyCurrent = robbyEntries.slice(0, 5);
    const robbyPrevious = robbyEntries.slice(5, 10);
    
    // Calculate totals for current and previous periods
    greysonCurrent.forEach(entry => {
        stats.greyson.current.meetings += entry.meetings;
        stats.greyson.current.calls += entry.calls;
    });
    
    greysonPrevious.forEach(entry => {
        stats.greyson.previous.meetings += entry.meetings;
        stats.greyson.previous.calls += entry.calls;
    });
    
    robbyCurrent.forEach(entry => {
        stats.robby.current.meetings += entry.meetings;
        stats.robby.current.calls += entry.calls;
    });
    
    robbyPrevious.forEach(entry => {
        stats.robby.previous.meetings += entry.meetings;
        stats.robby.previous.calls += entry.calls;
    });
    
    // Calculate conversion rates and changes
    function calculateChange(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100).toFixed(1);
    }
    
    // Greyson's calculations
    const greysonCurrentConversion = stats.greyson.current.calls ? 
        ((stats.greyson.current.meetings / stats.greyson.current.calls) * 100).toFixed(1) : 0;
    const greysonPreviousConversion = stats.greyson.previous.calls ? 
        ((stats.greyson.previous.meetings / stats.greyson.previous.calls) * 100).toFixed(1) : 0;
    
    // Robby's calculations
    const robbyCurrentConversion = stats.robby.current.calls ? 
        ((stats.robby.current.meetings / stats.robby.current.calls) * 100).toFixed(1) : 0;
    const robbyPreviousConversion = stats.robby.previous.calls ? 
        ((stats.robby.previous.meetings / stats.robby.previous.calls) * 100).toFixed(1) : 0;
    
    // Calculate percentage changes
    const greysonMeetingsChange = calculateChange(stats.greyson.current.meetings, stats.greyson.previous.meetings);
    const greysonConversionChange = calculateChange(greysonCurrentConversion, greysonPreviousConversion);
    const robbyMeetingsChange = calculateChange(stats.robby.current.meetings, stats.robby.previous.meetings);
    const robbyConversionChange = calculateChange(robbyCurrentConversion, robbyPreviousConversion);
    
    // Update DOM with current values and changes
    function updateStat(elementId, value, change) {
        const element = document.getElementById(elementId);
        const changeClass = change > 0 ? 'stat-change-up' : change < 0 ? 'stat-change-down' : 'stat-change-neutral';
        const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
        
        element.innerHTML = `
            ${value}
            <div class="${changeClass}">
                ${arrow} ${Math.abs(change)}%
            </div>
        `;
    }
    
    updateStat('greysonMeetings', stats.greyson.current.meetings, greysonMeetingsChange);
    updateStat('greysonConversion', `${greysonCurrentConversion}%`, greysonConversionChange);
    updateStat('robbyMeetings', stats.robby.current.meetings, robbyMeetingsChange);
    updateStat('robbyConversion', `${robbyCurrentConversion}%`, robbyConversionChange);
}

// Update table with KPI data
function updateTable() {
    const tableBody = document.getElementById('kpiTableBody');
    const kpiData = loadKPIData();
    
    // Sort data by date (newest first) and then by owner
    kpiData.sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare === 0) {
            return a.owner.localeCompare(b.owner);
        }
        return dateCompare;
    });
    
    tableBody.innerHTML = kpiData.map(entry => {
        const date = formatDate(entry.date);
        const callsClass = entry.calls >= 50 ? 'highlight-green' : 'highlight-red';
        const meetingsClass = entry.meetings >= 1 ? 'highlight-green' : 'highlight-red';
        
        return `
            <tr>
                <td>${date.formatted}</td>
                <td>${date.day}</td>
                <td class="${callsClass}">${entry.calls}</td>
                <td class="${meetingsClass}">${entry.meetings}</td>
                <td>${calculateConversionRate(entry.calls, entry.meetings)}</td>
                <td>${entry.owner || 'N/A'}</td>
                <td>
                    <button onclick="editEntry('${entry.date}', '${entry.owner}')" class="action-btn-small">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteEntry('${entry.date}', '${entry.owner}')" class="action-btn-small delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Add this line at the end
    calculateRecentStats();
}

// Edit entry function
window.editEntry = function(date, owner) {
    const kpiData = loadKPIData();
    const entry = kpiData.find(item => item.date === date && item.owner === owner);
    
    if (entry) {
        document.getElementById('entryDate').value = entry.date;
        document.getElementById('callsMade').value = entry.calls;
        document.getElementById('meetingsScheduled').value = entry.meetings;
        document.getElementById('owner').value = entry.owner;
        
        // Scroll to form
        document.getElementById('entryForm').scrollIntoView({ behavior: 'smooth' });
    }
}

// Delete entry function
window.deleteEntry = function(date, owner) {
    if (confirm('Are you sure you want to delete this entry?')) {
        const kpiData = loadKPIData();
        const updatedData = kpiData.filter(item => !(item.date === date && item.owner === owner));
        saveKPIData(updatedData);
        updateTable();
    }
}

// Handle form submission
document.getElementById('kpiForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const date = document.getElementById('entryDate').value;
    const calls = parseInt(document.getElementById('callsMade').value);
    const meetings = parseInt(document.getElementById('meetingsScheduled').value);
    const owner = document.getElementById('owner').value;
    
    const kpiData = loadKPIData();
    
    // Check if entry for this date and owner already exists
    const existingIndex = kpiData.findIndex(entry => entry.date === date && entry.owner === owner);
    
    if (existingIndex !== -1) {
        kpiData[existingIndex] = { date, calls, meetings, owner };
    } else {
        kpiData.push({ date, calls, meetings, owner });
    }
    
    saveKPIData(kpiData);
    updateTable();
    e.target.reset();
});

// Make sure stats are calculated on page load
document.addEventListener('DOMContentLoaded', () => {
    updateTable();
    calculateRecentStats();
}); 