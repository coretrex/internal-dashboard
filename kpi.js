// Initialize Firebase (add this at the top of kpi.js)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyByMNy7bBbsv8CefOzHI6FP-JrRps4HmKo",
    authDomain: "coretrex-internal-dashboard.firebaseapp.com",
    projectId: "coretrex-internal-dashboard",
    storageBucket: "coretrex-internal-dashboard.firebasestorage.app",
    messagingSenderId: "16273988237",
    appId: "1:16273988237:web:956c63742712c22185e0c4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Store KPI data in localStorage
const KPI_STORAGE_KEY = 'kpiData';

// Load existing KPI data
async function loadKPIData() {
    try {
        const kpiRef = collection(db, 'kpi');
        const q = query(kpiRef, orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date,
            calls: Number(doc.data().calls),
            meetings: Number(doc.data().meetings),
            owner: doc.data().owner
        }));
    } catch (error) {
        console.error("Error loading KPI data:", error);
        return [];
    }
}

// Save KPI data
async function saveKPIData(data) {
    try {
        const kpiRef = collection(db, 'kpi');
        await addDoc(kpiRef, data);
    } catch (error) {
        console.error("Error saving KPI data:", error);
    }
}

// Format date to display day of week
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00'); // Add time component and force local time
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
async function calculateRecentStats() {
    try {
        const kpiData = await loadKPIData();
        
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
            stats.greyson.current.meetings += Number(entry.meetings);
            stats.greyson.current.calls += Number(entry.calls);
        });
        
        greysonPrevious.forEach(entry => {
            stats.greyson.previous.meetings += Number(entry.meetings);
            stats.greyson.previous.calls += Number(entry.calls);
        });
        
        robbyCurrent.forEach(entry => {
            stats.robby.current.meetings += Number(entry.meetings);
            stats.robby.current.calls += Number(entry.calls);
        });
        
        robbyPrevious.forEach(entry => {
            stats.robby.previous.meetings += Number(entry.meetings);
            stats.robby.previous.calls += Number(entry.calls);
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
            if (!element) return; // Guard clause for missing elements
            
            const changeClass = change > 0 ? 'stat-change-up' : change < 0 ? 'stat-change-down' : 'stat-change-neutral';
            const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
            
            // Check if this is a conversion rate stat and above 2%
            const isConversion = elementId.includes('Conversion');
            const numericValue = parseFloat(value);
            const isOnFire = isConversion && numericValue >= 2;
            
            element.innerHTML = `
                ${value} ${isOnFire ? '<span class="flame">🔥</span>' : ''}
                <div class="${changeClass}">
                    ${arrow} ${Math.abs(change)}%
                </div>
            `;
            
            // Add or remove the on-fire class based on the condition
            element.closest('.stat').classList.toggle('on-fire', isOnFire);
        }
        
        updateStat('greysonMeetings', stats.greyson.current.meetings, greysonMeetingsChange);
        updateStat('greysonConversion', `${greysonCurrentConversion}%`, greysonConversionChange);
        updateStat('robbyMeetings', stats.robby.current.meetings, robbyMeetingsChange);
        updateStat('robbyConversion', `${robbyCurrentConversion}%`, robbyConversionChange);
        
    } catch (error) {
        console.error("Error calculating stats:", error);
    }
}

// Update table with KPI data
async function updateTable() {
    try {
        const tableBody = document.getElementById('kpiTableBody');
        const kpiData = await loadKPIData();
        
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
        
        // Calculate stats after table is updated
        await calculateRecentStats();
    } catch (error) {
        console.error("Error updating table:", error);
    }
}

