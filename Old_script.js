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

// Add this CSS to your stylesheet or add it inline
const style = document.createElement('style');
style.textContent = `
    .overdue {
        background-color: #ff0000 !important;
        color: white !important;
    }
`;
document.head.appendChild(style);

// First, define loadLeads and its helper functions
async function loadLeads() {
    try {
        const querySnapshot = await getDocs(collection(db, "leads"));
        const leadsTable = document.getElementById('leadsTable');
        
        if (!leadsTable) {
            console.error("Leads table element not found");
            return;
        }
        
        leadsTable.innerHTML = ''; // Clear existing content
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            addLeadToTable(data, doc.id);
        });
        
        updateLeadStatistics();
    } catch (error) {
        console.error("Error loading leads:", error);
    }
}

function addLeadToTable(data, docId) {
    const leadsTable = document.getElementById('leadsTable');
    if (!leadsTable) return;

    const row = document.createElement('tr');
    row.dataset.docId = docId;
    
    row.innerHTML = `
        <td>${data.company}</td>
        <td>${data.source}</td>
        <td>${data.owner}</td>
        <td>${data.nextSteps || ''}</td>
        <td>${data.nextActivity || ''}</td>
        <td>
            <button class="action-btn delete-btn">Delete</button>
        </td>
    `;

    // Add delete functionality
    row.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Delete this lead?')) {
            await deleteDoc(doc(db, "leads", docId));
            row.remove();
            updateLeadStatistics();
        }
    });

    leadsTable.appendChild(row);
}

function updateLeadStatistics() {
    const leadsTable = document.getElementById('leadsTable');
    if (!leadsTable) return;

    const rows = Array.from(leadsTable.rows);
    
    // Update statistics
    document.getElementById('totalLeadsCount').textContent = rows.length;
    document.getElementById('activeLeadsCount').textContent = rows.length; // For now, all leads are active
    
    // You can add more complex statistics calculations here later
}

// Then define the initialization function
async function initializeDashboard() {
    try {
        // Show Leads page by default
        document.querySelectorAll('.page').forEach(page => {
            page.style.display = 'none';
        });
        document.getElementById('leadsPage').style.display = 'block';

        // Set up navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pageId = btn.getAttribute('data-page');
                
                // Update button states
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update page visibility
                document.querySelectorAll('.page').forEach(page => {
                    page.style.display = 'none';
                });
                document.getElementById(pageId).style.display = 'block';

                // Load data based on the selected page
                switch(pageId) {
                    case 'salesDashboard':
                        loadProspects();
                        break;
                    case 'salesTodo':
                        loadTasks();
                        break;
                    case 'brandGrowth':
                        loadBrands();
                        break;
                    case 'leadsPage':
                        loadLeads();
                        break;
                }
            });
        });

        // Load initial data
        await loadLeads();
        
        // Set up event listeners for all add buttons
        document.getElementById('addLeadBtn')?.addEventListener('click', addLead);
        document.getElementById('addProspectBtn')?.addEventListener('click', addProspect);
        document.getElementById('addTaskBtn')?.addEventListener('click', addTask);
        document.getElementById('addBrandBtn')?.addEventListener('click', addBrand);

    } catch (error) {
        console.error("Error initializing dashboard:", error);
    }
}

