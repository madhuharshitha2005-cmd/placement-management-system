// ================= CONFIGURATION & API BASE =================
// Automatically detects whether running via Express server or direct file opening
const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ? ''
    : 'http://localhost:3000';

let popupTimeout = null;

// ================= NOTIFICATION POPUP =================
function showPopup(title, message, isError = false) {
    const popup = document.getElementById("popup");
    const popupTitle = document.getElementById("popupTitle");
    const popupText = document.getElementById("popupText");

    if (!popup || !popupTitle || !popupText) {
        alert(`${title}: ${message}`);
        return;
    }

    popupTitle.innerText = title;
    popupText.innerHTML = message;
    popup.style.display = "flex";

    const content = popup.querySelector(".popup-content");
    if (content) {
        if (isError) {
            content.classList.add("popup-error");
        } else {
            content.classList.remove("popup-error");
        }
    }

    if (popupTimeout) clearTimeout(popupTimeout);
    popupTimeout = setTimeout(() => {
        closePopup();
    }, 6000);
}

function closePopup() {
    const popup = document.getElementById("popup");
    if (popup) popup.style.display = "none";
}

// ================= AUTHENTICATION =================

function login() {
    const username = document.getElementById("username")?.value.trim();
    const password = document.getElementById("password")?.value;

    if (!username || !password) {
        showPopup("Missing Details", "Please enter both username and password.", true);
        return;
    }

    fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(async res => {
        const data = await res.json();
        if (data.success) {
            localStorage.setItem("currentUser", data.user?.username || username);
            showPopup("Success", "Welcome back! Login Successful 🎉");
            setTimeout(() => window.location.href = "dashboard.html", 1000);
        } else {
            showPopup("Login Failed", data.message || "Invalid username or password", true);
        }
    })
    .catch(() => {
        showPopup("Connection Error", "Cannot connect to server. Please ensure the backend is running.", true);
    });
}

function register() {
    const username = document.getElementById("regUsername")?.value.trim();
    const password = document.getElementById("regPassword")?.value;

    if (!username || !password) {
        showPopup("Missing Details", "Please fill in all registration fields.", true);
        return;
    }

    if (username.length < 3) {
        showPopup("Validation", "Username must be at least 3 characters long.", true);
        return;
    }

    fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(async res => {
        const data = await res.json();
        if (data.success) {
            showPopup("Success", data.message || "Account registered successfully! Redirecting...");
            setTimeout(() => window.location.href = "login.html", 1500);
        } else {
            showPopup("Registration Failed", data.message || "User already exists", true);
        }
    })
    .catch(() => {
        showPopup("Connection Error", "Server connection error. Make sure server is running.", true);
    });
}

function logout() {
    localStorage.removeItem("currentUser");
    showPopup("Logged Out", "You have been logged out successfully.");
    setTimeout(() => window.location.href = "login.html", 1000);
}

function checkAuth() {
    const currentUser = localStorage.getItem("currentUser");
    const userDisplay = document.getElementById("userDisplay");
    
    // If on dashboard, enforce login
    if (window.location.pathname.endsWith("dashboard.html")) {
        if (!currentUser) {
            window.location.href = "login.html";
            return;
        }
        if (userDisplay) {
            userDisplay.innerText = `👤 ${currentUser}`;
        }
    }
}

// ================= STUDENTS MANAGEMENT =================

let cachedStudents = [];
let cachedCompanies = [];

function loadStudents() {
    fetch(`${API_BASE}/students`)
    .then(res => res.json())
    .then(data => {
        cachedStudents = data || [];
        renderStudents();
        updateStats();
    })
    .catch(err => {
        console.error("Error loading students:", err);
    });
}

