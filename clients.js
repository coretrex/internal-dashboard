// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Load clients function
async function loadClients() {
    console.log('Loading clients...');
    const tbody = document.getElementById('clientsTable').querySelector('tbody');
    
    if (!tbody) {
        console.error('Could not find table body element');
        return;
    }
    
    tbody.innerHTML = '';

    try {
        const querySnapshot = await getDocs(collection(db, "brands"));
        console.log('Total documents found:', querySnapshot.size);

        let pod1Count = 0;
        let pod2Count = 0;
        let poorRelationships = 0;
        let meetingsThisWeek = 0;
        let tasksDueToday = 0;

        // Get today's date and week range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + 7);

        // Create arrays to store clients by pod
        const pod1Clients = [];
        const pod2Clients = [];

        querySnapshot.forEach((doc) => {
            const rawData = doc.data();
            
            // Update statistics
            if (rawData.teamResponsible === 'Pod 1') pod1Count++;
            if (rawData.teamResponsible === 'Pod 2') pod2Count++;
            if (rawData.relationshipStatus === 'Poor') poorRelationships++;

            // Check meetings and tasks
            if (rawData.nextMeetingDate) {
                const meetingDate = new Date(rawData.nextMeetingDate);
                if (meetingDate >= today && meetingDate <= endOfWeek) {
                    meetingsThisWeek++;
                }
            }

            if (rawData.dueBy) {
                const dueDate = new Date(rawData.dueBy);
                if (dueDate.toDateString() === today.toDateString()) {
                    tasksDueToday++;
                }
            }

            const mappedData = {
                brandName: rawData.brandName || rawData.name || rawData.company || rawData.client || '',
                team: rawData.teamResponsible || rawData.team || '',
                relationship: rawData.relationshipStatus || rawData.relationship || '',
                sensitivity: rawData.currentSensitivity || rawData.sensitivity || '',
                action: rawData.correctiveAction || rawData.action || '',
                dueBy: rawData.dueBy || '',
                revenue: rawData.trailing30Revenue || rawData.revenue || 0,
                yoy: rawData.yoyPercentage || rawData.yoy || 0,
                nextMeeting: rawData.nextMeetingDate || rawData.nextMeeting || '',
                status: rawData.taskStatus || rawData.status || '',
                docId: doc.id
            };

            // Sort into pod arrays
            if (mappedData.team === 'Pod 1') {
                pod1Clients.push(mappedData);
            } else if (mappedData.team === 'Pod 2') {
                pod2Clients.push(mappedData);
            }
        });

        // Sort each pod array by brand name
        pod1Clients.sort((a, b) => a.brandName.localeCompare(b.brandName));
        pod2Clients.sort((a, b) => a.brandName.localeCompare(b.brandName));

        // Create pod header and add Pod 1 clients
        if (pod1Clients.length > 0) {
            const pod1Header = document.createElement('tr');
            pod1Header.innerHTML = `<td colspan="11" class="pod-header">Pod 1</td>`;
            tbody.appendChild(pod1Header);
            
            pod1Clients.forEach(client => {
                const row = createClientRow(client, client.docId);
                tbody.appendChild(row);
            });
        }

        // Create pod header and add Pod 2 clients
        if (pod2Clients.length > 0) {
            const pod2Header = document.createElement('tr');
            pod2Header.innerHTML = `<td colspan="11" class="pod-header">Pod 2</td>`;
            tbody.appendChild(pod2Header);
            
            pod2Clients.forEach(client => {
                const row = createClientRow(client, client.docId);
                tbody.appendChild(row);
            });
        }

        // Update UI statistics
        document.getElementById('pod1Count').textContent = pod1Count;
        document.getElementById('pod2Count').textContent = pod2Count;
        document.getElementById('poorRelationships').textContent = poorRelationships;
        document.getElementById('meetingsThisWeek').textContent = meetingsThisWeek;
        document.getElementById('tasksDueToday').textContent = tasksDueToday;

    } catch (error) {
        console.error("Error loading clients:", error);
    }
}

// Create client row function with additional logging
function createClientRow(data, id) {
    console.log('Creating row for:', data); // Debug log
    
    const row = document.createElement('tr');
    row.dataset.docId = id;
    
    const brandName = data.brandName || data.name || ''; // Try both fields
    console.log('Using brand name:', brandName); // Debug log
    
    row.innerHTML = `
        <td>${brandName}</td>
        <td>${data.team || ''}</td>
        <td>${data.relationship || ''}</td>
        <td>${data.sensitivity || ''}</td>
        <td>${data.action || ''}</td>
        <td>${data.dueBy || ''}</td>
        <td>$${(data.revenue || 0).toLocaleString()}</td>
        <td>${data.yoy || 0}%</td>
        <td>${data.nextMeeting || ''}</td>
        <td>${data.status || ''}</td>
        <td>
            <button class="action-btn edit-btn"><i class="fas fa-edit"></i></button>
            <button class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
        </td>
    `;

    return row;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing clients page...');
    console.log('Firebase app:', app);
    console.log('Firestore database:', db);
    loadClients();
    
    const addClientBtn = document.getElementById('addClientBtn');
    if (addClientBtn) {
        addClientBtn.addEventListener('click', addClient);
    } else {
        console.error('Add Client button not found');
    }
});

// Add this function
async function addClient() {
    const brandName = document.getElementById('brandName').value;
    if (!brandName) {
        alert('Please enter a brand name');
        return;
    }

    try {
        const clientData = {
            brandName: brandName, // Make sure we're using the correct field name
            teamResponsible: document.getElementById('teamResponsible').value,
            relationshipStatus: document.getElementById('relationshipStatus').value,
            currentSensitivity: document.getElementById('currentSensitivity').value,
            correctiveAction: document.getElementById('correctiveAction').value,
            dueBy: document.getElementById('dueBy').value,
            trailing30Revenue: parseFloat(document.getElementById('trailing30Revenue').value) || 0,
            yoyPercentage: parseFloat(document.getElementById('yoyPercentage').value) || 0,
            nextMeetingDate: document.getElementById('nextMeetingDate').value,
            taskStatus: document.getElementById('taskStatus').value
        };

        await addDoc(collection(db, "brands"), clientData);
        await loadClients(); // Reload the table

        // Clear form
        document.getElementById('brandName').value = '';
        document.getElementById('correctiveAction').value = '';
        document.getElementById('trailing30Revenue').value = '';
        document.getElementById('yoyPercentage').value = '';
        
    } catch (error) {
        console.error("Error adding client:", error);
        alert("Error adding client: " + error.message);
    }
} 