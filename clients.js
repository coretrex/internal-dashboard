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
                teamResponsible: rawData.teamResponsible || rawData.team || '',
                relationshipStatus: rawData.relationshipStatus || rawData.relationship || '',
                currentSensitivity: rawData.currentSensitivity || rawData.sensitivity || '',
                correctiveAction: rawData.correctiveAction || rawData.action || '',
                dueBy: rawData.dueBy || '',
                trailing30Revenue: rawData.trailing30Revenue || rawData.revenue || 0,
                yoyPercentage: rawData.yoyPercentage || rawData.yoy || 0,
                nextMeetingDate: rawData.nextMeetingDate || rawData.nextMeeting || '',
                docId: doc.id
            };

            // Sort into pod arrays
            if (mappedData.teamResponsible === 'Pod 1') {
                pod1Clients.push(mappedData);
            } else if (mappedData.teamResponsible === 'Pod 2') {
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
function createClientRow(data, docId) {
    console.log('Creating row for:', data);
    const row = document.createElement('tr');
    row.dataset.docId = docId;
    
    // Add this helper function at the start of createClientRow
    const getRelationshipEmoji = (status) => {
        switch(status) {
            case 'Strong':
                return `<span class="relationship-emoji" data-status="Strong">&#9786;</span>`; // ☺
            case 'Medium':
                return `<span class="relationship-emoji" data-status="Medium">&#128528;</span>`; // 😐
            case 'Poor':
                return `<span class="relationship-emoji" data-status="Poor">&#128545;</span>`; // 😡
            default:
                return '';
        }
    };

    // Map the data consistently
    const mappedData = {
        brandName: data.brandName || '',
        teamResponsible: data.teamResponsible || '',
        relationshipStatus: data.relationshipStatus || '',
        currentSensitivity: data.currentSensitivity || '',
        correctiveAction: data.correctiveAction || '',
        dueBy: data.dueBy || '',
        trailing30Revenue: data.trailing30Revenue || 0,
        yoyPercentage: data.yoyPercentage || 0,
        nextMeetingDate: data.nextMeetingDate || '',
    };
    
    row.innerHTML = `
        <td>${mappedData.brandName}</td>
        <td class="hide-column">${mappedData.teamResponsible}</td>
        <td>${getRelationshipEmoji(mappedData.relationshipStatus)}</td>
        <td>${mappedData.currentSensitivity}</td>
        <td>${mappedData.correctiveAction}</td>
        <td>${mappedData.dueBy}</td>
        <td>$${(mappedData.trailing30Revenue).toLocaleString()}</td>
        <td>${mappedData.yoyPercentage}%</td>
        <td>${mappedData.nextMeetingDate}</td>
        <td>
            <button class="action-btn edit-btn"><i class="fas fa-edit"></i></button>
            <button class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
        </td>
    `;

    // Add edit button functionality
    const editBtn = row.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const cells = row.cells;
            const currentData = {
                brandName: mappedData.brandName,
                teamResponsible: mappedData.teamResponsible,
                relationshipStatus: mappedData.relationshipStatus,
                currentSensitivity: mappedData.currentSensitivity,
                correctiveAction: mappedData.correctiveAction,
                dueBy: mappedData.dueBy,
                trailing30Revenue: mappedData.trailing30Revenue,
                yoyPercentage: mappedData.yoyPercentage,
                nextMeetingDate: mappedData.nextMeetingDate
            };

            // Replace cells with input fields
            cells[0].innerHTML = `<input type="text" class="editable-input" value="${currentData.brandName}">`;
            cells[1].innerHTML = `<select class="editable-input">
                <option value="Pod 1" ${currentData.teamResponsible === 'Pod 1' ? 'selected' : ''}>Pod 1</option>
                <option value="Pod 2" ${currentData.teamResponsible === 'Pod 2' ? 'selected' : ''}>Pod 2</option>
            </select>`;
            cells[2].innerHTML = `<select class="editable-input">
                <option value="Poor" ${currentData.relationshipStatus === 'Poor' ? 'selected' : ''}>Poor</option>
                <option value="Medium" ${currentData.relationshipStatus === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Strong" ${currentData.relationshipStatus === 'Strong' ? 'selected' : ''}>Strong</option>
            </select>`;
            cells[3].innerHTML = `<select class="editable-input">
                <option value="Poor Profit" ${currentData.currentSensitivity === 'Poor Profit' ? 'selected' : ''}>Poor Profit</option>
                <option value="Stagnant Sales" ${currentData.currentSensitivity === 'Stagnant Sales' ? 'selected' : ''}>Stagnant Sales</option>
                <option value="Lack of Clarity" ${currentData.currentSensitivity === 'Lack of Clarity' ? 'selected' : ''}>Lack of Clarity</option>
                <option value="CoreTrex Cost" ${currentData.currentSensitivity === 'CoreTrex Cost' ? 'selected' : ''}>CoreTrex Cost</option>
                <option value="Lack of Trust" ${currentData.currentSensitivity === 'Lack of Trust' ? 'selected' : ''}>Lack of Trust</option>
            </select>`;
            cells[4].innerHTML = `<input type="text" class="editable-input" value="${currentData.correctiveAction}">`;
            cells[5].innerHTML = `<input type="date" class="editable-input" value="${currentData.dueBy}">`;
            cells[6].innerHTML = `<input type="number" step="0.01" class="editable-input" value="${currentData.trailing30Revenue}">`;
            cells[7].innerHTML = `<input type="number" step="0.01" class="editable-input" value="${currentData.yoyPercentage}">`;
            cells[8].innerHTML = `<input type="date" class="editable-input" value="${currentData.nextMeetingDate}">`;

            // Replace action buttons with save/cancel
            cells[9].innerHTML = `
                <button class="action-btn save-btn">Save</button>
            `;

            // Add save functionality
            const saveBtn = cells[9].querySelector('.save-btn');
            saveBtn.addEventListener('click', async () => {
                try {
                    const updatedData = {
                        brandName: cells[0].querySelector('input').value.trim(),
                        teamResponsible: cells[1].querySelector('select').value,
                        relationshipStatus: cells[2].querySelector('select').value,
                        currentSensitivity: cells[3].querySelector('select').value,
                        correctiveAction: cells[4].querySelector('input').value.trim(),
                        dueBy: cells[5].querySelector('input').value,
                        trailing30Revenue: parseFloat(cells[6].querySelector('input').value) || 0,
                        yoyPercentage: parseFloat(cells[7].querySelector('input').value) || 0,
                        nextMeetingDate: cells[8].querySelector('input').value
                    };

                    await updateDoc(doc(db, "brands", docId), updatedData);
                    await loadClients(); // Reload the table to reflect changes
                } catch (error) {
                    console.error("Error updating client:", error);
                    alert("Error updating client: " + error.message);
                }
            });
        });
    }

    // Add delete button functionality
    const deleteBtn = row.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete ${mappedData.brandName}?`)) {
                try {
                    await deleteDoc(doc(db, "brands", docId));
                    await loadClients(); // Reload the table after deletion
                } catch (error) {
                    console.error("Error deleting client:", error);
                    alert("Error deleting client: " + error.message);
                }
            }
        });
    }

    return row;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing clients page...');
    console.log('Firebase app:', app);
    console.log('Firestore database:', db);
    loadClients();
    
    // Create and insert toggle button before input section
    const inputSection = document.querySelector('.input-section');
    const toggleButton = document.createElement('button');
    toggleButton.className = 'toggle-add-client';
    toggleButton.textContent = '+ Add Client';
    inputSection.parentNode.insertBefore(toggleButton, inputSection);
    
    // Add toggle functionality
    toggleButton.addEventListener('click', () => {
        inputSection.classList.toggle('show');
        toggleButton.textContent = inputSection.classList.contains('show') 
            ? '- Hide Form' 
            : '+ Add Client';
    });
    
    const addClientBtn = document.getElementById('addClientBtn');
    if (addClientBtn) {
        addClientBtn.addEventListener('click', () => {
            addClient();
            // Hide the form after successful addition
            inputSection.classList.remove('show');
            toggleButton.textContent = '+ Add Client';
        });
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
            brandName: brandName,
            teamResponsible: document.getElementById('teamResponsible').value,
            relationshipStatus: document.getElementById('relationshipStatus').value,
            currentSensitivity: document.getElementById('currentSensitivity').value,
            correctiveAction: document.getElementById('correctiveAction').value,
            dueBy: document.getElementById('dueBy').value,
            trailing30Revenue: parseFloat(document.getElementById('trailing30Revenue').value) || 0,
            yoyPercentage: parseFloat(document.getElementById('yoyPercentage').value) || 0,
            nextMeetingDate: document.getElementById('nextMeetingDate').value
        };

        await addDoc(collection(db, "brands"), clientData);
        await loadClients();

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