function renderStudents() {
    const table = document.getElementById("studentTable");
    if (!table) return;

    const filter = document.getElementById("filterStatus")?.value || "all";
    const searchQuery = document.getElementById("studentSearch")?.value.toLowerCase().trim() || "";

    table.innerHTML = "";

    const filtered = cachedStudents.filter(s => {
        if (filter === "placed" && !s.company_name) return false;
        if (filter === "notPlaced" && s.company_name) return false;

        if (searchQuery) {
            const matchName = (s.name || '').toLowerCase().includes(searchQuery);
            const matchBranch = (s.branch || '').toLowerCase().includes(searchQuery);
            const matchEmail = (s.email || '').toLowerCase().includes(searchQuery);
            const matchCompany = (s.company_name || '').toLowerCase().includes(searchQuery);
            if (!matchName && !matchBranch && !matchEmail && !matchCompany) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        table.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 20px;">No student records found.</td></tr>`;
        return;
    }

    filtered.forEach(s => {
        const isPlaced = !!s.company_name;

        // Resume download link
        const resumeHtml = s.resume 
            ? `<a href="${API_BASE}/uploads/${s.resume}" target="_blank" class="resume-badge" title="View / Download Resume">📄 View</a>` 
            : `<span class="no-resume">None</span>`;

        // Placement column
        let placementHtml = '';
        if (isPlaced) {
            placementHtml = `
                <div class="placed-box">
                    <span class="placed-name">${escapeHtml(s.company_name)}</span>
                    <button onclick="unplaceStudent(${s.id})" class="btn-sm btn-outline-warning" title="Remove placement">↩ Unplace</button>
                </div>
            `;
        } else {
            placementHtml = `
                <div class="placement-action">
                    <select id="company-select-${s.id}" class="select-sm">
                        <option value="">-- Choose Company --</option>
                        ${cachedCompanies.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.package)})</option>`).join('')}
                    </select>
                    <button onclick="placeStudent(${s.id})" class="btn-sm btn-success">Place</button>
                </div>
            `;
        }

        table.innerHTML += `
            <tr>
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${escapeHtml(s.email)}</td>
                <td><span class="badge-branch">${escapeHtml(s.branch)}</span></td>
                <td><strong>${Number(s.cgpa).toFixed(1)}</strong></td>
                <td>${resumeHtml}</td>
                <td>
                    <button onclick="recommend(${s.cgpa}, '${escapeHtml(s.name)}')" class="btn-sm btn-recommend" title="View company recommendations">🎯 Match</button>
                </td>
                <td>
                    ${isPlaced 
                        ? `<span class="status-badge status-placed">✔ Placed</span>` 
                        : `<span class="status-badge status-pending">⏳ Pending</span>`}
                </td>
                <td>${placementHtml}</td>
                <td>
                    <button onclick="deleteStudent(${s.id})" class="btn-sm btn-danger" title="Delete Student">❌</button>
                </td>
            </tr>
        `;
    });
}

function addStudent() {
    const name = document.getElementById("name")?.value.trim();
    const email = document.getElementById("email")?.value.trim();
    const branch = document.getElementById("branch")?.value.trim();
    const cgpa = document.getElementById("cgpa")?.value.trim();
    const resume = document.getElementById("resume")?.files[0];

    if (!name || !email || !branch || !cgpa) {
        showPopup("Missing Info", "Please fill in all student details (Name, Email, Branch, CGPA).", true);
        return;
    }

    const cgpaNum = parseFloat(cgpa);
    if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
        showPopup("Invalid CGPA", "CGPA must be a valid number between 0.0 and 10.0.", true);
        return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("branch", branch);
    formData.append("cgpa", cgpa);

    if (resume) {
        formData.append("resume", resume);
    }

    fetch(`${API_BASE}/add-student`, {
        method: 'POST',
        body: formData
    })
    .then(async res => {
        const data = await res.json();
        if (data.success) {
            showPopup("Student Added", `🎉 Successfully added student <strong>${escapeHtml(name)}</strong>!`);

            // Clear inputs
            document.getElementById("name").value = "";
            document.getElementById("email").value = "";
            document.getElementById("branch").value = "";
            document.getElementById("cgpa").value = "";
            document.getElementById("resume").value = "";

            loadStudents();
        } else {
            showPopup("Failed", data.message || "Failed to add student", true);
        }
    })
    .catch(() => {
        showPopup("Error", "Failed to upload student information. Check server connection.", true);
    });
}

function deleteStudent(id) {
    if (!confirm("Are you sure you want to delete this student record?")) return;

    fetch(`${API_BASE}/delete-student/${id}`, { method: 'DELETE' })
    .then(async res => {
        const data = await res.json();
        if (data.success) {
            showPopup("Removed", "Student record and files removed successfully.");
            loadStudents();
        } else {
            showPopup("Error", data.message || "Error deleting student", true);
        }
    })
    .catch(() => {
        showPopup("Error", "Failed to delete student", true);
    });
}

function placeStudent(studentId) {
    const select = document.getElementById(`company-select-${studentId}`);
    const companyId = select ? select.value : null;

    if (!companyId) {
        showPopup("Select Company", "Please choose a company from the dropdown to place the student.", true);
        return;
    }

    fetch(`${API_BASE}/place-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            student_id: studentId,
            company_id: companyId
        })
    })
    .then(async res => {
        const data = await res.json();
        if (data.success) {
            showPopup("Placed! 🎉", "Student placement successfully recorded!");
            loadStudents();
        } else {
            showPopup("Error", data.message || "Could not place student", true);
        }
    })
    .catch(() => {
        showPopup("Error", "Placement request failed", true);
    });
}

