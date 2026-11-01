const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration (preserves file extensions)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
        const ext = path.extname(file.originalname);
        cb(null, 'resume-' + uniqueSuffix + ext);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend and Uploads
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(uploadDir));

// Database Initialization
const dbPath = path.join(__dirname, 'placement.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database at', dbPath);
    }
});

// Create Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        branch TEXT NOT NULL,
        cgpa REAL NOT NULL,
        resume TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        package TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS placements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL UNIQUE,
        company_id INTEGER NOT NULL
    )`);
});

// ================= AUTHENTICATION =================

// Register User
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
        return res.status(400).json({ success: false, message: "Username must be at least 3 characters" });
    }

    db.run(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [cleanUsername, password],
        function (err) {
            if (err) {
                if (err.message.includes("UNIQUE")) {
                    return res.status(400).json({ success: false, message: "Username already exists" });
                }
                return res.status(500).json({ success: false, message: "Registration failed: " + err.message });
            }
            res.json({ success: true, message: "Registered successfully! You can now log in." });
        }
    );
});

// Login User
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    db.get(
        "SELECT id, username FROM users WHERE username = ? AND password = ?",
        [username.trim(), password],
        (err, row) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Server error" });
            }
            if (!row) {
                return res.json({ success: false, message: "Invalid username or password" });
            }
            res.json({
                success: true,
                message: "Login successful",
                user: { id: row.id, username: row.username }
            });
        }
    );
});

// ================= STUDENTS =================

// Get All Students with Placement and Company Info
app.get('/students', (req, res) => {
    const query = `
        SELECT 
            students.*, 
            placements.company_id AS placed_company_id,
            companies.name AS company_name,
            companies.role AS company_role,
            companies.package AS company_package
        FROM students
        LEFT JOIN placements ON students.id = placements.student_id
        LEFT JOIN companies ON placements.company_id = companies.id
        ORDER BY students.id DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch students: " + err.message });
        }
        res.json(rows);
    });
});

// Add New Student + Resume
app.post('/add-student', upload.single('resume'), (req, res) => {
    const { name, email, branch, cgpa } = req.body;

    if (!name || !email || !branch || cgpa === undefined || cgpa === '') {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const cgpaNum = parseFloat(cgpa);
    if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
        return res.status(400).json({ success: false, message: "CGPA must be a valid number between 0 and 10" });
    }

    const resumeFilename = req.file ? req.file.filename : null;

    db.run(
        "INSERT INTO students (name, email, branch, cgpa, resume) VALUES (?, ?, ?, ?, ?)",
        [name.trim(), email.trim(), branch.trim(), cgpaNum, resumeFilename],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: "Failed to add student: " + err.message });
            }
            res.json({
                success: true,
                message: "Student added successfully",
                studentId: this.lastID
            });
        }
    );
});

// Delete Student
app.delete('/delete-student/:id', (req, res) => {
    const studentId = req.params.id;

    // First fetch student to get resume file name if any
    db.get("SELECT resume FROM students WHERE id = ?", [studentId], (err, student) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Error locating student" });
        }

        // Delete associated placement
        db.run("DELETE FROM placements WHERE student_id = ?", [studentId], (pErr) => {
            if (pErr) console.error("Error clearing placement:", pErr);

            // Delete student record
            db.run("DELETE FROM students WHERE id = ?", [studentId], function (sErr) {
                if (sErr) {
                    return res.status(500).json({ success: false, message: "Error deleting student" });
                }

                // If student had resume file, delete it from disk
                if (student && student.resume) {
                    const filePath = path.join(uploadDir, student.resume);
                    if (fs.existsSync(filePath)) {
                        fs.unlink(filePath, (uErr) => {
                            if (uErr) console.error("Could not delete resume file:", uErr);
                        });
                    }
                }

                res.json({ success: true, message: "Student deleted successfully" });
            });
        });
    });
});

// ================= PLACEMENTS =================

// Place Student in a Company
app.post('/place-student', (req, res) => {
    const { student_id, company_id } = req.body;

    if (!student_id || !company_id) {
        return res.status(400).json({ success: false, message: "Student and Company are required" });
    }

    db.run("DELETE FROM placements WHERE student_id = ?", [student_id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Failed to update placement" });
        }

        db.run(
            "INSERT INTO placements (student_id, company_id) VALUES (?, ?)",
            [student_id, company_id],
            function (insertErr) {
                if (insertErr) {
                    return res.status(500).json({ success: false, message: "Failed to assign company" });
                }
                res.json({ success: true, message: "Student placed successfully!" });
            }
        );
    });
});

