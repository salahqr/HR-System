# HR & Attendance System: final build list

## Rules for everything
- [ ] No delete anywhere. Users, departments, projects, and tasks are archived and restored (`archived_at`, Laravel soft deletes). Archived items are hidden by default, with a filter to show them. An archived user cannot log in.
- [ ] Every important change goes to the audit log: who, what, old and new value, when.
- [ ] Timestamps are stored in UTC and shown in the timezone from Settings.
- [ ] Permissions are enforced on the server in Policies. The UI only hides buttons.

## Who manages whose record
| The record belongs to | Who may act on it |
|---|---|
| An HR user | Admin only |
| An employee | HR only |
| Yourself | Nobody edits or approves their own record |
- [ ] "Act on it" means: edit, archive, reset password, reset face enrollment, change salary, issue or revoke warnings, approve leave, and correct attendance.
- [ ] HR requests leave: the Admin approves. HR gets a warning: the Admin issues it. HR attendance corrections: the Admin does them.
- [ ] The Admin cannot act on employees' records.
- [ ] Each Policy checks the target's role, and that actor is not equal to target.

## Auth and security
- [ ] Login with email and password. First login: the user must change the temporary password, then enroll their face.
- [ ] Logout. The token is in an httpOnly cookie (Sanctum cookie mode), and the backend renews it while the user is active.
- [ ] Forgot password: email, a one-time link that expires, then a new password. Uses Laravel's `password_reset_tokens` table.
- [ ] After a password reset or an archive, delete that user's rows in the `sessions` table (database session driver), so the old sessions end.
- [ ] The first Admin is seeded, and an artisan command creates or resets an Admin.
- [ ] Middleware, in order: rate limiter, logged in and active, role check, policy check. CSRF on every request that changes data.

## People: Admin sees HR users, HR sees employees
- [ ] List with a stats cards row, search by name or email, a status filter, and 10 per page. A Face column shows Enrolled or Not enrolled.
- [ ] Add a person (the temporary password is shown once), view, update, archive and restore, reset password.

## Person details, and the Profile (same page)
- [ ] Info: name, email, department, job title, manager, hire date, contract start and end, phone, address, and the face enrollment status with "Reset face enrollment".
- [ ] Salary: set when the person is created and edited for raises, with a list of changes from the audit log, and a list of strike deductions with a monthly total (information only).
- [ ] Warnings and strikes: the list, issue a warning, revoke.
- [ ] Leave: balances and requests. Request leave is available on your own page.
- [ ] Attendance: history by day with a month picker. Correct a day, and add a pass, with a required reason.
- [ ] On your own page, edit only phone, address, password, and face enrollment (first time). Everything else is view only.

## Settings: the Admin edits, HR reads
- [ ] Work start time, end time, grace period, working days, timezone (the end time must be after the start time).
- [ ] Holidays.
- [ ] Leave types and numbers: Full day off (days per year) and Leave early (times per year).
- [ ] Strike rule: 3 warnings = 1 strike = $50.
- [ ] Minimum minutes that count as overtime.
- [ ] Face match threshold.