// Edit entry function
window.editEntry = async function(date, owner) {
    try {
        const kpiRef = collection(db, 'kpi');
        const q = query(kpiRef);
        const querySnapshot = await getDocs(q);
        let entry = null;
        let row = null;
        
        // Find the matching row in the table
        const rows = document.querySelectorAll('#kpiTableBody tr');
        rows.forEach(r => {
            const rowDate = r.cells[0].textContent;
            const rowOwner = r.cells[5].textContent;
            if (rowDate === date && rowOwner === owner) {
                row = r;
            }
        });
        
        if (!row) return;
        
        // Get current values
        const currentValues = {
            date: row.cells[0].textContent,
            calls: row.cells[2].textContent,
            meetings: row.cells[3].textContent,
            owner: row.cells[5].textContent
        };
        
        // Replace cells with input fields
        row.cells[2].innerHTML = `<input type="number" class="editable-input" value="${currentValues.calls}" min="0">`;
        row.cells[3].innerHTML = `<input type="number" class="editable-input" value="${currentValues.meetings}" min="0">`;
        row.cells[5].innerHTML = `
            <select class="editable-input">
                <option value="Robby" ${currentValues.owner === 'Robby' ? 'selected' : ''}>Robby</option>
                <option value="Greyson" ${currentValues.owner === 'Greyson' ? 'selected' : ''}>Greyson</option>
            </select>
        `;
        
        // Replace edit/delete buttons with save/cancel buttons
        const actionCell = row.cells[6];
        const originalButtons = actionCell.innerHTML;
        actionCell.innerHTML = `
            <button onclick="saveEdit('${date}', '${owner}', this)" class="action-btn-small">
                <i class="fas fa-save"></i>
            </button>
            <button onclick="cancelEdit('${date}', '${owner}', '${originalButtons}')" class="action-btn-small">
                <i class="fas fa-times"></i>
            </button>
        `;
        
    } catch (error) {
        console.error("Error editing entry:", error);
    }
}

// Add these new functions for save and cancel functionality
window.saveEdit = async function(date, owner, button) {
    const row = button.closest('tr');
    const newValues = {
        date: date,
        calls: parseInt(row.cells[2].querySelector('input').value) || 0,
        meetings: parseInt(row.cells[3].querySelector('input').value) || 0,
        owner: row.cells[5].querySelector('select').value
    };
    
    try {
        const kpiRef = collection(db, 'kpi');
        const q = query(kpiRef);
        const querySnapshot = await getDocs(q);
        
        querySnapshot.docs.forEach(async (doc) => {
            const data = doc.data();
            if (data.date === date && data.owner === owner) {
                await updateDoc(doc.ref, newValues);
            }
        });
        
        // Update table to reflect changes
        await updateTable();
        
    } catch (error) {
        console.error("Error saving edit:", error);
        alert("Error saving changes. Please try again.");
    }
}

window.cancelEdit = async function(date, owner, originalButtons) {
    // Simply refresh the table to revert changes
    await updateTable();
}

// Delete entry function
window.deleteEntry = async function(date, owner) {
    if (confirm('Are you sure you want to delete this entry?')) {
        try {
            const kpiRef = collection(db, 'kpi');
            const q = query(kpiRef);
            const querySnapshot = await getDocs(q);
            
            querySnapshot.docs.forEach(async (doc) => {
                const data = doc.data();
                if (data.date === date && data.owner === owner) {
                    await deleteDoc(doc.ref);
                }
            });
            
            updateTable();
        } catch (error) {
            console.error("Error deleting entry:", error);
        }
    }
}

// Handle form submission
document.getElementById('kpiForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        date: document.getElementById('entryDate').value,
        calls: parseInt(document.getElementById('callsMade').value) || 0,
        meetings: parseInt(document.getElementById('meetingsScheduled').value) || 0,
        owner: document.getElementById('owner').value
    };
    
    try {
        // Check if entry for this date and owner already exists
        const kpiRef = collection(db, 'kpi');
        const q = query(kpiRef);
        const querySnapshot = await getDocs(q);
        let existingDoc = null;
        
        querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.date === formData.date && data.owner === formData.owner) {
                existingDoc = { id: doc.id, ...data };
            }
        });
        
        if (existingDoc) {
            // Update existing entry
            const docRef = doc(db, 'kpi', existingDoc.id);
            await updateDoc(docRef, formData);
            console.log('Document updated');
        } else {
            // Add new entry
            await addDoc(collection(db, 'kpi'), formData);
            console.log('Document added');
        }
        
        // Clear form
        e.target.reset();
        
        // Update table and stats
        await updateTable();
        
        // Show success message
        alert('Entry saved successfully!');
        
    } catch (error) {
        console.error("Error saving entry:", error);
        alert('Error saving entry. Please try again.');
    }
});

