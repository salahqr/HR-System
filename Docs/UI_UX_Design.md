# HR & Attendance System: Pages

See the design: [Figma Design](https://www.figma.com/design/wyiIVUoTmY8R55fSoChygr/HR-System?node-id=9-2&t=UXjg0oj7N6tUtkKv-1)

**13 pages.** Popups handle the forms, and tabs hold related content. Nothing is deleted anywhere: every "delete" is an **Archive**, and archived items can be restored.

---

## 1. Landing & Authentication

| # | Page | Who | What is in it |
|---|------|-----|---------------|
| 1 | **Landing** | Public | A simple info page: a headline, three short feature points (face attendance at the door, leave, projects), a Login button, and a footer. No sign-up. |
| 2 | **Login** | Public | Email and password, and a "Forgot password?" link that opens a popup with an email field. The forced password change on first login is a popup. |
| 3 | **Reset Password** | Public | Opened from the email link: new password and confirm password. An expired or used link shows a message and a link back to Login. |

---

## 2. Personal Pages

| # | Page | Who | What is in it |
|---|------|-----|---------------|
| 4 | **Dashboard** | Everyone | View only: tiles and charts. **Employee:** today's result (Present or Late, with the time), leave balances, warnings and strikes, and my projects. **HR:** Present, Late, and Absent today, requests waiting, face not enrolled, and overdue projects. **Admin:** HR users' stats (active HR users, face not enrolled, open strikes). |
| 5 | **Profile** | Everyone | My full information. I edit only phone, address, password, and face enrollment (first time: consent, camera capture, and whether it succeeded). Everything else is locked. This is the same page as **Person Details**, opened for myself, with the tabs Info, Salary and Warnings and strikes (view only), Leave (with a **Request leave** popup), and Attendance. The Admin has no face, so the Admin edits only the password. |

---

## 3. Projects

| # | Page | Who | What is in it |
|---|------|-----|---------------|
| 6 | **Projects** | Everyone | **Employee:** sees their projects. **Department head:** sees their department's projects and has a **New project** button. **HR:** sees all projects with department and status filters, and can create, edit, and archive. Each project shows a progress bar and an overdue flag. |
| 7 | **Project Details** | Anyone who can see the project | Tabs: **Tasks** (add, edit, archive, change status), **Members** (add and remove, Lead badge), and **Activity**. Progress and the overdue flag are shown at the top. **Edit project** opens in a side drawer. **Archive** is in the "..." menu and asks for confirmation. |

---

## 4. People & Departments

| # | Page | Who | What is in it |
|---|------|-----|---------------|
| 8 | **People** | Admin, HR | The **Admin** sees HR users. **HR** sees employees. Stats cards, search by name or email, a status filter (Active or Archived), 10 per page, and a Face column (Enrolled or Not enrolled). **Add** is a popup that shows the temporary password once. Each row has Archive or Restore, and Reset password. |
| 9 | **Person Details** | Admin, HR | Opened from People. Tabs: **Info** (name, email, department, job title, manager, hire date, contract dates, phone, address, face status, **Reset face enrollment**), **Salary** (current salary, list of changes, strike deductions as information only), **Warnings and strikes** (issue and revoke), **Leave** (balances, requests, approve or reject), and **Attendance** (history by day, month picker, correct a day with a required reason). |
| 10 | **Departments** | HR | List with the head, the number of employees, and the status. **Add** and **Update** (name and head together) are popups. Archive or Restore. |

---

## 5. Leave & Reports

| # | Page | Who | What is in it |
|---|------|-----|---------------|
| 11 | **Leave Requests** | HR (the Admin for HR users) | A **Pending** card on top and a **History** card below. Approve or reject with an optional comment. Filters: name, type, and status. |
| 12 | **Reports** | HR | View only: a date range and a department filter, tiles (on-time rate, late arrivals, absences, leave days), and charts (attendance by week, leave days by type, late and absent by department, projects by status). |

---

## 6. Settings

| # | Page | Who | What is in it |
|---|------|-----|---------------|
| 13 | **Settings** | The Admin edits, HR reads | Tabs: **Work Hours** (start time, end time, grace period, working days, timezone), **Holidays**, **Leave Policies** (Full day off in days per year, Leave early in times per year), and **Company Rules** (strike rule: 3 warnings = 1 strike = $50, minimum overtime minutes, face match threshold). Every change is logged. |

---

## Not in the list

- **Check-in:** there is no check-in page. The door camera does it, and the employee sees the result on the Dashboard.
- **Door screen:** a separate tiny screen that shows only green or red. It runs on the door device with no login, so it is not one of the 13 user pages.

---

## To build

1. **Landing page** first.
2. **Main layout** with the nav bar and shared parts. Every other page is imported into it.

Nav bar by role:

| Role | Nav bar |
|------|---------|
| Employee | Dashboard, Projects, user menu (Profile, Log out) |
| HR | Dashboard, People, Departments, Leave Requests, Projects, Reports, Settings, user menu |
| Admin | Dashboard, People, Settings, user menu |

---

## Colors

### Brand

| Role | Name | Hex |
|------|------|-----|
| **Primary** | Navy | `#3968AC` |
| **Primary hover** | Dark Navy | `#2F5590` |
| **Secondary** | Muted Denim | `#737D8C` |
| **Accent** | Dark Lagoon | `#0F766E` |

### Neutrals

| Role | Name | Hex |
|------|------|-----|
| **Background** | Cloud White | `#FFFFFF` |
| **Surface** | Soft Cobalt | `#F4F6FA` |
| **Text** | Deep Cobalt | `#0B1220` |

### Supporting (muted text, border)

| Role | Name | Hex |
|------|------|-----|
| **Muted text** | Slate | `#475569` |
| **Border** | Soft Cyan | `#E2E8F0` |

### Status (attendance and overdue only)

| Status | Hex |
|--------|-----|
| **Present** | `#15803D` |
| **Late** | `#B45309` |
| **Absent / Overdue** | `#B91C1C` |