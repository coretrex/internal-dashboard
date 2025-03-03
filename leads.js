// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp
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

document.addEventListener('DOMContentLoaded', function() {
    // Initialize leads array
    let leads = [];
    
    // Load leads from Firebase instead of localStorage
    async function loadLeads() {
        try {
            const querySnapshot = await getDocs(collection(db, 'leads'));
            leads = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('Loaded leads:', leads); // Debug log
            displayLeads();
            updateMetrics();
        } catch (error) {
            console.error("Error loading leads:", error);
        }
    }

    // DOM Elements
    const addLeadBtn = document.getElementById('addLeadBtn');
    const leadsListDiv = document.getElementById('leadsList');
    const totalMRRElement = document.getElementById('totalMRR');
    const totalLeadsElement = document.getElementById('totalLeads');
    const greysonLeadsElement = document.getElementById('greysonLeads');
    const robbyLeadsElement = document.getElementById('robbyLeads');

    // Add these modal elements
    const modal = document.getElementById('contactModal');
    const modalContent = document.getElementById('modalContent');
    const span = document.getElementsByClassName('close')[0];

    const editButton = document.getElementById('editButton');
    const saveButton = document.getElementById('saveButton');
    let currentEditId = null;

    // Add these CSV import elements to your DOM Elements section
    const importCsvBtn = document.getElementById('importCsvBtn');
    const csvFileInput = document.getElementById('csvFileInput');

    // Add search functionality
    const searchInput = document.getElementById('searchInput');
    
    const filterRobbyBtn = document.getElementById('filterRobby');
    const filterGreysonBtn = document.getElementById('filterGreyson');
    let currentFilter = 'all';

    // Add these DOM element references at the top with other DOM elements
    const inputSection = document.querySelector('.input-section');
    const toggleInputBtn = document.getElementById('toggleInputBtn');

    // Add this event listener for the toggle button
    toggleInputBtn.addEventListener('click', function() {
        inputSection.classList.toggle('hidden');
        toggleInputBtn.innerHTML = inputSection.classList.contains('hidden') 
            ? '<i class="fas fa-plus"></i> Add New Lead'
            : '<i class="fas fa-minus"></i> Hide Form';
    });

    filterRobbyBtn.addEventListener('click', function() {
        if (currentFilter === 'robby') {
            // If already filtering Robby's leads, show all leads
            currentFilter = 'all';
            filterRobbyBtn.classList.remove('active');
            displayFilteredLeads(leads);
        } else {
            // Filter to show only Robby's leads
            currentFilter = 'robby';
            filterRobbyBtn.classList.add('active');
            filterGreysonBtn.classList.remove('active');
            const robbyLeads = leads.filter(lead => lead.owner === 'Robby');
            displayFilteredLeads(robbyLeads);
        }
    });

    filterGreysonBtn.addEventListener('click', function() {
        if (currentFilter === 'greyson') {
            // If already filtering Greyson's leads, show all leads
            currentFilter = 'all';
            filterGreysonBtn.classList.remove('active');
            displayFilteredLeads(leads);
        } else {
            // Filter to show only Greyson's leads
            currentFilter = 'greyson';
            filterGreysonBtn.classList.add('active');
            filterRobbyBtn.classList.remove('active');
            const greysonLeads = leads.filter(lead => lead.owner === 'Greyson');
            displayFilteredLeads(greysonLeads);
        }
    });

    // Modify the existing search functionality to respect the current owner filter
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        let filteredLeads = leads;

        // Apply owner filter first
        if (currentFilter === 'robby') {
            filteredLeads = leads.filter(lead => lead.owner === 'Robby');
        } else if (currentFilter === 'greyson') {
            filteredLeads = leads.filter(lead => lead.owner === 'Greyson');
        }

        // Then apply search filter
        filteredLeads = filteredLeads.filter(lead => {
            return (
                lead.brandName.toLowerCase().includes(searchTerm) ||
                lead.firstName.toLowerCase().includes(searchTerm) ||
                lead.lastName.toLowerCase().includes(searchTerm) ||
                lead.email.toLowerCase().includes(searchTerm) ||
                lead.status.toLowerCase().includes(searchTerm) ||
                lead.nextSteps.toLowerCase().includes(searchTerm) ||
                lead.owner.toLowerCase().includes(searchTerm)
            );
        });
        
        displayFilteredLeads(filteredLeads);
    });

    // Move helper functions outside of viewContact
    function createViewHTML(lead) {
        // Handle Firebase Timestamp or string date
        let createdDate = 'N/A';
        if (lead.createdAt) {
            // Check if it's a Firebase Timestamp
            if (lead.createdAt.toDate) {
                createdDate = lead.createdAt.toDate().toLocaleString();
            } else if (lead.createdAt.seconds) {
                // Handle server timestamp format
                createdDate = new Date(lead.createdAt.seconds * 1000).toLocaleString();
            } else {
                // Handle string date
                createdDate = new Date(lead.createdAt).toLocaleString();
            }
        }

        return `
            <div class="contact-info">
                <p><strong>Brand Name:</strong> ${lead.brandName}</p>
                <p><strong>First Name:</strong> ${lead.firstName}</p>
                <p><strong>Last Name:</strong> ${lead.lastName}</p>
                <p><strong>Email:</strong> ${lead.email}</p>
                <p><strong>Phone:</strong> ${lead.phone}</p>
                <p><strong>Status:</strong> ${lead.status}</p>
                <p><strong>Lead Status:</strong> ${lead.leadStatus || 'Active'}</p>
                <p><strong>Next Steps:</strong> ${lead.nextSteps}</p>
                <p><strong>Due Date:</strong> ${lead.dueDate}</p>
                <p><strong>Retainer Value:</strong> $${lead.retainerValue}</p>
                <p><strong>Owner:</strong> ${lead.owner}</p>
                <p><strong>Source:</strong> ${lead.source}</p>
                <p><strong>Created:</strong> ${createdDate}</p>
            </div>
        `;
    }

    function createEditHTML(lead) {
        return `
            <div class="edit-form">
                <div class="input-group">
                    <label>Brand Name:</label>
                    <input type="text" id="edit-brandName" value="${lead.brandName}">
                </div>
                <div class="input-group">
                    <label>First Name:</label>
                    <input type="text" id="edit-firstName" value="${lead.firstName}">
                </div>
                <div class="input-group">
                    <label>Last Name:</label>
                    <input type="text" id="edit-lastName" value="${lead.lastName}">
                </div>
                <div class="input-group">
                    <label>Email:</label>
                    <input type="email" id="edit-email" value="${lead.email}">
                </div>
                <div class="input-group">
                    <label>Phone:</label>
                    <input type="tel" id="edit-phone" value="${lead.phone}">
                </div>
                <div class="input-group">
                    <label>Status:</label>
                    <select id="edit-status">
                        <option value="Meeting Hunting" ${lead.status === 'Meeting Hunting' ? 'selected' : ''}>Meeting Hunting</option>
                        <option value="Proposal" ${lead.status === 'Proposal' ? 'selected' : ''}>Proposal</option>
                        <option value="Phone Call" ${lead.status === 'Phone Call' ? 'selected' : ''}>Phone Call</option>
                        <option value="Email" ${lead.status === 'Email' ? 'selected' : ''}>Email</option>
                        <option value="Social DM" ${lead.status === 'Social DM' ? 'selected' : ''}>Social DM</option>
                        <option value="Door Knock" ${lead.status === 'Door Knock' ? 'selected' : ''}>Door Knock</option>
                        <option value="Other" ${lead.status === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Lead Status:</label>
                    <select id="edit-leadStatus">
                        <option value="Active" ${(lead.leadStatus === 'Active' || !lead.leadStatus) ? 'selected' : ''}>Active</option>
                        <option value="Stalled" ${lead.leadStatus === 'Stalled' ? 'selected' : ''}>Stalled</option>
                        <option value="Moderate" ${lead.leadStatus === 'Moderate' ? 'selected' : ''}>Moderate</option>
                        <option value="Do Not Contact" ${lead.leadStatus === 'Do Not Contact' ? 'selected' : ''}>Do Not Contact</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Next Steps:</label>
                    <input type="text" id="edit-nextSteps" value="${lead.nextSteps}">
                </div>
                <div class="input-group">
                    <label>Due Date:</label>
                    <input type="date" id="edit-dueDate" value="${lead.dueDate}">
                </div>
                <div class="input-group">
                    <label>Retainer Value:</label>
                    <input type="number" id="edit-retainerValue" value="${lead.retainerValue}">
                </div>
                <div class="input-group">
                    <label>Owner:</label>
                    <select id="edit-owner">
                        <option value="Greyson" ${lead.owner === 'Greyson' ? 'selected' : ''}>Greyson</option>
                        <option value="Robby" ${lead.owner === 'Robby' ? 'selected' : ''}>Robby</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Source:</label>
                    <select id="edit-source">
                        <option value="Email" ${lead.source === 'Email' ? 'selected' : ''}>Email</option>
                        <option value="Ads" ${lead.source === 'Ads' ? 'selected' : ''}>Ads</option>
                        <option value="Cold Call" ${lead.source === 'Cold Call' ? 'selected' : ''}>Cold Call</option>
                        <option value="Referral" ${lead.source === 'Referral' ? 'selected' : ''}>Referral</option>
                        <option value="Google Search" ${lead.source === 'Google Search' ? 'selected' : ''}>Google Search</option>
                    </select>
                </div>
            </div>
        `;
    }

    // Update metrics
    function updateMetrics() {
        // Reset all counters
        let totalMRR = 0;
        let greysonLeadsCount = 0;
        let robbyLeadsCount = 0;

        // Only count if we have leads
        if (leads && leads.length > 0) {
            totalMRR = leads.reduce((sum, lead) => sum + Number(lead.retainerValue || 0), 0);
            greysonLeadsCount = leads.filter(lead => lead.owner === 'Greyson').length;
            robbyLeadsCount = leads.filter(lead => lead.owner === 'Robby').length;
        }
        
        // Update the display
        totalMRRElement.textContent = `$${totalMRR.toLocaleString()}`;
        totalLeadsElement.textContent = leads.length;
        greysonLeadsElement.textContent = greysonLeadsCount;
        robbyLeadsElement.textContent = robbyLeadsCount;
    }

    // Modify addLeadBtn event listener to handle form visibility after submission
    addLeadBtn.addEventListener('click', async () => {
        const newLead = {
            brandName: document.getElementById('brandName').value,
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            status: document.getElementById('status').value,
            leadStatus: 'Active',
            nextSteps: document.getElementById('nextSteps').value,
            dueDate: document.getElementById('dueDate').value,
            retainerValue: document.getElementById('retainerValue').value,
            owner: document.getElementById('owner').value,
            source: document.getElementById('source').value,
            createdAt: serverTimestamp()
        };

        // Validate required fields
        if (!newLead.brandName || !newLead.firstName || !newLead.status) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            // Add to Firebase
            await addDoc(collection(db, 'leads'), newLead);
            
            // Clear input fields
            document.querySelectorAll('.input-field').forEach(input => input.value = '');
            
            // Hide the input section after successful submission
            inputSection.classList.add('hidden');
            toggleInputBtn.innerHTML = '<i class="fas fa-plus"></i> Add New Lead';
            
            // Reload leads from Firebase
            await loadLeads();
        } catch (error) {
            console.error("Error adding lead:", error);
            alert('Error adding lead. Please try again.');
        }
    });

    // Display leads
    function displayLeads() {
        displayFilteredLeads(leads);
    }

    // Modify deleteLead function
    window.deleteLead = async function(id) {
        try {
            await deleteDoc(doc(db, 'leads', id));
            await loadLeads();
        } catch (error) {
            console.error("Error deleting lead:", error);
            alert('Error deleting lead. Please try again.');
        }
    }

    // Update viewContact function to handle string ID
    window.viewContact = function(id) {
        currentEditId = id; // Store the ID as a string
        const lead = leads.find(lead => lead.id === id);
        if (lead) {
            modalContent.innerHTML = createViewHTML(lead);
            editButton.style.display = 'block';
            saveButton.style.display = 'none';
            modal.style.display = 'block';
        } else {
            console.error('Lead not found:', id);
        }
    }

    // Modal close button
    span.onclick = function() {
        modal.style.display = "none";
    }

    // Click outside modal to close
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Add event listeners for edit and save buttons
    editButton.addEventListener('click', function() {
        const lead = leads.find(lead => lead.id === currentEditId);
        modalContent.innerHTML = createEditHTML(lead);
        editButton.style.display = 'none';
        saveButton.style.display = 'block';
    });

    // Modify saveButton event listener
    saveButton.addEventListener('click', async function() {
        const leadRef = doc(db, 'leads', currentEditId);
        
        try {
            await updateDoc(leadRef, {
                brandName: document.getElementById('edit-brandName').value,
                firstName: document.getElementById('edit-firstName').value,
                lastName: document.getElementById('edit-lastName').value,
                email: document.getElementById('edit-email').value,
                phone: document.getElementById('edit-phone').value,
                status: document.getElementById('edit-status').value,
                leadStatus: document.getElementById('edit-leadStatus').value,
                nextSteps: document.getElementById('edit-nextSteps').value,
                dueDate: document.getElementById('edit-dueDate').value,
                retainerValue: document.getElementById('edit-retainerValue').value,
                owner: document.getElementById('edit-owner').value,
                source: document.getElementById('edit-source').value
            });

            await loadLeads();
            viewContact(currentEditId);
        } catch (error) {
            console.error("Error updating lead:", error);
            alert('Error updating lead. Please try again.');
        }
    });

    // Add CSV import functionality
    importCsvBtn.addEventListener('click', function() {
        csvFileInput.click();
    });

    csvFileInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                const text = e.target.result;
                const rows = text.split('\n');
                const headers = rows[0].split(',').map(header => header.trim());

                try {
                    let importedCount = 0;
                    let duplicateCount = 0;

                    // Get existing leads first
                    const querySnapshot = await getDocs(collection(db, 'leads'));
                    const existingLeads = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    // Process each row (skip header row)
                    for (let i = 1; i < rows.length; i++) {
                        if (rows[i].trim() === '') continue; // Skip empty rows
                        
                        const values = rows[i].split(',').map(value => value.trim());
                        const newLead = {
                            brandName: values[headers.indexOf('Brand Name')] || '',
                            firstName: values[headers.indexOf('First Name')] || '',
                            lastName: values[headers.indexOf('Last Name')] || '',
                            email: values[headers.indexOf('Email')] || '',
                            phone: values[headers.indexOf('Phone')] || '',
                            status: values[headers.indexOf('Status')] || 'Meeting Hunting',
                            leadStatus: values[headers.indexOf('Lead Status')] || 'Active',
                            nextSteps: values[headers.indexOf('Next Steps')] || '',
                            dueDate: values[headers.indexOf('Due Date')] || new Date().toISOString().split('T')[0],
                            retainerValue: values[headers.indexOf('Retainer Value')] || '0',
                            owner: values[headers.indexOf('Owner')] || 'Greyson',
                            source: values[headers.indexOf('Source')] || 'Import',
                            createdAt: serverTimestamp()
                        };

                        // Check for duplicates based on brand name AND email
                        const isDuplicate = existingLeads.some(existingLead => 
                            existingLead.brandName.toLowerCase() === newLead.brandName.toLowerCase() &&
                            existingLead.email.toLowerCase() === newLead.email.toLowerCase()
                        );

                        if (!isDuplicate) {
                            // Add to Firebase
                            await addDoc(collection(db, 'leads'), newLead);
                            importedCount++;
                        } else {
                            duplicateCount++;
                        }
                    }

                    // Reload leads from Firebase
                    await loadLeads();
                    
                    // Show summary alert
                    alert(`Import complete!\n${importedCount} leads imported\n${duplicateCount} duplicates skipped`);
                } catch (error) {
                    console.error("Error importing CSV:", error);
                    alert('Error importing CSV. Please try again.');
                }
                csvFileInput.value = ''; // Reset file input
            };
            reader.readAsText(file);
        }
    });

    // Update displayFilteredLeads function
    function displayFilteredLeads(filteredLeads) {
        const tbody = leadsListDiv.querySelector('tbody');
        tbody.innerHTML = '';
        
        if (!Array.isArray(filteredLeads)) {
            console.error('filteredLeads is not an array:', filteredLeads);
            return;
        }

        // Separate leads by status
        const activeLeads = filteredLeads.filter(lead => 
            lead.leadStatus !== 'Stalled' && lead.leadStatus !== 'Do Not Contact'
        );
        const stalledLeads = filteredLeads.filter(lead => lead.leadStatus === 'Stalled');
        const doNotContactLeads = filteredLeads.filter(lead => lead.leadStatus === 'Do Not Contact');

        // Helper function to create a lead row
        const createLeadRow = (lead) => {
            const tr = document.createElement('tr');
            tr.className = `row-${lead.owner?.toLowerCase()}`;
            tr.setAttribute('data-lead-id', lead.id);
            
            // Format the due date correctly
            const dueDate = lead.dueDate ? 
                new Date(lead.dueDate + 'T00:00:00').toLocaleDateString() : '';
            
            tr.innerHTML = `
                <td>${lead.brandName || ''}</td>
                <td>${lead.firstName || ''} ${lead.lastName || ''}</td>
                <td>${lead.status || ''}</td>
                <td style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${lead.nextSteps || ''}">${lead.nextSteps || ''}</td>
                <td>${dueDate}</td>
                <td>$${Number(lead.retainerValue || 0).toLocaleString()}</td>
                <td>${lead.owner || ''}</td>
                <td>
                    <button onclick="viewContact('${lead.id}')" class="action-btn view-btn">
                        <i class="fas fa-address-card"></i>
                    </button>
                    <button class="action-btn activity-btn" title="Activities">
                        <i class="fas fa-history"></i>
                    </button>
                    <button onclick="deleteLead('${lead.id}')" class="action-btn delete-btn">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            return tr;
        };

        // Helper function to create activities row
        const createActivitiesRow = (lead) => {
            const activitiesRow = document.createElement('tr');
            activitiesRow.className = 'activities-row';
            activitiesRow.style.display = 'none';
            activitiesRow.innerHTML = `
                <td colspan="9" class="activities-cell">
                    <div class="activities-container">
                        <div class="activities-list">
                            ${(lead.activities || []).map(activity => `
                                <div class="activity-entry">
                                    <input type="text" 
                                        value="${activity.description || ''}" 
                                        placeholder="Enter activity description" 
                                        class="activity-input" 
                                        readonly>
                                    <input type="date" 
                                        value="${activity.date || ''}" 
                                        class="activity-date" 
                                        readonly>
                                    <button class="action-btn edit-btn" title="Edit">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="action-btn delete-btn" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <button class="add-activity-btn">Add Activity</button>
                    </div>
                </td>
            `;
            return activitiesRow;
        };

        // Helper function to create collapsible section
        const createCollapsibleSection = (leads, title, className) => {
            if (leads.length > 0) {
                const header = document.createElement('tr');
                header.classList.add(className);
                header.innerHTML = `
                    <td colspan="9" class="${className}" style="background-color: ${className === 'stalled-leads-header' ? '#ff8c00' : '#ff0000'}; color: white;">
                        <div class="collapsible-toggle">
                            <i class="fas fa-chevron-right"></i>
                            ${title} (${leads.length})
                        </div>
                    </td>
                `;
                tbody.appendChild(header);

                // Add click handler for toggle
                header.querySelector('.collapsible-toggle').addEventListener('click', () => {
                    const isExpanded = header.classList.contains('expanded');
                    header.classList.toggle('expanded');
                    header.querySelector('i').classList.toggle('fa-chevron-right');
                    header.querySelector('i').classList.toggle('fa-chevron-down');
                    
                    // Toggle visibility of leads
                    leads.forEach(lead => {
                        const row = document.querySelector(`tr[data-lead-id="${lead.id}"]`);
                        const activitiesRow = row?.nextElementSibling;
                        if (row) {
                            row.style.display = isExpanded ? 'none' : 'table-row';
                            if (activitiesRow && activitiesRow.classList.contains('activities-row')) {
                                activitiesRow.style.display = 'none';
                            }
                        }
                    });
                });

                // Add leads (initially hidden)
                leads.forEach(lead => {
                    const row = createLeadRow(lead);
                    row.style.display = 'none';
                    tbody.appendChild(row);
                    tbody.appendChild(createActivitiesRow(lead));
                });
            }
        };

        // Display active leads first
        activeLeads.forEach(lead => {
            tbody.appendChild(createLeadRow(lead));
            tbody.appendChild(createActivitiesRow(lead));
        });

        // Add collapsible sections for stalled and do not contact leads
        createCollapsibleSection(stalledLeads, 'Stalled Leads', 'stalled-leads-header');
        createCollapsibleSection(doNotContactLeads, 'Do Not Contact Leads', 'do-not-contact-header');

        // Add event listeners for activity buttons
        document.querySelectorAll('.activity-btn').forEach(button => {
            button.addEventListener('click', function() {
                const nextRow = this.closest('tr').nextElementSibling;
                if (nextRow && nextRow.classList.contains('activities-row')) {
                    nextRow.style.display = nextRow.style.display === 'none' ? 'table-row' : 'none';
                }
            });
        });

        // Add activity edit/save functionality
        document.querySelectorAll('.activity-edit-btn').forEach(button => {
            button.addEventListener('click', function() {
                const activityEntry = this.closest('.activity-entry');
                const descriptionInput = activityEntry.querySelector('.activity-input');
                const dateInput = activityEntry.querySelector('.activity-date');
                const saveButton = activityEntry.querySelector('.activity-save-btn');

                descriptionInput.removeAttribute('readonly');
                dateInput.removeAttribute('readonly');
                descriptionInput.style.backgroundColor = 'white';
                dateInput.style.backgroundColor = 'white';

                this.style.display = 'none';
                saveButton.style.display = 'flex';
            });
        });

        // Add activity save functionality
        document.querySelectorAll('.activity-save-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const activityEntry = this.closest('.activity-entry');
                const descriptionInput = activityEntry.querySelector('.activity-input');
                const dateInput = activityEntry.querySelector('.activity-date');
                const editButton = activityEntry.querySelector('.activity-edit-btn');

                descriptionInput.setAttribute('readonly', true);
                dateInput.setAttribute('readonly', true);
                descriptionInput.style.backgroundColor = '#f8f9fa';
                dateInput.style.backgroundColor = '#f8f9fa';

                editButton.style.display = 'flex';
                this.style.display = 'none';

                const leadRow = activityEntry.closest('.activities-row').previousElementSibling;
                const leadId = leadRow.getAttribute('data-lead-id');
                if (leadId) {
                    await saveActivities(leadId);
                }
            });
        });

        // Add new activity button functionality
        document.querySelectorAll('.add-activity-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const activitiesList = this.closest('.activities-container').querySelector('.activities-list');
                const leadRow = this.closest('.activities-row').previousElementSibling;
                const leadId = leadRow.getAttribute('data-lead-id');
                
                const newActivityDiv = document.createElement('div');
                newActivityDiv.className = 'activity-entry';
                newActivityDiv.innerHTML = `
                    <input type="text" 
                        placeholder="Enter activity description" 
                        class="activity-input">
                    <input type="date" 
                        value="${new Date().toISOString().split('T')[0]}" 
                        class="activity-date">
                    <button type="button" class="activity-edit-btn" title="Edit" style="display: none;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="activity-save-btn" title="Save">
                        <i class="fas fa-save"></i>
                    </button>
                    <button type="button" class="activity-remove-btn" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                `;

                activitiesList.insertBefore(newActivityDiv, activitiesList.firstChild);

                const newSaveBtn = newActivityDiv.querySelector('.activity-save-btn');
                const newEditBtn = newActivityDiv.querySelector('.activity-edit-btn');
                const newRemoveBtn = newActivityDiv.querySelector('.activity-remove-btn');

                newSaveBtn.addEventListener('click', async function() {
                    const inputs = newActivityDiv.querySelectorAll('input');
                    inputs.forEach(input => {
                        input.setAttribute('readonly', true);
                        input.style.backgroundColor = '#f8f9fa';
                    });
                    newEditBtn.style.display = 'flex';
                    newSaveBtn.style.display = 'none';
                    if (leadId) {
                        await saveActivities(leadId);
                    }
                });

                newEditBtn.addEventListener('click', function() {
                    const inputs = newActivityDiv.querySelectorAll('input');
                    inputs.forEach(input => {
                        input.removeAttribute('readonly');
                        input.style.backgroundColor = 'white';
                    });
                    newEditBtn.style.display = 'none';
                    newSaveBtn.style.display = 'flex';
                });

                newRemoveBtn.addEventListener('click', async function() {
                    if (confirm('Are you sure you want to remove this activity?')) {
                        newActivityDiv.remove();
                        if (leadId) {
                            await saveActivities(leadId);
                        }
                    }
                });
            });
        });
    }

    // Update saveActivities function to handle empty activities
    async function saveActivities(leadId) {
        const activitiesRow = document.querySelector(`[data-lead-id="${leadId}"]`)
            .closest('tr')
            .nextElementSibling;
        
        const activities = Array.from(activitiesRow.querySelectorAll('.activity-entry'))
            .map(entry => ({
                description: entry.querySelector('.activity-input').value,
                date: entry.querySelector('.activity-date').value
            }))
            .filter(activity => activity.description || activity.date); // Only save non-empty activities

        try {
            await updateDoc(doc(db, 'leads', leadId), {
                activities: activities
            });
        } catch (error) {
            console.error("Error saving activities:", error);
            alert('Error saving activities. Please try again.');
        }
    }

    // Add auto-save functionality for activities
    document.addEventListener('change', async function(e) {
        if (e.target.classList.contains('activity-input') || 
            e.target.classList.contains('activity-date')) {
            const leadId = e.target.closest('tr')
                .previousElementSibling
                .querySelector('.expand-control')
                .dataset.leadId;
            await saveActivities(leadId);
        }
    });

    // Initial load
    loadLeads();
    updateMetrics();
});

// Function to load stats from Firestore
async function loadStats() {
    try {
        const querySnapshot = await getDocs(collection(db, 'leads'));
        const leads = querySnapshot.docs.map(doc => doc.data());
        
        let totalMRR = 0;
        let greysonLeads = 0;
        let robbyLeads = 0;
        
        leads.forEach(lead => {
            totalMRR += Number(lead.retainerValue || 0);
            if (lead.owner === 'Greyson') greysonLeads++;
            if (lead.owner === 'Robby') robbyLeads++;
        });
        
        // Update stats display
        document.getElementById('totalMRR').textContent = `$${totalMRR.toLocaleString()}`;
        document.getElementById('greysonLeads').textContent = greysonLeads;
        document.getElementById('robbyLeads').textContent = robbyLeads;
        document.getElementById('totalLeads').textContent = leads.length;
    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

// Call loadStats when page loads
document.addEventListener('DOMContentLoaded', loadStats); 