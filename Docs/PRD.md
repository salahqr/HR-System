# Product Requirements Document (PRD)

# HR & Attendance System (with Face-Recognition Check-In and Project Tracking)

---

## 1. Overview

A simple HR management system with three roles: **Admin**, **HR**, and **Employee**. "Employee" covers every level (intern, staff, manager, CEO, etc.). Job title/level is just a profile field, not a separate permission tier. HR users are also employee records: they check in and get paid through the system. The Admin adds the HR users. A department head (an employee) creates projects and assigns them to people.

The system handles:
- Employee records and departments
- Attendance via face recognition
- Leave requests
- Strikes
- Basic payroll
- Project tracking: projects belong to a department, and their progress and status are visible to the right people

### 1.1 Goals
- Replace manual attendance sheets with fast, reliable face check-in.
- Give HR one place to manage people, time, leave, discipline, and pay.
- Give employees transparent access to their own data.
- Give HR and employees a clear view of what each department is working on and how far along it is.

### 1.2 Non-Goals (v1)
- Recruiting/onboarding workflows, performance reviews, and benefits management
- Multi-company support
- Native mobile apps (the web app must work on mobile browsers)
- Notifications (email/push)
- Arabic/RTL support

---

## 2. Roles

| Role | Description |
|---|---|
| **Admin** | Adds and manages HR accounts (create, deactivate, reset password) |
| **HR** | Manages the whole system: employees, departments, attendance, leave, strikes, payroll, projects. Also has an employee record (checks in, gets paid) |
| **Employee** | Any level (intern to CEO). Checks in by face at the door camera, views own data, requests leave, works on assigned projects and tasks. If they are a department head, they also create projects and assign people (see 3.11) |

> **Project lead** is not a role. It is a flag on a project membership, so the role model stays simple.
> **Department head** is not a role either. It is a designation on the department, held by an employee.

---

## 3. Features

### 3.1 Auth
- Admin creates HR accounts; HR creates Employee accounts. Login by role (Admin / HR / Employee).
- New accounts get a temporary password and must change it on first login.
- Sessions expire. A refresh token keeps the user logged in without re-entering the password until it expires; logout revokes it.
- Password reset for employees is handled by HR; for HR users, by the Admin.

### 3.2 Departments
- HR creates, renames, and deactivates departments, and sets the department head.
- Every employee belongs to exactly one department.

### 3.3 Employee Profiles
- Fields: name, department, job title/level, salary, hire date, contact info, status (active / inactive).
- HR has full control; the employee edits own basic info only (contact details, password).
- Deactivating an employee keeps their history and blocks login. Employees are never permanently deleted.

### 3.4 Face Enrollment
- One-time face capture on first login. Raw images are not stored.
- Enrollment is done by the employee on first login, using their own device camera.
- HR can reset enrollment so the employee re-enrolls (e.g. appearance change, poor quality).
- Enrollment requires a quality check: single face, adequate lighting, face not too small.
- Employee explicitly consents to biometric processing before enrollment.

### 3.5 Attendance
- A camera at the main door recognizes employees by face when they arrive. There is no check-in page or button.
- A small screen at the door shows only **green** (recognized) or **red** (not recognized). It shows no name or details.
- The status is calculated automatically, never entered by hand: **Present** if checked in on time (start time + grace period), **Late** if after, **Absent** if no check-in and no approved leave by end of day.
- The employee sees the result later on their dashboard and in their attendance history.
- Working days, holidays, and weekends are set by HR in settings. Non-working days are never marked Absent.
- HR can manually correct any record (a reason is required).
- Fallback: if face recognition fails repeatedly, HR can record a manual check-in.
- Anti-spoofing: a printed photo or a phone screen must not pass at the door camera (liveness detection), and this must be tested before launch.

### 3.6 Attendance Stats
- HR sees late/absent counts per employee, filterable by department and date range.
- Employees see their own history only.

### 3.7 Strikes
- HR issues a strike (reason + date); the employee sees their own strikes.
- HR can revoke a strike (kept in history, marked revoked).
- Whether strikes affect payroll, and how, is set by HR in settings.

