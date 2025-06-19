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

    // --- MRR (Revenue) Thermometer Sync with Revenue KPI ---
    const mrrDefaults = 94000;
    const mrrValueKey = 'mrrValue';
    const mrrValueSpan = document.getElementById('mrrValue');
    const mrrValueContainer = document.getElementById('mrrValueContainer');
    const revenueValueEl = document.getElementById('revenueValue');
    function parseRevenue(val) {
        // Remove $ and commas, handle K
        if (typeof val !== 'string') return parseInt(val, 10) || mrrDefaults;
        let v = val.replace(/[$,\s]/g, '');
        if (v.toUpperCase().endsWith('K')) {
            v = v.slice(0, -1);
            return Math.round(parseFloat(v) * 1000);
        }
        return parseInt(v, 10) || mrrDefaults;
    }
    function formatMRR(val) {
        if (isNaN(val)) return val;
        if (val >= 1000) return `$${(val/1000).toFixed(0)}K`;
        return `$${val}`;
    }
    function getMRR() {
        // Always get from Revenue KPI
        return parseRevenue(revenueValueEl ? revenueValueEl.textContent : mrrDefaults);
    }
    // Update thermometer to accept value
    const updateThermometer = () => {
        const startMRR = 75000;
        const targetMRR = 120000;
        const currentMRR = getMRR();
        const progress = ((currentMRR - startMRR) / (targetMRR - startMRR)) * 100;
        const thermometerProgress = document.querySelector('.thermometer-progress');
        if (thermometerProgress) {
            thermometerProgress.style.width = `${progress}%`;
        }
        if (mrrValueSpan) mrrValueSpan.textContent = formatMRR(currentMRR);
    };
    // Listen for Revenue KPI edits
    if (revenueValueEl) {
        const observer = new MutationObserver(updateThermometer);
        observer.observe(revenueValueEl, { childList: true, characterData: true, subtree: true });
    }
    // Remove thermometer edit button if present
    const editMrrBtn = document.getElementById('editMrrBtn');
    if (editMrrBtn) editMrrBtn.style.display = 'none';
    // Initialize value
    updateThermometer();

    // Milestone details
    const milestoneDetails = {
        '94k': {
            title: '$94K MRR - Projected MRR Start',
            details: 'Starting point for our growth journey (May)'
        },
        '100k': {
            title: '$100K MRR - Team Celebration + Merch',
            details: 'Team Celebration with Branded Merchandise:\n• Journals\n• Shirts\n• Hats\n• Mugs'
        },
        '110k': {
            title: '$110K MRR - Major Perks Unlock',
            details: 'Comprehensive Benefits Package:\n• Private Brand Product Launch\n• MacBook Pro Transition\n• 401k for All Employees'
        },
        '115k': {
            title: '$115K MRR - Team Expansion',
            details: 'New Hire to Expand Team'
        },
        '120k': {
            title: '$120K MRR - Ultimate Team Experience',
            details: 'Team Retreat + H4L Giveaway'
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

    // --- KPI BLOCKS INTERACTIVITY ---
    const kpiDefaults = {
        activeClients: 32,
        revenue: '$142,000',
        clientsClosed: 5
    };
    const goalDefaults = {
        activeClients: 35,
        revenue: '$150,000',
        clientsClosed: 8
    };
    const kpiKeys = Object.keys(kpiDefaults);
    
    // Load KPI values from localStorage or defaults
    kpiKeys.forEach(key => {
        const val = localStorage.getItem('kpi_' + key) || kpiDefaults[key];
        const el = document.getElementById(key.charAt(0).toLowerCase() + key.slice(1) + 'Value');
        if (el) el.textContent = val;
        
        // Load goal values
        const goalVal = localStorage.getItem('goal_' + key) || goalDefaults[key];
        const goalEl = document.getElementById(key + 'Goal');
        if (goalEl) {
            goalEl.textContent = `Goal: ${goalVal}`;
            updateGoalStatus(key, val, goalVal);
        }
    });
    
    // Function to update goal status (reached, close, behind)
    function updateGoalStatus(kpi, currentVal, goalVal) {
        const goalEl = document.getElementById(kpi + 'Goal');
        if (!goalEl) return;
        
        // Parse values for comparison
        let current = parseFloat(currentVal.toString().replace(/[$,]/g, ''));
        let goal = parseFloat(goalVal.toString().replace(/[$,]/g, ''));
        
        // Remove existing status classes
        goalEl.classList.remove('goal-reached', 'goal-close', 'goal-behind');
        
        // Determine status
        if (current >= goal) {
            goalEl.classList.add('goal-reached');
        } else if (current >= goal * 0.8) {
            goalEl.classList.add('goal-close');
        } else {
            goalEl.classList.add('goal-behind');
        }
    }
    
    // Edit button logic for KPI values
    document.querySelectorAll('.edit-kpi-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const kpi = btn.getAttribute('data-kpi');
            const valueEl = document.getElementById(kpi + 'Value');
            if (!valueEl) return;
            // Prevent multiple inputs
            if (valueEl.querySelector('input')) return;
            const currentValue = valueEl.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentValue;
            input.className = 'kpi-edit-input';
            valueEl.textContent = '';
            valueEl.appendChild(input);
            input.focus();
            // Real-time update for Revenue KPI (directly update thermometer from input value)
            if (kpi === 'revenue') {
                input.addEventListener('input', () => {
                    // Directly update thermometer using input value
                    const tempValue = input.value.trim();
                    const startMRR = 75000;
                    const targetMRR = 120000;
                    let currentMRR = parseRevenue(tempValue);
                    const progress = ((currentMRR - startMRR) / (targetMRR - startMRR)) * 100;
                    const thermometerProgress = document.querySelector('.thermometer-progress');
                    if (thermometerProgress) {
                        thermometerProgress.style.width = `${progress}%`;
                    }
                    if (mrrValueSpan) mrrValueSpan.textContent = formatMRR(currentMRR);
                });
            }
            // Save on blur or Enter
            function saveKpiEdit() {
                let newValue = input.value.trim();
                if (newValue === '') newValue = kpiDefaults[kpi];
                valueEl.textContent = newValue;
                localStorage.setItem('kpi_' + kpi, newValue);
                if (kpi === 'revenue') {
                    revenueValueEl.textContent = newValue;
                    updateThermometer();
                }
                // Update goal status
                const goalVal = localStorage.getItem('goal_' + kpi) || goalDefaults[kpi];
                updateGoalStatus(kpi, newValue, goalVal);
            }
            input.addEventListener('blur', saveKpiEdit);
            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    input.blur();
                } else if (evt.key === 'Escape') {
                    valueEl.textContent = currentValue;
                    if (kpi === 'revenue') {
                        revenueValueEl.textContent = currentValue;
                        updateThermometer();
                    }
                }
            });
        });
    });
    
    // Goal edit button logic
    document.querySelectorAll('.edit-goal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const kpi = btn.getAttribute('data-kpi');
            const goalEl = document.getElementById(kpi + 'Goal');
            if (!goalEl) return;
            // Prevent multiple inputs
            if (goalEl.querySelector('input')) return;
            
            // Extract current goal value
            const currentGoalText = goalEl.textContent;
            const currentGoal = currentGoalText.replace('Goal: ', '');
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentGoal;
            input.style.cssText = `
                font-size: 0.9rem;
                font-weight: 500;
                color: #222;
                background: #fff;
                border: 2px solid #f39c12;
                border-radius: 8px;
                padding: 4px 8px;
                width: 80px;
                text-align: center;
                box-shadow: 0 2px 8px rgba(243,156,18,0.08);
            `;
            
            goalEl.textContent = '';
            goalEl.appendChild(input);
            input.focus();
            input.select();
            
            // Save on blur or Enter
            function saveGoalEdit() {
                let newGoal = input.value.trim();
                if (newGoal === '') newGoal = goalDefaults[kpi];
                goalEl.textContent = `Goal: ${newGoal}`;
                localStorage.setItem('goal_' + kpi, newGoal);
                
                // Update goal status
                const currentVal = document.getElementById(kpi + 'Value')?.textContent || kpiDefaults[kpi];
                updateGoalStatus(kpi, currentVal, newGoal);
            }
            
            input.addEventListener('blur', saveGoalEdit);
            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    input.blur();
                } else if (evt.key === 'Escape') {
                    goalEl.textContent = currentGoalText;
                }
            });
        });
    });

    // --- KPI TRACKER TABLE PERSISTENCE (HEADER + BODY) ---
    const KPI_TRACKER_KEY = 'kpiTrackerData';
    const kpiTrackerTable = document.getElementById('kpiTrackerTable');
    const kpiTrackerBody = document.getElementById('kpiTrackerBody');
    const kpiTrackerHeaderRow = document.getElementById('kpiTrackerHeaderRow');

    function getKpiTrackerFullData() {
        // Save both header and body
        const header = Array.from(kpiTrackerHeaderRow.children).map(th => {
            // Only get the text node (label), not the button
            let txt = '';
            for (const node of th.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) txt += node.textContent;
            }
            return txt.trim();
        });
        const body = Array.from(kpiTrackerBody.children).map(row => {
            return Array.from(row.children).map(cell => cell.textContent.trim());
        });
        return { header, body };
    }
    function setKpiTrackerFullData(data) {
        if (!data || !Array.isArray(data.header) || !Array.isArray(data.body)) return;
        // Restore header (except first 3 columns: Owner, KPI, Goal)
        while (kpiTrackerHeaderRow.children.length > 3) {
            kpiTrackerHeaderRow.removeChild(kpiTrackerHeaderRow.children[3]);
        }
        for (let i = 3; i < data.header.length; i++) {
            const th = document.createElement('th');
            th.appendChild(document.createTextNode(data.header[i]));
            kpiTrackerHeaderRow.appendChild(th);
        }
        // Restore body
        Array.from(kpiTrackerBody.children).forEach((row, i) => {
            // Remove extra cells
            while (row.children.length > data.header.length) {
                row.removeChild(row.lastChild);
            }
            // Add missing cells
            while (row.children.length < data.header.length) {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.textContent = '';
                row.appendChild(td);
            }
            // Set cell values
            for (let j = 3; j < data.header.length; j++) {
                if (data.body[i] && data.body[i][j] !== undefined) {
                    row.children[j].textContent = data.body[i][j];
                } else {
                    row.children[j].textContent = '';
                }
                row.children[j].contentEditable = 'true';
            }
        });
        renderDeleteWeekButtons();
    }
    function saveKpiTrackerToStorage() {
        const data = getKpiTrackerFullData();
        localStorage.setItem(KPI_TRACKER_KEY, JSON.stringify(data));
    }
    function loadKpiTrackerFromStorage() {
        const data = localStorage.getItem(KPI_TRACKER_KEY);
        if (data) {
            try {
                setKpiTrackerFullData(JSON.parse(data));
            } catch {}
        }
        renderDeleteWeekButtons();
    }
    // Save on blur of any editable cell
    if (kpiTrackerBody) {
        kpiTrackerBody.addEventListener('blur', function(e) {
            if (e.target.matches('[contenteditable]')) {
                saveKpiTrackerToStorage();
            }
        }, true);
    }
    // Load on page load
    loadKpiTrackerFromStorage();

    // --- KPI TRACKER ADD WEEK FUNCTIONALITY ---
    const addWeekBtn = document.getElementById('addWeekBtn');
    if (addWeekBtn && kpiTrackerHeaderRow && kpiTrackerBody) {
        addWeekBtn.addEventListener('click', () => {
            let weekLabel = prompt('Enter new week label (e.g., 6/19):');
            if (!weekLabel) return;
            // Insert new header cell after Goal (index 2)
            const th = document.createElement('th');
            th.textContent = weekLabel;
            kpiTrackerHeaderRow.insertBefore(th, kpiTrackerHeaderRow.children[3]);
            // Insert new editable cell for each row after Goal
            Array.from(kpiTrackerBody.children).forEach(row => {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.textContent = '';
                row.insertBefore(td, row.children[3]);
            });
            saveKpiTrackerToStorage();
        });
    }

    // --- KPI TRACKER SCROLL ARROWS ---
    const kpiTableScroll = document.getElementById('kpiTableScroll');
    const scrollLeftBtn = document.getElementById('scrollLeftBtn');
    const scrollRightBtn = document.getElementById('scrollRightBtn');
    function updateScrollArrows() {
        if (!kpiTableScroll) return;
        // Show arrows if the content is scrollable
        const scrollable = kpiTableScroll.scrollWidth > kpiTableScroll.clientWidth;
        if (scrollable) {
            scrollLeftBtn.style.display = '';
            scrollRightBtn.style.display = '';
        } else {
            scrollLeftBtn.style.display = 'none';
            scrollRightBtn.style.display = 'none';
        }
    }
    if (scrollLeftBtn && scrollRightBtn && kpiTableScroll) {
        scrollLeftBtn.addEventListener('click', () => {
            kpiTableScroll.scrollBy({ left: -200, behavior: 'smooth' });
        });
        scrollRightBtn.addEventListener('click', () => {
            kpiTableScroll.scrollBy({ left: 200, behavior: 'smooth' });
        });
        kpiTableScroll.addEventListener('scroll', updateScrollArrows);
        window.addEventListener('resize', updateScrollArrows);
    }
    // Call after adding a week
    if (addWeekBtn) {
        addWeekBtn.addEventListener('click', () => {
            setTimeout(updateScrollArrows, 100);
        });
    }
    // Call on load
    updateScrollArrows();

    // --- KPI TRACKER DELETE WEEK FUNCTIONALITY ---
    if (kpiTrackerHeaderRow && kpiTrackerBody) {
        kpiTrackerHeaderRow.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-week-btn')) {
                const colIdx = parseInt(e.target.getAttribute('data-col'), 10);
                // Remove header cell
                kpiTrackerHeaderRow.removeChild(kpiTrackerHeaderRow.children[colIdx]);
                // Remove cell in each row
                Array.from(kpiTrackerBody.children).forEach(row => {
                    if (row.children[colIdx]) row.removeChild(row.children[colIdx]);
                });
                saveKpiTrackerToStorage();
                updateScrollArrows();
            }
        });
    }

    function renderDeleteWeekButtons() {
        if (!kpiTrackerHeaderRow) return;
        // Remove all existing delete buttons from week columns
        for (let i = 3; i < kpiTrackerHeaderRow.children.length; i++) {
            const th = kpiTrackerHeaderRow.children[i];
            // Remove all .delete-week-btn elements robustly
            let btns = th.querySelectorAll('.delete-week-btn');
            while (btns.length > 0) {
                btns[0].remove();
                btns = th.querySelectorAll('.delete-week-btn');
            }
        }
        // Add a delete button to each week column (after Goal)
        for (let i = 3; i < kpiTrackerHeaderRow.children.length; i++) {
            const th = kpiTrackerHeaderRow.children[i];
            // Only add if not already present
            if (!th.querySelector('.delete-week-btn')) {
                const btn = document.createElement('button');
                btn.className = 'delete-week-btn';
                btn.setAttribute('data-col', i);
                btn.title = 'Delete week';
                btn.innerHTML = '&times;';
                th.appendChild(btn);
            }
        }
    }
    // Call after any table structure change
    loadKpiTrackerFromStorage = (function(orig) {
        return function() {
            orig();
            renderDeleteWeekButtons();
        };
    })(loadKpiTrackerFromStorage);
    const origAddWeek = addWeekBtn && addWeekBtn.onclick;
    if (addWeekBtn) {
        addWeekBtn.addEventListener('click', function() {
            setTimeout(renderDeleteWeekButtons, 100);
        });
    }
    kpiTrackerHeaderRow && kpiTrackerHeaderRow.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-week-btn')) {
            setTimeout(renderDeleteWeekButtons, 100);
        }
    });
    // Initial render
    renderDeleteWeekButtons();

    // --- KPI TRACKER EDIT WEEK LABEL FUNCTIONALITY ---
    if (kpiTrackerHeaderRow) {
        kpiTrackerHeaderRow.addEventListener('click', function(e) {
            // Only allow editing if clicking the text node, not the delete button
            if (e.target.tagName === 'TH' && e.target.cellIndex >= 3) {
                const th = e.target;
                if (th.querySelector('input')) return;
                // Get only the label text (exclude any buttons)
                let oldLabel = '';
                for (const node of th.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        oldLabel += node.textContent;
                    }
                }
                oldLabel = oldLabel.trim();
                const input = document.createElement('input');
                input.type = 'text';
                input.value = oldLabel;
                input.style.width = '60px';
                input.style.fontSize = '1em';
                input.style.textAlign = 'center';
                // Remove all children (label and buttons)
                while (th.firstChild) th.removeChild(th.firstChild);
                th.appendChild(input);
                input.focus();
                input.select();
                function saveEdit() {
                    let newLabel = input.value.trim();
                    // Prevent empty or duplicate labels
                    const labels = Array.from(kpiTrackerHeaderRow.children).map(th => {
                        let txt = '';
                        for (const node of th.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE) txt += node.textContent;
                        }
                        return txt.trim();
                    });
                    if (!newLabel || (labels.includes(newLabel) && newLabel !== oldLabel)) {
                        newLabel = oldLabel;
                    }
                    // Remove all children
                    while (th.firstChild) th.removeChild(th.firstChild);
                    th.appendChild(document.createTextNode(newLabel));
                    // Do NOT add a delete button here; let renderDeleteWeekButtons handle it
                    // Ensure header and body columns match
                    Array.from(kpiTrackerBody.children).forEach(row => {
                        while (row.children.length < kpiTrackerHeaderRow.children.length) {
                            const td = document.createElement('td');
                            td.contentEditable = 'true';
                            td.textContent = '';
                            row.appendChild(td);
                        }
                        while (row.children.length > kpiTrackerHeaderRow.children.length) {
                            row.removeChild(row.lastChild);
                        }
                    });
                    saveKpiTrackerToStorage();
                    renderDeleteWeekButtons();
                    updateScrollArrows();
                }
                input.addEventListener('blur', saveEdit);
                input.addEventListener('keydown', function(evt) {
                    if (evt.key === 'Enter') {
                        input.blur();
                    } else if (evt.key === 'Escape') {
                        // Restore old label only, do NOT add a delete button here
                        while (th.firstChild) th.removeChild(th.firstChild);
                        th.appendChild(document.createTextNode(oldLabel));
                        renderDeleteWeekButtons();
                    }
                });
            }
        });
    }

    // --- MONTHLY SPRINTS STATUS COLOR CODING ---
    function updateSprintStatusColors() {
        document.querySelectorAll('.sprint-status').forEach(select => {
            select.classList.remove('sprint-status-complete', 'sprint-status-ontrack', 'sprint-status-offtrack');
            if (select.value === 'Complete') {
                select.classList.add('sprint-status-complete');
            } else if (select.value === 'On Track') {
                select.classList.add('sprint-status-ontrack');
            } else if (select.value === 'Off Track') {
                select.classList.add('sprint-status-offtrack');
            }
        });
    }
    // Initial coloring
    updateSprintStatusColors();
    // Listen for changes
    document.getElementById('monthlySprintsBody')?.addEventListener('change', function(e) {
        if (e.target.classList.contains('sprint-status')) {
            updateSprintStatusColors();
        }
    });

    // --- MONTHLY SPRINTS ROW MANAGEMENT ---
    const MONTHLY_SPRINTS_KEY = 'monthlySprintsData';
    const sprintsBody = document.getElementById('monthlySprintsBody');
    const sprintsTable = document.querySelector('.monthly-sprints-table');
    let addRowBtn = document.getElementById('addSprintRowBtn');
    let editBtn = document.getElementById('editSprintsBtn');

    // Edit mode toggle
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            document.body.classList.toggle('sprints-edit-mode');
            renderSprintsRowButtons();
        });
    }

    function renderSprintsRowButtons() {
        Array.from(sprintsBody.rows).forEach((row, idx, arr) => {
            let cell = row.cells[row.cells.length - 1];
            cell.innerHTML = '';
            if (document.body.classList.contains('sprints-edit-mode')) {
                // Move up button
                const upBtn = document.createElement('button');
                upBtn.className = 'move-sprint-row-btn';
                upBtn.title = 'Move up';
                upBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
                upBtn.onclick = function() {
                    if (idx > 0) {
                        sprintsBody.insertBefore(row, arr[idx - 1]);
                        saveSprintsToStorage();
                        renderSprintsRowButtons();
                    }
                };
                cell.appendChild(upBtn);
                // Move down button
                const downBtn = document.createElement('button');
                downBtn.className = 'move-sprint-row-btn';
                downBtn.title = 'Move down';
                downBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
                downBtn.onclick = function() {
                    if (idx < arr.length - 1) {
                        sprintsBody.insertBefore(arr[idx + 1], row);
                        saveSprintsToStorage();
                        renderSprintsRowButtons();
                    }
                };
                cell.appendChild(downBtn);
                // Delete button
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-sprint-row-btn';
                delBtn.title = 'Delete row';
                delBtn.textContent = '×';
                delBtn.onclick = function() {
                    row.remove();
                    saveSprintsToStorage();
                    renderSprintsRowButtons();
                };
                cell.appendChild(delBtn);
            }
        });
    }

    // Save/Load
    function getSprintsData() {
        return Array.from(sprintsBody.children).map(row => {
            return [
                row.children[0]?.textContent.trim() || '',
                row.children[1]?.textContent.trim() || '',
                row.children[2]?.textContent.trim() || '',
                row.children[3]?.querySelector('select')?.value || 'On Track'
            ];
        });
    }
    function setSprintsData(data) {
        sprintsBody.innerHTML = '';
        data.forEach(arr => {
            const tr = document.createElement('tr');
            for (let i = 0; i < 3; i++) {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.textContent = arr[i] || '';
                tr.appendChild(td);
            }
            const td = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'sprint-status';
            ['Complete','On Track','Off Track'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (arr[3] === opt) o.selected = true;
                select.appendChild(o);
            });
            td.appendChild(select);
            tr.appendChild(td);
            // Empty cell for row controls
            tr.appendChild(document.createElement('td'));
            sprintsBody.appendChild(tr);
        });
        updateSprintStatusColors();
        renderSprintsRowButtons();
    }
    function saveSprintsToStorage() {
        localStorage.setItem(MONTHLY_SPRINTS_KEY, JSON.stringify(getSprintsData()));
    }
    function loadSprintsFromStorage() {
        const data = localStorage.getItem(MONTHLY_SPRINTS_KEY);
        if (data) {
            try { setSprintsData(JSON.parse(data)); } catch {}
        }
        updateSprintStatusColors();
        renderSprintsRowButtons();
    }
    // Save on blur or status change
    sprintsBody.addEventListener('blur', function(e) {
        if (e.target.matches('[contenteditable]')) saveSprintsToStorage();
    }, true);
    sprintsBody.addEventListener('change', function(e) {
        if (e.target.classList.contains('sprint-status')) saveSprintsToStorage();
    });
    // Add row
    addRowBtn.addEventListener('click', function() {
        const tr = document.createElement('tr');
        for (let i = 0; i < 3; i++) {
            const td = document.createElement('td');
            td.contentEditable = 'true';
            tr.appendChild(td);
        }
        const td = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'sprint-status';
        ['Complete','On Track','Off Track'].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            select.appendChild(o);
        });
        td.appendChild(select);
        tr.appendChild(td);
        // Empty cell for row controls
        tr.appendChild(document.createElement('td'));
        sprintsBody.appendChild(tr);
        updateSprintStatusColors();
        renderSprintsRowButtons();
        saveSprintsToStorage();
    });
    // On load
    loadSprintsFromStorage();

    // --- TO-DO SECTION LOGIC (LOCALSTORAGE) ---
    const TODOS_KEY = 'goalsTodos';
    const todoForm = document.getElementById('todoForm');
    const todosTable = document.getElementById('todosTable');
    let todos = [];
    function saveTodos() {
        localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
    }
    function loadTodos() {
        const data = localStorage.getItem(TODOS_KEY);
        todos = data ? JSON.parse(data) : [];
        renderTodos();
    }
    function renderTodos() {
        const tbody = todosTable.querySelector('tbody');
        tbody.innerHTML = '';
        todos.forEach((todo, idx) => {
            const row = document.createElement('tr');
            if (todo.completed) row.classList.add('completed-task');
            row.innerHTML = `
                <td>${todo.text}</td>
                <td>${todo.assignee}</td>
                <td>${todo.dueDate}</td>
                <td>
                    <button class="action-btn edit-btn"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
                    <button class="action-btn complete-btn" ${todo.completed ? 'disabled' : ''}><i class="fas fa-check"></i></button>
                </td>
            `;
            // Edit
            row.querySelector('.edit-btn').addEventListener('click', () => {
                if (row.classList.contains('editing')) return;
                row.classList.add('editing');
                row.children[0].innerHTML = `<input type="text" value="${todo.text}" class="edit-input">`;
                row.children[1].innerHTML = `
                    <select class="edit-input">
                        <option value="Robby" ${todo.assignee === 'Robby' ? 'selected' : ''}>Robby</option>
                        <option value="Greyson" ${todo.assignee === 'Greyson' ? 'selected' : ''}>Greyson</option>
                        <option value="Stephen" ${todo.assignee === 'Stephen' ? 'selected' : ''}>Stephen</option>
                        <option value="Bobby" ${todo.assignee === 'Bobby' ? 'selected' : ''}>Bobby</option>
                        <option value="Brandon" ${todo.assignee === 'Brandon' ? 'selected' : ''}>Brandon</option>
                        <option value="Noah" ${todo.assignee === 'Noah' ? 'selected' : ''}>Noah</option>
                    </select>
                `;
                row.children[2].innerHTML = `<input type="date" value="${todo.dueDate}" class="edit-input">`;
                row.children[3].innerHTML = `<button class="action-btn save-btn"><i class="fas fa-save"></i></button><button class="action-btn cancel-btn"><i class="fas fa-times"></i></button>`;
                // Save
                row.querySelector('.save-btn').addEventListener('click', () => {
                    const newText = row.children[0].querySelector('input').value.trim();
                    const newAssignee = row.children[1].querySelector('select').value;
                    const newDueDate = row.children[2].querySelector('input').value;
                    if (!newText || !newAssignee || !newDueDate) {
                        alert('Please fill in all fields');
                        return;
                    }
                    todos[idx] = { text: newText, assignee: newAssignee, dueDate: newDueDate, completed: todo.completed };
                    saveTodos();
                    renderTodos();
                });
                // Cancel
                row.querySelector('.cancel-btn').addEventListener('click', () => {
                    renderTodos();
                });
            });
            // Delete
            row.querySelector('.delete-btn').addEventListener('click', () => {
                todos.splice(idx, 1);
                saveTodos();
                renderTodos();
            });
            // Complete
            row.querySelector('.complete-btn').addEventListener('click', () => {
                if (!todo.completed) {
                    todos[idx].completed = true;
                    saveTodos();
                    renderTodos();
                }
            });
            tbody.appendChild(row);
        });
    }
    if (todoForm) {
        todoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const text = document.getElementById('todoDescription').value.trim();
            const assignee = document.getElementById('todoAssignee').value;
            const dueDate = document.getElementById('todoDueDate').value;
            if (!text || !assignee || !dueDate) {
                alert('Please fill in all fields');
                return;
            }
            todos.push({ text, assignee, dueDate });
            saveTodos();
            renderTodos();
            todoForm.reset();
        });
    }
    loadTodos();

    // --- IDS SECTION ROW MANAGEMENT ---
    const IDS_KEY = 'idsTableData';
    const idsBody = document.getElementById('idsBody');
    const addIdsRowBtn = document.getElementById('addIdsRowBtn');
    const editIdsBtn = document.getElementById('editIdsBtn');

    function getIdsData() {
        return Array.from(idsBody.children).map(row => {
            return [
                row.children[0]?.textContent.trim() || '',
                row.children[1]?.textContent.trim() || '',
                row.children[2]?.textContent.trim() || '',
                row.children[3]?.querySelector('select')?.value || 'Discuss',
                row.children[4]?.querySelector('input')?.checked || false
            ];
        });
    }
    function setIdsData(data) {
        idsBody.innerHTML = '';
        data.forEach(arr => {
            const tr = document.createElement('tr');
            for (let i = 0; i < 3; i++) {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.textContent = arr[i] || '';
                tr.appendChild(td);
            }
            // Type cell with dropdown
            const typeTd = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'ids-type-select';
            ['Inform', 'Discuss', 'Solve'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (arr[3] === opt) o.selected = true;
                select.appendChild(o);
            });
            typeTd.appendChild(select);
            tr.appendChild(typeTd);
            // Discussed checkbox
            const discussedTd = document.createElement('td');
            discussedTd.style.textAlign = 'center';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'ids-discussed';
            cb.checked = !!arr[4];
            discussedTd.appendChild(cb);
            tr.appendChild(discussedTd);
            // Empty cell for row controls
            tr.appendChild(document.createElement('td'));
            idsBody.appendChild(tr);
        });
        renderIdsRowButtons();
    }
    function saveIdsToStorage() {
        localStorage.setItem(IDS_KEY, JSON.stringify(getIdsData()));
    }
    function loadIdsFromStorage() {
        const data = localStorage.getItem(IDS_KEY);
        if (data) {
            try { setIdsData(JSON.parse(data)); } catch {}
        }
        renderIdsRowButtons();
    }
    // Add row
    if (addIdsRowBtn) {
        addIdsRowBtn.addEventListener('click', function() {
            const tr = document.createElement('tr');
            for (let i = 0; i < 3; i++) {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                tr.appendChild(td);
            }
            // Type cell with dropdown
            const typeTd = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'ids-type-select';
            ['Inform', 'Discuss', 'Solve'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (opt === 'Discuss') o.selected = true;
                select.appendChild(o);
            });
            typeTd.appendChild(select);
            tr.appendChild(typeTd);
            // Discussed checkbox
            const discussedTd = document.createElement('td');
            discussedTd.style.textAlign = 'center';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'ids-discussed';
            discussedTd.appendChild(cb);
            tr.appendChild(discussedTd);
            // Empty cell for row controls
            tr.appendChild(document.createElement('td'));
            idsBody.appendChild(tr);
            saveIdsToStorage();
            renderIdsRowButtons();
        });
    }
    // Save on blur or checkbox change
    idsBody.addEventListener('blur', function(e) {
        if (e.target.matches('[contenteditable]')) saveIdsToStorage();
    }, true);
    idsBody.addEventListener('change', function(e) {
        if (e.target.classList.contains('ids-discussed') || e.target.classList.contains('ids-type-select')) saveIdsToStorage();
    });
    // Edit mode toggle
    if (editIdsBtn) {
        editIdsBtn.addEventListener('click', function() {
            document.body.classList.toggle('ids-edit-mode');
            renderIdsRowButtons();
        });
    }
    function renderIdsRowButtons() {
        Array.from(idsBody.rows).forEach((row, idx, arr) => {
            let cell = row.cells[row.cells.length - 1];
            cell.innerHTML = '';
            if (document.body.classList.contains('ids-edit-mode')) {
                // Move up button
                const upBtn = document.createElement('button');
                upBtn.className = 'move-sprint-row-btn';
                upBtn.title = 'Move up';
                upBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
                upBtn.onclick = function() {
                    if (idx > 0) {
                        idsBody.insertBefore(row, arr[idx - 1]);
                        saveIdsToStorage();
                        renderIdsRowButtons();
                    }
                };
                cell.appendChild(upBtn);
                // Move down button
                const downBtn = document.createElement('button');
                downBtn.className = 'move-sprint-row-btn';
                downBtn.title = 'Move down';
                downBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
                downBtn.onclick = function() {
                    if (idx < arr.length - 1) {
                        idsBody.insertBefore(arr[idx + 1], row);
                        saveIdsToStorage();
                        renderIdsRowButtons();
                    }
                };
                cell.appendChild(downBtn);
                // Delete button
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-sprint-row-btn';
                delBtn.title = 'Delete row';
                delBtn.textContent = '×';
                delBtn.onclick = function() {
                    row.remove();
                    saveIdsToStorage();
                    renderIdsRowButtons();
                };
                cell.appendChild(delBtn);
            }
        });
    }
    // On load
    loadIdsFromStorage();
}); 