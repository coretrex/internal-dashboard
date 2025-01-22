document.addEventListener('DOMContentLoaded', function() {
    // Initialize leads array from localStorage or empty array
    let leads = JSON.parse(localStorage.getItem('leads')) || [];

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
    
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredLeads = leads.filter(lead => {
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
        const createdDate = new Date(lead.createdAt).toLocaleString();
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
        const totalMRR = leads.reduce((sum, lead) => sum + Number(lead.retainerValue), 0);
        const greysonLeadsCount = leads.filter(lead => lead.owner === 'Greyson').length;
        const robbyLeadsCount = leads.filter(lead => lead.owner === 'Robby').length;
        
        totalMRRElement.textContent = `$${totalMRR.toLocaleString()}`;
        totalLeadsElement.textContent = leads.length;
        greysonLeadsElement.textContent = greysonLeadsCount;
        robbyLeadsElement.textContent = robbyLeadsCount;
    }

    // Add new lead
    addLeadBtn.addEventListener('click', () => {
        const newLead = {
            id: Date.now(),
            brandName: document.getElementById('brandName').value,
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            status: document.getElementById('status').value,
            leadStatus: 'Active', // Default value for new leads
            nextSteps: document.getElementById('nextSteps').value,
            dueDate: document.getElementById('dueDate').value,
            retainerValue: document.getElementById('retainerValue').value,
            owner: document.getElementById('owner').value,
            source: document.getElementById('source').value,
            createdAt: new Date().toISOString()
        };

        // Validate required fields
        if (!newLead.brandName || !newLead.firstName || !newLead.status) {
            alert('Please fill in all required fields');
            return;
        }

        leads.push(newLead);
        localStorage.setItem('leads', JSON.stringify(leads));
        
        // Clear all input fields
        document.querySelectorAll('.input-field').forEach(input => input.value = '');
        
        displayLeads();
        updateMetrics();
    });

    // Display leads
    function displayLeads() {
        displayFilteredLeads(leads);
    }

    // Delete lead
    window.deleteLead = function(id) {
        leads = leads.filter(lead => lead.id !== id);
        localStorage.setItem('leads', JSON.stringify(leads));
        displayLeads();
        updateMetrics();
    }

    // Update viewContact function
    window.viewContact = function(id) {
        currentEditId = id;
        const lead = leads.find(lead => lead.id === id);
        modalContent.innerHTML = createViewHTML(lead);
        editButton.style.display = 'block';
        saveButton.style.display = 'none';
        modal.style.display = 'block';
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

    saveButton.addEventListener('click', function() {
        const leadIndex = leads.findIndex(lead => lead.id === currentEditId);
        if (leadIndex === -1) return;

        leads[leadIndex] = {
            ...leads[leadIndex],
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
        };

        localStorage.setItem('leads', JSON.stringify(leads));
        displayLeads();
        updateMetrics();
        
        // Return to view mode
        viewContact(currentEditId);
    });

    // Add CSV import functionality
    importCsvBtn.addEventListener('click', function() {
        csvFileInput.click();
    });

    csvFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                const rows = text.split('\n');
                const headers = rows[0].split(',').map(header => header.trim());

                // Process each row (skip header row)
                for (let i = 1; i < rows.length; i++) {
                    if (rows[i].trim() === '') continue; // Skip empty rows
                    
                    const values = rows[i].split(',').map(value => value.trim());
                    const lead = {
                        id: Date.now() + i, // Unique ID for each lead
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
                        createdAt: new Date().toISOString()
                    };

                    leads.push(lead);
                }

                localStorage.setItem('leads', JSON.stringify(leads));
                displayLeads();
                updateMetrics();
                csvFileInput.value = ''; // Reset file input
                alert('CSV import complete!');
            };
            reader.readAsText(file);
        }
    });

    // Add this new function to display filtered leads
    function displayFilteredLeads(filteredLeads) {
        const tbody = leadsListDiv.querySelector('tbody');
        tbody.innerHTML = '';
        
        filteredLeads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        filteredLeads.forEach(lead => {
            const tr = document.createElement('tr');
            tr.className = `row-${lead.owner.toLowerCase()}`;
            tr.innerHTML = `
                <td>${lead.brandName}</td>
                <td>${lead.firstName} ${lead.lastName}</td>
                <td>${lead.status}</td>
                <td>${lead.nextSteps}</td>
                <td>${new Date(lead.dueDate).toLocaleDateString()}</td>
                <td>$${Number(lead.retainerValue).toLocaleString()}</td>
                <td>${lead.owner}</td>
                <td>
                    <button onclick="viewContact(${lead.id})" class="action-btn view-btn">
                        <i class="fas fa-address-card"></i>
                    </button>
                    <button onclick="deleteLead(${lead.id})" class="action-btn delete-btn">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Initial load
    displayLeads();
    updateMetrics();
}); 