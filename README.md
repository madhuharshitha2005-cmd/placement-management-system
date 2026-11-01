# 🎓 Placement Management System

A full-stack web application designed for universities, colleges, and placement cells to manage student records, recruiting partner companies, placement status, student resumes, and career recommendations.

---

## 🚀 Key Features

- **🔐 User Authentication**: Secure Admin and Staff registration and login with local session persistence.
- **👨‍🎓 Student Management**: Add and manage student records with validation (Name, Email, Branch, CGPA 0.0 - 10.0).
- **📄 Resume Upload & Download**: Upload PDF or Word documents directly with student profiles; download and review resumes with a single click.
- **🏢 Partner Company Directory**: Track recruiting companies, available job roles, and offered compensation packages.
- **💼 Placement Tracking & Management**:
  - Assign students to companies with instantaneous status updates.
  - One-click **Unplace / Reassign** functionality for accurate record keeping.
  - Safe company deletion guard (prevents accidental deletion of companies with hired students).
- **🎯 Intelligent Recommendation Engine**:
  - Evaluates student CGPA across tiered thresholds (Elite, Premium, Standard, Foundation).
  - Dynamically matches students with eligible registered partner companies in the database.
- **📊 Real-time Dashboard Analytics**:
  - Total Students registered.
  - Placed Students count.
  - Pending Placements backlog.
  - Active Partner Companies.
- **🔍 Search & Filter**: Real-time search across student names, emails, branches, and placement statuses.
- **🌙 Dark / Light Mode**: Beautiful glassmorphic UI with persistent theme toggle.

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (`placement.db`)
- **File Handling**: Multer (configured with unique timestamped filenames)
- **Frontend**: HTML5, CSS3 (Modern Flexbox/Grid, Glassmorphic UI), JavaScript (ES6+ Fetch API)

---

## 📦 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) (v16 or higher) installed on your system.

### 2. Installation
Clone or navigate to the project directory:
```bash
cd placement-management-system
npm install
```

### 3. Running the Server
Start the application server:
```bash
npm start
```
The server will start on:
```
http://localhost:3000
```
*(Or specify custom port via `PORT=8000 npm start`)*

### 4. Access the Web App
Open your web browser and navigate to:
[http://localhost:3000](http://localhost:3000)

---

## 👤 Default Test Accounts

You can register any new account on the registration page, or use existing accounts in the database:
- **Username**: `nidhi2` | **Password**: `123`
- **Username**: `amma` | **Password**: `123`

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Register a new user |
| `POST` | `/login` | Authenticate user credentials |
| `GET` | `/students` | Get all students with placement info |
| `POST` | `/add-student` | Create new student profile & upload resume |
| `DELETE` | `/delete-student/:id` | Delete student and their resume file |
| `POST` | `/place-student` | Record placement for a student |
| `POST` | `/unplace-student` | Remove placement status for a student |
| `GET` | `/companies` | Get list of all recruiting companies |
| `POST` | `/add-company` | Add a new recruiting partner |
| `DELETE` | `/delete-company/:id` | Delete company (safeguarded against active placements) |
| `GET` | `/recommend/:cgpa` | Get tiered company recommendations based on CGPA |
| `GET` | `/uploads/:filename` | View or download uploaded resume files |

---

## 📂 Project Structure

```
placement-management-system/
├── frontend/
│   ├── index.html       # Landing page
│   ├── login.html       # Admin / Staff sign-in
│   ├── register.html    # Admin account creation
│   ├── dashboard.html   # Main management dashboard
│   ├── script.js        # Frontend logic & API interaction
│   └── style.css        # Clean, responsive & dark-mode styling
├── uploads/             # Student resume documents
├── package.json         # Dependencies and scripts
├── placement.db         # SQLite database file
├── server.js            # Express server & API routes
└── README.md            # Documentation
```