// Define the addLead function
async function addLead() {
    try {
        // Get basic required values
        const company = document.getElementById('leadCompany').value.trim();
        const source = document.getElementById('leadSource').value;
        const owner = document.getElementById('leadOwner').value;
        const nextSteps = document.getElementById('leadNextSteps').value.trim();
        const nextActivity = document.getElementById('leadNextActivity').value;

        // Basic validation
        if (!company) {
            alert('Please enter a company name');
            return;
        }

        // Create lead data object
        const leadData = {
            company,
            source,
            owner,
            nextSteps,
            nextActivity,
            createdAt: new Date().toISOString()
        };

        // Add to Firestore
        const docRef = await addDoc(collection(db, "leads"), leadData);
        
        // Add to table
        addLeadToTable(leadData, docRef.id);
        
        // Clear form
        document.getElementById('leadCompany').value = '';
        document.getElementById('leadSource').value = 'Referral';
        document.getElementById('leadOwner').value = 'Greyson';
        document.getElementById('leadNextSteps').value = '';
        document.getElementById('leadNextActivity').value = '';

        // Update statistics
        updateLeadStatistics();

    } catch (error) {
        console.error("Error adding lead:", error);
        alert("Error adding lead: " + error.message);
    }
}

// Finally, set up the login handler
document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    const passwordInput = document.getElementById('passwordInput');
    
    if (loginButton && passwordInput) {
        loginButton.addEventListener('click', handleLogin);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }
});

async function handleLogin() {
    const password = document.getElementById('passwordInput').value;
    const correctPassword = '2020';

    if (password === correctPassword) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';
        document.getElementById('passwordInput').value = '';
        initializeDashboard();
    } else {
        document.getElementById('loginError').textContent = 'Incorrect password';
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('passwordInput').value = '';
    }
}

// Add these new functions for Prospects
async function loadProspects() {
    try {
        const querySnapshot = await getDocs(collection(db, "prospects"));
        const prospectsTable = document.getElementById('prospectsTable');
        if (!prospectsTable) return;
        
        prospectsTable.innerHTML = '';
        let totalMRR = 0;
        let prospectCount = 0;
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            addProspectToTable(data, doc.id);
            
            if (data.status === 'In-Progress') {
                totalMRR += Number(data.revenueValue) || 0;
                prospectCount++;
            }
        });
        
        // Update statistics
        document.getElementById('prospectCount').textContent = prospectCount;
        document.getElementById('prospectMRR').textContent = `$${totalMRR.toLocaleString()}`;
    } catch (error) {
        console.error("Error loading prospects:", error);
    }
}

async function addProspect() {
    try {
        const prospectData = {
            name: document.getElementById('prospectName').value,
            nextSteps: document.getElementById('nextSteps').value,
            dueDate: document.getElementById('dueDate').value,
            signatureExpected: document.getElementById('signatureExpected').value,
            salesLead: document.getElementById('salesLead').value,
            revenueValue: Number(document.getElementById('revenueValue').value),
            status: document.getElementById('prospectStatus').value,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "prospects"), prospectData);
        addProspectToTable(prospectData, docRef.id);
        
        // Clear form
        document.getElementById('prospectName').value = '';
        document.getElementById('nextSteps').value = '';
        document.getElementById('dueDate').value = '';
        document.getElementById('revenueValue').value = '';
        
        await loadProspects(); // Reload to update statistics
    } catch (error) {
        console.error("Error adding prospect:", error);
    }
}

// Add these new functions for Tasks
async function loadTasks() {
    try {
        const querySnapshot = await getDocs(collection(db, "tasks"));
        const tasksTable = document.getElementById('tasksTable');
        if (!tasksTable) return;
        
        tasksTable.innerHTML = '';
        let todayTasks = 0;
        
        const today = new Date().toISOString().split('T')[0];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            addTaskToTable(data, doc.id);
            
            if (data.dueDate === today) {
                todayTasks++;
            }
        });
        
        document.getElementById('salesTasksDueToday').textContent = todayTasks;
    } catch (error) {
        console.error("Error loading tasks:", error);
    }
}

async function addTask() {
    try {
        const taskData = {
            name: document.getElementById('taskName').value,
            assignee: document.getElementById('taskAssignee').value,
            dueDate: document.getElementById('taskDueDate').value,
            completed: false,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "tasks"), taskData);
        addTaskToTable(taskData, docRef.id);
        
        // Clear form
        document.getElementById('taskName').value = '';
        document.getElementById('taskDueDate').value = '';
        
        await loadTasks(); // Reload to update statistics
    } catch (error) {
        console.error("Error adding task:", error);
    }
}