// Function to update the KPI summary table
async function updateKpiSummaryTable() {
    const salespeople = [
        { name: 'Robby Asbery' },
        { name: 'Martin Seshoene' },
        { name: 'Chris Maren' }
    ];
    const kpiData = await loadKPIData();
    const tbody = document.getElementById('kpiSummaryBody');
    if (!tbody) return;

    tbody.innerHTML = salespeople.map(person => {
        // Filter and sort entries for this person
        let entries;
        if (person.name === 'Robby Asbery') {
            entries = kpiData
                .filter(entry => entry.owner === 'Robby' || entry.owner === 'Robby Asbery')
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            entries = kpiData
                .filter(entry => entry.owner === person.name)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        // Get last 10 work days (weekdays only)
        const workdayEntries = [];
        for (let i = 0, count = 0; i < entries.length && count < 10; i++) {
            const date = new Date(entries[i].date + 'T00:00:00');
            const day = date.getDay();
            if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
                workdayEntries.push(entries[i]);
                count++;
            }
        }
        // Calculate totals
        const totalMeetings = workdayEntries.reduce((sum, entry) => sum + Number(entry.meetings), 0);
        const totalCalls = workdayEntries.reduce((sum, entry) => sum + Number(entry.calls), 0);
        // Calculate conversion rate
        const conversionRate = totalCalls === 0 ? '0%' : ((totalMeetings / totalCalls) * 100).toFixed(1) + '%';
        // Add clickable class, data-person attribute, and icon
        return `
            <tr>
                <td class="name-cell" data-person="${person.name}">
                    <span class='name-text'>${person.name}</span>
                    <i class='fas fa-chart-line expand-icon'></i>
                </td>
                <td>${totalMeetings}</td>
                <td>${conversionRate}</td>
            </tr>
        `;
    }).join('');

    // Add click event listeners to name cells
    Array.from(tbody.querySelectorAll('.name-cell')).forEach(cell => {
        cell.addEventListener('click', () => {
            openKpiGraphModal();
        });
    });
}

// Make sure stats are calculated on page load
document.addEventListener('DOMContentLoaded', async () => {
    await updateTable();
    calculateRecentStats();
    updateKpiSummaryTable();
});

// Add Chart.js loader
if (!window.Chart) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    document.head.appendChild(script);
}

let kpiChartInstance = null;

