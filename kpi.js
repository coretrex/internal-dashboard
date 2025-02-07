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

// Initialize table on page load
document.addEventListener('DOMContentLoaded', updateTable); 