// Add these new functions for Brands
async function loadBrands() {
    try {
        const querySnapshot = await getDocs(collection(db, "brands"));
        const brandsTable = document.getElementById('brandsTable');
        if (!brandsTable) return;
        
        brandsTable.innerHTML = '';
        let pod1Count = 0;
        let pod2Count = 0;
        let poorRelationships = 0;
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            addBrandToTable(data, doc.id);
            
            if (data.teamResponsible === 'Pod 1') pod1Count++;
            if (data.teamResponsible === 'Pod 2') pod2Count++;
            if (data.relationshipStatus === 'Poor') poorRelationships++;
        });
        
        // Update statistics
        document.getElementById('pod1Count').textContent = pod1Count;
        document.getElementById('pod2Count').textContent = pod2Count;
        document.getElementById('poorRelationships').textContent = poorRelationships;
    } catch (error) {
        console.error("Error loading brands:", error);
    }
}

async function addBrand() {
    try {
        const brandData = {
            name: document.getElementById('brandName').value,
            team: document.getElementById('teamResponsible').value,
            relationship: document.getElementById('relationshipStatus').value,
            sensitivity: document.getElementById('currentSensitivity').value,
            action: document.getElementById('correctiveAction').value,
            dueBy: document.getElementById('dueBy').value,
            revenue: Number(document.getElementById('trailing30Revenue').value),
            yoy: Number(document.getElementById('yoyPercentage').value),
            nextMeeting: document.getElementById('nextMeetingDate').value,
            status: document.getElementById('taskStatus').value,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, "brands"), brandData);
        addBrandToTable(brandData, docRef.id);
        
        // Clear form
        document.getElementById('brandName').value = '';
        document.getElementById('correctiveAction').value = '';
        document.getElementById('trailing30Revenue').value = '';
        document.getElementById('yoyPercentage').value = '';
        
        await loadBrands(); // Reload to update statistics
    } catch (error) {
        console.error("Error adding brand:", error);
    }
}

// Helper functions to add items to tables
function addProspectToTable(data, docId) {
    const table = document.getElementById('prospectsTable');
    if (!table) return;

    const row = document.createElement('tr');
    row.dataset.docId = docId;
    row.className = `row-${data.salesLead.toLowerCase()}`;
    
    row.innerHTML = `
        <td>${data.name}</td>
        <td>${data.nextSteps}</td>
        <td>${data.dueDate}</td>
        <td>${data.signatureExpected}</td>
        <td>${data.salesLead}</td>
        <td>$${Number(data.revenueValue).toLocaleString()}</td>
        <td>${data.status}</td>
        <td>
            <button class="action-btn delete-btn">Delete</button>
        </td>
    `;

    row.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Delete this prospect?')) {
            await deleteDoc(doc(db, "prospects", docId));
            row.remove();
            loadProspects();
        }
    });

    table.appendChild(row);
}

function addBrandToTable(data, docId) {
    const table = document.getElementById('brandsTable');
    if (!table) return;

    const row = document.createElement('tr');
    row.dataset.docId = docId;
    
    row.innerHTML = `
        <td>${data.name}</td>
        <td>${data.team}</td>
        <td>${data.relationship}</td>
        <td>${data.sensitivity}</td>
        <td>${data.action}</td>
        <td>${data.dueBy}</td>
        <td>$${Number(data.revenue).toLocaleString()}</td>
        <td>${data.yoy}%</td>
        <td>${data.nextMeeting}</td>
        <td>${data.status}</td>
        <td>
            <button class="action-btn delete-btn">Delete</button>
        </td>
    `;

    row.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Delete this brand?')) {
            await deleteDoc(doc(db, "brands", docId));
            row.remove();
            loadBrands();
        }
    });

    table.appendChild(row);
}