// Remove Placement (Unplace)
app.post('/unplace-student', (req, res) => {
    const { student_id } = req.body;

    if (!student_id) {
        return res.status(400).json({ success: false, message: "Student ID is required" });
    }

    db.run("DELETE FROM placements WHERE student_id = ?", [student_id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, message: "Failed to remove placement" });
        }
        res.json({ success: true, message: "Placement removed successfully" });
    });
});

// ================= COMPANIES =================

// Get All Companies
app.get('/companies', (req, res) => {
    db.all("SELECT * FROM companies ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch companies: " + err.message });
        }
        res.json(rows);
    });
});

// Add Company
app.post('/add-company', (req, res) => {
    const { name, role, package: pkg } = req.body;

    if (!name || !role || !pkg) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    db.run(
        "INSERT INTO companies (name, role, package) VALUES (?, ?, ?)",
        [name.trim(), role.trim(), pkg.toString().trim()],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: "Failed to add company: " + err.message });
            }
            res.json({ success: true, message: "Company added successfully" });
        }
    );
});

// Delete Company (Safe check for placements)
app.delete('/delete-company/:id', (req, res) => {
    const companyId = req.params.id;

    db.get(
        "SELECT COUNT(*) AS count FROM placements WHERE company_id = ?",
        [companyId],
        (err, row) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Database error" });
            }

            if (row && row.count > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete: ${row.count} student(s) currently placed in this company!`
                });
            }

            db.run("DELETE FROM companies WHERE id = ?", [companyId], function (delErr) {
                if (delErr) {
                    return res.status(500).json({ success: false, message: "Error deleting company" });
                }
                res.json({ success: true, message: "Company deleted successfully" });
            });
        }
    );
});

// ================= RECOMMENDATION ENGINE =================

// Recommend Companies based on CGPA and Package Tier
app.get('/recommend/:cgpa', (req, res) => {
    const cgpa = parseFloat(req.params.cgpa);

    if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
        return res.status(400).json({ error: "Invalid CGPA parameter" });
    }

    db.all("SELECT * FROM companies", [], (err, companies) => {
        if (err) {
            return res.status(500).json({ error: "Failed to evaluate recommendations" });
        }

        // Helper to extract numeric package value (e.g., "12 LPA", "10L", "8.5")
        const parsePkg = (val) => {
            if (!val) return 0;
            const match = val.toString().replace(/,/g, '').match(/[\d.]+/);
            return match ? parseFloat(match[0]) : 0;
        };

        let tierTitle = "";
        let advice = "";
        let eligibleCompanies = [];

        if (cgpa >= 9.0) {
            tierTitle = "🌟 Elite Tier (CGPA 9.0+)";
            advice = "Eligible for all Tier 1 Dream Companies, high-paying tech giants & product roles.";
            eligibleCompanies = companies; // eligible for all, prioritized by package
        } else if (cgpa >= 8.0) {
            tierTitle = "💼 Premium Tier (CGPA 8.0 - 8.9)";
            advice = "Strongly eligible for prominent MNCs, product companies, and core tech roles.";
            eligibleCompanies = companies;
        } else if (cgpa >= 6.5) {
            tierTitle = "📈 Standard Tier (CGPA 6.5 - 7.9)";
            advice = "Eligible for standard campus recruitment drives and mass hiring partners.";
            eligibleCompanies = companies.filter(c => parsePkg(c.package) <= 9 || parsePkg(c.package) === 0);
        } else {
            tierTitle = "🎯 Foundation Tier (CGPA < 6.5)";
            advice = "Focus on technical certifications and aptitude preparation for open drives.";
            eligibleCompanies = companies.filter(c => parsePkg(c.package) <= 6 || parsePkg(c.package) === 0);
        }

        // Sort eligible companies by package descending
        eligibleCompanies.sort((a, b) => parsePkg(b.package) - parsePkg(a.package));

        res.json({
            cgpa: cgpa,
            tier: tierTitle,
            advice: advice,
            companies: eligibleCompanies
        });
    });
});

// Fallback to frontend index.html for direct navigation
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Placement Management Server running on http://localhost:${PORT}`);
});