## Departments (HR)
- [ ] List with the head, the number of employees, and the status.
- [ ] Add a department. Update the name and the head (the head comes from that department's people). Archive and restore.
- [ ] An archived department takes no new employees or projects.

## Attendance: face first
- [ ] Door: one camera, and the door screen shows only green (recognized) or red (not recognized), with no name. It needs no login and uses a device secret key.
- [ ] Flow: the door sends the camera image to Laravel, Laravel calls the Python service, Python returns the employee id and a score, and Laravel records the pass and calculates the rest. The image is discarded.
- [ ] The server decides the pass direction: the opposite of the employee's last pass. Two INs in a row cannot happen from the door.
- [ ] `attendance_passes`: employee_id, passed_at (UTC), direction (in or out), source (face or manual), added_by, reason (required for manual).
- [ ] `attendance`: employee_id, date, status, first_in, last_out, break_minutes, no_checkout, corrected_by, correction_reason, corrected_at.
- [ ] A day: the first in is the check-in, the last out is the check-out, and each out followed by an in is a break.
- [ ] Status: Present, Late, Absent, On leave, Holiday. Non-working days are never absent.
- [ ] All rules live in one `AttendanceCalculator` class with unit tests. React only displays results.
- [ ] Edge cases:
  - **No check-out:** the daily job closes the day and sets the no_checkout flag. HR adds the missing out pass with a reason.
  - **Pass on a holiday or non-working day:** the pass is kept, the status stays Holiday, and there is no Late logic.
  - **Pass on an approved leave day:** the pass is kept and flagged for HR, and the status stays On leave.
  - **Overnight shifts are not supported in v1.** A day is one calendar date.
  - **Manual pass (fallback):** it must alternate or the server rejects it. Adding a pass in the middle of a day re-checks the whole day.
- [ ] A daily job closes each day.
- [ ] Fallback: if the face fails repeatedly, or the service is down, HR adds a manual pass or a break with a required reason. The day is recalculated and logged.

## Face recognition
- [ ] Python FastAPI service with a Hugging Face model. It recognizes the face and returns the employee id and a score.
- [ ] It keeps a copy of the embeddings in memory, loaded when it starts and updated on enrollment, reset, and archive.
- [ ] Enrollment: an explicit consent checkbox (the time and the text version are saved), a quality check (one face, light, size), and "Enroll my face" in Profile. HR can reset an enrollment.
- [ ] Face columns on `employees`: embedding, model version, consent time, consent text version, enrolled time.
- [ ] `face_match_logs`: employee_id (null when not recognized), matched, score, created_at. It saves no images and is cleaned after a retention period.
- [ ] Security:
  - The embedding column is encrypted, hidden in the model, and never in list queries or API responses.
  - Python receives embeddings only over the internal network with a shared secret, and has no public port.
  - Raw images are never stored or logged.
  - Archiving a person erases their embedding (the one exception to "nothing is deleted").
  - Rate limit the check-in endpoint, and tune the match threshold with real test photos.
- [ ] Liveness: test a printed photo, a phone screen, and a replayed video, and write down the results. A Hugging Face model alone does not prevent spoofing. Until it passes, treat it as basic, and HR manual passes remain the fallback.

## Leave
- [ ] The employee requests leave from a calendar: dates, the type (Leave early also needs the time), and an optional note.
- [ ] Rules: no overlapping requests, no request above the balance, only working days are counted, and the employee can cancel while pending.
- [ ] The balance is calculated: the yearly number minus the approved leave in that year.
- [ ] HR approves or rejects with an optional comment. The Admin does it for HR users.
- [ ] Filters: name, type, and status.
- [ ] An approved full day off sets the attendance to On leave, never Absent.

## Warnings and strikes
- [ ] HR issues a warning with a reason and a date.
- [ ] A strike is created when an employee has 3 active warnings that are not yet in a strike. The 3 warnings are linked to it, and the amount is saved on the strike. The counting runs in a database transaction.
- [ ] Revoking a warning that belongs to a strike marks that strike as revoked, with the reason "warning revoked". The other warnings become free and count toward the next strike.
- [ ] A strike can also be revoked directly, and its warnings stay used.
- [ ] Every revoke needs a reason (revoked_at, revoked_by, revoked_reason) and is audit-logged. Nothing is deleted.
- [ ] Deduction totals count only strikes that are not revoked, and are shown as information only.

## Projects (full CRUD)
- [ ] Create a project: name, description, one or more departments, lead, dates, status. The lead becomes a member.
- [ ] View my projects and a project's details. Update and archive a project. Add and remove members.
- [ ] Tasks: create, edit, assign to a member, change status, archive.
- [ ] Progress is done tasks divided by total tasks. Overdue is flagged automatically. Completing a project with open tasks asks for confirmation.
- [ ] The activity log uses `audit_logs` with entity = project, with an index on entity and entity_id.
- [ ] Permissions (one Project policy, one Task policy):
  - HR: everything on any project.
  - Department head: everything on their department's projects.
  - Project lead: tasks on their own project.
  - Member: the status of their own tasks only.

## Dashboard
- [ ] Employee: today's result, leave balances, warnings and strikes, and projects, with charts.
- [ ] HR: Present, Late, and Absent today, requests waiting, face not enrolled, and overdue projects.
- [ ] Admin: HR users' stats (active HR users, face not enrolled, open strikes).

## Reports (HR, view only)
- [ ] A date range and a department filter.
- [ ] Attendance: on-time rate and status by week. Leave: days by type and by department. Lateness: late arrivals by department. Projects: count by status.

## Landing page
- [ ] A simple info page: a headline, three short feature points (face attendance at the door, leave, projects), a Login button, and a footer. No sign-up.

## Later (not planned yet)
Manager powers, the Timesheet page, the Leave calendar, Documents, overtime and early leave numbers, CSV exports.
