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
        
        querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.date === date && data.owner === owner) {
                entry = { id: doc.id, ...data };
            }
        });
        
        if (entry) {
            document.getElementById('entryDate').value = entry.date;
            document.getElementById('callsMade').value = entry.calls;
            document.getElementById('meetingsScheduled').value = entry.meetings;
            document.getElementById('owner').value = entry.owner;
            
            // Scroll to form
            document.getElementById('kpiForm').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error("Error editing entry:", error);
    }
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

// Make sure stats are calculated on page load
document.addEventListener('DOMContentLoaded', async () => {
    await updateTable();
    calculateRecentStats();
}); 