### 3.8 Employee Directory
- HR searches by name and filters by department.
- Employees have no access to the directory.

### 3.9 Leave Requests
- Employee requests day off / medical / normal leave with dates and an optional note.
- HR approves or rejects (with an optional comment).
- Leave balance is tracked per employee and per leave type; HR configures annual allowances.
- Rules: no overlapping requests, no requests exceeding balance (except medical, configurable), and approved leave days are never counted as Absent.
- Employee can cancel a request while it is still pending.

### 3.10 Payroll
- Base salary minus absence deductions. Approved leave is not deducted.
- Strike-related deductions follow the rule HR sets in settings.
- HR runs payroll per month; a run is locked after finalization, and corrections are made through adjustments.
- Employee views and downloads their own payslip (PDF). This includes HR users.

### 3.11 Project Tracking

**Purpose:** show which projects each department is working on and how far along each one is.

**Projects**
- Fields: name, description, owning department, lead (an employee), start date, due date, status.
- A project belongs to a single department.
- **Status values:** Not Started, In Progress, On Hold, Completed, Cancelled.
- The department head creates, edits, and deletes projects for their department, and assigns them to people. HR can also create, edit, and delete any project.

**Members**
- The department head assigns members (from any department) and marks one as lead. HR can also assign members.

**Tasks**
- Each project has tasks: title, assignee, due date, status (To Do / In Progress / Done).
- The project lead manages all tasks in their project; a member updates only their own tasks.

**Progress**
- Progress percentage is based on done tasks versus total tasks. A project with no tasks shows 0%.
- Marking a project Completed with open tasks requires confirmation.

**Overdue flag**
- Shown automatically when the due date has passed and the project is not Completed or Cancelled. Tasks get the same flag.

**Activity log**
- Every status change, task update, member change, and reassignment is recorded with who, what, and when, so a project's history can be traced.

**Project dashboard**
- HR: all projects, filterable by department and status, with progress bars and overdue counts.
- Department head: all projects of their department, with the same filters.
- Employee: only the projects they are allowed to see (see section 4.1).

---

## 4. Role & Permission Matrix

| Capability | Admin | HR | Employee |
|---|---|---|---|
| Manage HR accounts | Full | None | None |
| Manage employees | None | Full | None |
| Manage departments | None | Full | None |
| Own profile | None | Edit anyone | Edit own only |
| Face enrollment | None | Manage all | Own only |
| Attendance | None | View/correct all | View own only |
| Strikes | None | Issue / revoke | View own only |
| Leave | None | Approve/reject | Request / cancel own |
| Payroll | None | Run + view all | View own payslip |
| Projects | None | Create / edit / delete / assign | Department head: create / edit / delete / assign for own department. Others: view (see 4.1) |
| Tasks | None | Manage all | Department head: all tasks in own department's projects. Lead: all tasks in own project. Member: update own tasks only |
| Project activity log | None | All projects | Projects they can see |
| Dashboard | None | Company-wide | Personal only |

### 4.1 Project visibility rule
An employee can see a project only if they are:
- a **member** of that project, or
- the **head/leader of the department** that the project belongs to.

The department head can also create and assign projects for their department. Other employees in the department do not see the project unless they are members. Employees see only names and task status of teammates on visible projects, never salary, attendance, or strike data.

---

## 5. Non-Functional Requirements

- Face check-in returns a result within a few seconds under normal load.
- The door screen shows only green or red, so nobody can see another person's name or attendance there.
- Works on desktop and mobile browsers. English only in v1.
- Role checks are enforced on every action, not just hidden in the UI.
- Face data is biometric: access is HR-only and it is never shown to users.
- Salary and payroll data are visible to HR and the owning employee only.
- Sensitive HR actions (salary, attendance corrections, strikes, payroll, project changes) are logged.
- If face recognition is down, HR can still record attendance manually.

---

## 6. Out of Scope for v1

- Notifications (email/push) for leave decisions, strikes, and project changes
- Arabic/RTL support
- Gantt charts, task comments, and file attachments on projects
- Time tracking on tasks
- Overtime calculation, tax/insurance calculation, and bank export in payroll
- Shift scheduling (single configured start time only)