function unplaceStudent(studentId) {
    if (!confirm("Are you sure you want to remove this placement status?")) return;

    fetch(`${API_BASE}/unplace-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId })
    })
    .then(async res => {
        const data = await res.json();
        if (data.success) {
            showPopup("Unplaced", "Student status updated to Pending.");
            loadStudents();
        } else {
            showPopup("Error", data.message || "Could not remove placement", true);
        }
    })
    .catch(() => {
        showPopup("Error", "Failed to remove placement", true);
    });
}

// ================= RECOMMENDATION ENGINE =================

function recommend(cgpa, studentName = "Student") {
    fetch(`${API_BASE}/recommend/${cgpa}`)
    .then(res => res.json())
    .then(data => {
        let companiesHtml = '';
        if (data.companies && data.companies.length > 0) {
            companiesHtml = `
                <div class="recommend-companies">
                    <strong>Eligible Companies:</strong>
                    <ul style="text-align: left; margin: 10px 0; padding-left: 20px;">
                        ${data.companies.map(c => `<li><strong>${escapeHtml(c.name)}</strong> - ${escapeHtml(c.role)} (Package: ${escapeHtml(c.package)})</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            companiesHtml = `<p style="margin-top: 10px; font-style: italic;">No matching registered companies found yet.</p>`;
        }

        const msg = `
            <div style="text-align: left;">
                <p><strong>Candidate:</strong> ${studentName} (CGPA: ${cgpa})</p>
                <p><strong>Placement Tier:</strong> ${data.tier}</p>
                <p><strong>Advisory:</strong> ${data.advice}</p>
                ${companiesHtml}
            </div>
        `;

        showPopup("🎯 Career Recommendation", msg);
    })
    .catch(() => {
        showPopup("Error", "Could not fetch recommendations", true);
    });
}

// ================= COMPANIES MANAGEMENT =================

function loadCompanies() {
    fetch(`${API_BASE}/companies`)
    .then(res => res.json())
    .then(data => {
        cachedCompanies = data || [];
        renderCompanies();
        renderStudents(); // Re-render students to refresh company dropdowns
        updateStats();
    })
    .catch(err => {
        console.error("Error loading companies:", err);
    });
}

function renderCompanies() {
    const table = document.getElementById("companyTable");
    if (!table) return;

    table.innerHTML = "";

    if (cachedCompanies.length === 0) {
        table.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No partner companies registered yet.</td></tr>`;
        return;
    }

    cachedCompanies.forEach(c => {
        table.innerHTML += `
            <tr>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.role)}</td>
                <td><span class="badge-package">${escapeHtml(c.package)}</span></td>
                <td>
                    <button onclick="deleteCompany(${c.id})" class="btn-sm btn-danger" title="Delete Company">❌</button>
                </td>
            </tr>
        `;
    });
}

function addCompany() {
    const name = document.getElementById("cname")?.value.trim();
    const role = document.getElementById("role")?.value.trim();
    const packageValue = document.getElementById("package")?.value.trim();

    if (!name || !role || !packageValue) {
        showPopup("Missing Info", "Please fill Company Name, Role, and Package.", true);
        return;
    }

    fetch(`${API_BASE}/add-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, package: packageValue })
    })
    .then(async res => {
        const data = await res.json();
        if (data.success) {
            showPopup("Company Added", `🎉 <strong>${escapeHtml(name)}</strong> added to recruitment partners!`);

            document.getElementById("cname").value = "";
            document.getElementById("role").value = "";
            document.getElementById("package").value = "";

            loadCompanies();
        } else {
            showPopup("Error", data.message || "Failed to add company", true);
        }
    })
    .catch(() => {
        showPopup("Error", "Failed to add company", true);
    });
}

function deleteCompany(id) {
    if (!confirm("Are you sure you want to delete this company?")) return;

    fetch(`${API_BASE}/delete-company/${id}`, {
        method: 'DELETE'
    })
    .then(async res => {
        const data = await res.json();
        if (data.success) {
            showPopup("Deleted", "Company removed successfully.");
            loadCompanies();
        } else {
            showPopup("Warning", data.message || "Cannot delete company.", true);
        }
    })
    .catch(() => {
        showPopup("Error", "Delete request failed", true);
    });
}

// ================= STATS SUMMARY =================
function updateStats() {
    const totalStudentsEl = document.getElementById("totalStudentsCount");
    const placedStudentsEl = document.getElementById("placedStudentsCount");
    const pendingStudentsEl = document.getElementById("pendingStudentsCount");
    const totalCompaniesEl = document.getElementById("totalCompaniesCount");

    const totalStudents = cachedStudents.length;
    const placedStudents = cachedStudents.filter(s => !!s.company_name).length;
    const pendingStudents = totalStudents - placedStudents;
    const totalCompanies = cachedCompanies.length;

    if (totalStudentsEl) totalStudentsEl.innerText = totalStudents;
    if (placedStudentsEl) placedStudentsEl.innerText = placedStudents;
    if (pendingStudentsEl) pendingStudentsEl.innerText = pendingStudents;
    if (totalCompaniesEl) totalCompaniesEl.innerText = totalCompanies;
}

// ================= DARK MODE =================
function toggleDarkMode() {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("mode", isDark ? "dark" : "light");

    const darkBtn = document.querySelector(".darkbtn");
    if (darkBtn) {
        darkBtn.innerText = isDark ? "☀️" : "🌙";
    }
}

// Helper to escape HTML characters
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ================= AUTO LOAD ON INIT =================
window.addEventListener("DOMContentLoaded", () => {
    // Check Dark Mode
    if (localStorage.getItem("mode") === "dark") {
        document.body.classList.add("dark");
        const darkBtn = document.querySelector(".darkbtn");
        if (darkBtn) darkBtn.innerText = "☀️";
    }

    // Check Authentication
    checkAuth();

    // Load Data
    if (document.getElementById("studentTable")) {
        loadCompanies(); // Loads companies first then students & dropdowns
        loadStudents();
    }
});