// Function to render the KPI chart for a given date range and selected people
async function renderKpiChart(startDate, endDate, selectedPeople) {
    const canvas = document.getElementById('kpiGraphCanvas');
    const kpiData = await loadKPIData();
    const salespeople = [
        { name: 'Robby Asbery', firstName: 'Robby', aliases: ['Robby', 'Robby Asbery'], color: 'rgba(33, 150, 243, 1)', bg: 'rgba(33, 150, 243, 0.3)' },
        { name: 'Martin Seshoene', firstName: 'Martin', aliases: ['Martin Seshoene'], color: 'rgba(76, 175, 80, 1)', bg: 'rgba(76, 175, 80, 0.3)' },
        { name: 'Chris Maren', firstName: 'Chris', aliases: ['Chris Maren'], color: 'rgba(255, 193, 7, 1)', bg: 'rgba(255, 193, 7, 0.3)' }
    ];
    // Get all unique dates in the range
    const allDatesSet = new Set();
    kpiData.forEach(entry => {
        const d = new Date(entry.date);
        if (d >= startDate && d <= endDate) allDatesSet.add(entry.date);
    });
    const allDates = Array.from(allDatesSet).sort().reverse();
    // Prepare datasets for each selected salesperson
    const datasets = [];
    salespeople.forEach((person, idx) => {
        if (!selectedPeople.includes(person.name)) return;
        const entries = kpiData.filter(entry => person.aliases.includes(entry.owner));
        const entryMap = {};
        entries.forEach(e => { entryMap[e.date] = e; });
        const callsData = allDates.map(date => entryMap[date] ? entryMap[date].calls : 0);
        const conversionData = allDates.map(date => {
            if (entryMap[date] && entryMap[date].calls > 0) {
                return ((entryMap[date].meetings / entryMap[date].calls) * 100).toFixed(1);
            }
            return 0;
        });
        datasets.push({
            label: `${person.firstName} Calls`,
            data: callsData,
            backgroundColor: person.bg,
            borderColor: person.color,
            borderWidth: 1,
            yAxisID: 'y',
            type: 'bar',
            stack: 'calls',
            order: 1
        });
        datasets.push({
            label: `${person.firstName} CVR%`,
            data: conversionData,
            borderColor: person.color,
            backgroundColor: person.bg,
            borderWidth: 2,
            fill: false,
            yAxisID: 'y1',
            type: 'line',
            tension: 0.3,
            order: 2,
            pointStyle: 'line',
            showLine: true
        });
    });
    if (kpiChartInstance) {
        kpiChartInstance.destroy();
    }
    kpiChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: allDates,
            datasets: datasets
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#fff', usePointStyle: true, padding: 20 }, padding: 24 },
                title: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: '#fff', maxRotation: 90, minRotation: 45 },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Calls', color: '#fff' },
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'CVR%', color: '#fff' },
                    ticks: { color: '#fff' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

// Update openKpiGraphModal to use the person filters
window.openKpiGraphModal = async function() {
    // Wait for Chart.js to load if not already loaded
    if (!window.Chart) {
        await new Promise(resolve => {
            const check = () => window.Chart ? resolve() : setTimeout(check, 50);
            check();
        });
    }
    const modal = document.getElementById('kpiGraphModal');
    const title = document.getElementById('kpiGraphTitle');
    title.textContent = '';
    modal.style.display = 'block';

    // Get date input elements
    const startInput = document.getElementById('kpiGraphStartDate');
    const endInput = document.getElementById('kpiGraphEndDate');

    // If user has not selected a date, set to last 10 work days
    let setDefault = !startInput.value || !endInput.value;
    let endDate = new Date();
    let startDate = new Date();
    if (setDefault) {
        // Find last 10 work days
        let workdays = 0;
        endDate = new Date();
        startDate = new Date();
        while (workdays < 10) {
            const day = startDate.getDay();
            if (day !== 0 && day !== 6) {
                workdays++;
            }
            if (workdays < 10) {
                startDate.setDate(startDate.getDate() - 1);
            }
        }
        // startDate is now the 10th workday before today
        startInput.value = formatDateYYYYMMDD(startDate);
        endInput.value = formatDateYYYYMMDD(endDate);
    } else {
        startDate = new Date(startInput.value);
        endDate = new Date(endInput.value);
    }

    // Get initial selected people
    const personCheckboxes = Array.from(document.querySelectorAll('.person-filter'));
    let selectedPeople = personCheckboxes.filter(cb => cb.checked).map(cb => cb.value);

    // Render chart for default range and people
    await renderKpiChart(startDate, endDate, selectedPeople);

    // Add event listeners to update chart on date or person change
    function updateChart() {
        const newStart = new Date(startInput.value);
        const newEnd = new Date(endInput.value);
        selectedPeople = personCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
        if (newStart <= newEnd) {
            renderKpiChart(newStart, newEnd, selectedPeople);
        }
    }
    startInput.onchange = updateChart;
    endInput.onchange = updateChart;
    personCheckboxes.forEach(cb => cb.onchange = updateChart);
};

// Helper to format date as yyyy-mm-dd
function formatDateYYYYMMDD(date) {
    return date.toISOString().slice(0, 10);
}

// Modal close logic
const closeKpiGraphModalBtn = document.getElementById('closeKpiGraphModal');
if (closeKpiGraphModalBtn) {
    closeKpiGraphModalBtn.onclick = function() {
        document.getElementById('kpiGraphModal').style.display = 'none';
    };
}
window.onclick = function(event) {
    const modal = document.getElementById('kpiGraphModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}; 