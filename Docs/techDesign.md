# Tech Design

## HR & Attendance System

Based on the final build list and the ERD (15 tables).

---

# Part A: Tech Decisions

## A1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend API | PHP, Laravel, Sanctum (cookie sessions) |
| Database | MySQL (the `sessions` table holds login sessions) |
| Face recognition | Python, FastAPI, Hugging Face model, as a separate microservice |
| Scheduler | Laravel Scheduler (daily attendance job, match log cleanup) |
| Email | Laravel Mail with an SMTP service, used only for the password reset email |
| Deployment | Docker Compose |

## A2. Architecture

- The React app talks only to the Laravel API, with a login cookie.
- The door device (a camera and a small green or red screen) talks only to Laravel, with a device key.
- Laravel holds all the business logic and the MySQL database, including the face data.
- The Python service is internal only. The browser and the door never call it directly.
- The Python service stores nothing on disk. It keeps a copy of the face embeddings in memory.

```
React ---- cookie ----> Laravel API ----> MySQL
Door device -- key --->      |
                             v  (HTTP, internal, service key)
                 Python FastAPI + Hugging Face
```

## A3. Why a separate Python service

The face model runs in Python, not in PHP. Keeping it in its own small service lets Laravel stay the only backend that the React app and the door talk to.

## A4. Face service endpoints (internal, called by Laravel only)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/enroll` | Receives an image, checks quality (one face, light, size), returns the face embedding. It does not store it. |
| POST | `/identify` | Receives an image, checks liveness, and returns the best match: `user_id` and `score`, or no match. |
| PUT | `/embeddings/{user_id}` | Adds or replaces the in-memory copy after an enrollment. |
| DELETE | `/embeddings/{user_id}` | Removes the in-memory copy (reset or archive). |

- On start, Python loads all embeddings from Laravel (`GET /internal/face-embeddings`).
- Every call needs the shared secret in the `X-Service-Key` header. There is no public port.
- Python returns the best match and the score. Laravel compares the score with `face_match_threshold` from Settings, so the Admin can tune it.

## A5. Flows

**Door pass**
1. The door sends the camera image to Laravel (`POST /door/pass`, header `X-Door-Key`).
2. Laravel checks the key and the rate limit, then calls `/identify`.
3. Laravel compares the score with the threshold and saves a row in `face_match_logs` (the user is null if not recognized).
4. If recognized, Laravel updates the person's attendance row for today:
   - No row: create it with `come_in`.
   - Row with an empty `get_out`: fill `get_out`.
   - Row with a filled `get_out` (back from a break): add the time away to `break_minutes` and clear `get_out`.
5. The `AttendanceCalculator` sets the status, and the image is discarded.
6. Laravel answers only `{ "ok": true }` or `{ "ok": false }`, so the door shows green or red, with no name.

**Enrollment**
1. The person ticks the consent box. Laravel creates a `face_profiles` row with status `pending`, with the consent time and the text version.
2. React sends a camera image. Laravel calls `/enroll`.
3. If the quality is good, Laravel saves the encrypted embedding, sets the row to `active`, and calls `PUT /embeddings/{user_id}`.
4. Reset or archive: Laravel sets the row to `revoked`, erases the embedding, and calls `DELETE /embeddings/{user_id}`.

## A6. Auth and security

- **Login:** a cookie session (Sanctum, database sessions). React calls `GET /sanctum/csrf-cookie` when the app starts. There is no refresh endpoint, and the session is renewed while the user is active and expires after inactivity.
- **Middleware order:** rate limiter, then authenticated (active, not archived), then role check, then policy check. CSRF applies to every request that changes data.
- **Rate limits:** login, forgot password, reset password, and the door pass endpoint.
- **Password reset:** Laravel's `password_reset_tokens` table, with an expiring one-time link. After a reset or an archive, delete that user's rows in `sessions`.
- **Record rule:** HR acts on employees, the Admin acts on HR users, and nobody acts on themselves. It is checked in Policies.
- **API Resources:** never return a User model directly. `password` is always hidden. `salary` is shown only to those who may see it. The face embedding is never returned.
- **Secrets in `.env`:** the door key, the service key, and the encryption key.
- **Time:** all timestamps are in UTC and shown in the timezone from Settings.

## A7. Deployment (Docker)

| Container | What it runs |
|---|---|
| `frontend` | React app |
| `backend` | PHP Laravel API, and the scheduler |
| `db` | MySQL |
| `face-service` | Python FastAPI with the Hugging Face model |

- The `face-service` container has no public port. Only `backend` can reach it, over the internal Docker network.
- The `db` container is used only by `backend`.
- One `docker compose up` starts everything.

## A8. Minimum tests

- `AttendanceCalculator`: Present, Late, Absent, On leave, Holiday, breaks, and no check-out.
- Warning and strike counting, including revoking.
- Permission checks that must return 403 (HR on an HR user, anyone on themselves, Admin on an employee).
- Liveness: a written test plan with a printed photo, a phone screen, and a replayed video.

---

# Part B: Laravel API Endpoints

All endpoints are under `/api`, except `GET /sanctum/csrf-cookie`. Everything requires login except the public ones marked "Public". Nothing is deleted: every "delete" is archive and restore.

**Who column:** A = Admin, HR = HR, E = an HR or employee user on their own record, DH = Department head, PL = Project lead, M = Project member, Scoped = HR on employees and the Admin on HR users, never on yourself.

---

## 1. Auth

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | Public | Get the CSRF cookie |
| POST | `/auth/login` | Public | Login (sets the session cookie) |
| POST | `/auth/logout` | All | Logout (ends the session) |
| POST | `/auth/change-password` | All | Change password (forced on first login) |
| POST | `/auth/forgot-password` | Public | Send a reset link. It always gives the same answer. |
| POST | `/auth/reset-password` | Public | Set a new password with the token from the link |

## 2. Me (Profile)

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/me` | All | My full info (salary view only) |
| PATCH | `/me` | E | Edit only phone and address |
| GET | `/me/attendance?month=` | E | My attendance by day |
| GET | `/me/leave-balances` | E | My balance per leave type |
| GET | `/me/leave-requests` | E | My leave requests |
| GET | `/me/warnings` | E | My warnings and strikes |

## 3. Users (People and Person details)

The Admin sees HR users. HR sees employees.

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/users?search=&status=&department_id=&page=` | A, HR | List (10 per page, Active or Archived) |
| GET | `/users/stats` | A, HR | The stats cards |
| POST | `/users` | Scoped | Create a person. The temporary password is shown once. |
| GET | `/users/{id}` | Scoped | Person details |
| PATCH | `/users/{id}` | Scoped | Edit info (name, email, department, job title, manager, hire date, contract dates, phone, address) |
| PATCH | `/users/{id}/salary` | Scoped | Change salary (logged) |
| GET | `/users/{id}/salary-changes` | Scoped | List of salary changes from the audit log |
| PATCH | `/users/{id}/archive` | Scoped | Archive: blocks login, revokes the face profile, ends sessions |
| PATCH | `/users/{id}/restore` | Scoped | Restore |
| POST | `/users/{id}/reset-password` | Scoped | Set a temporary password and end sessions |
| POST | `/users/{id}/face/reset` | Scoped | Revoke the face profile so the person enrolls again |

## 4. Departments

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/departments?status=` | HR, A | List with head, employee count, status |
| POST | `/departments` | HR | Create |
| PATCH | `/departments/{id}` | HR | Update name and head together |
| PATCH | `/departments/{id}/archive` | HR | Archive |
| PATCH | `/departments/{id}/restore` | HR | Restore |

## 5. Face and door

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | `/me/face/consent` | E | Give consent (creates the pending profile) |
| POST | `/me/face/enroll` | E | Enroll my face (camera image, with a quality check) |
| POST | `/door/pass` | Door device | Door pass (device key, no login). Answers only ok true or false. |
| GET | `/internal/face-embeddings` | Python service | Load embeddings at start (service key) |

## 6. Attendance

The status is calculated by the server (`AttendanceCalculator`), never sent by the app or typed in:
- **Present:** came in on or before the start time plus the grace period.
- **Late:** came in after that.
- **Absent:** no pass and no approved leave by the end of the day (the daily job).
- **On leave** and **Holiday** are set by the daily job.

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/users/{id}/attendance?month=` | Scoped | A person's attendance by day |
| POST | `/users/{id}/attendance` | Scoped | Create a day by hand (fallback), with a reason |
| PATCH | `/attendance/{id}` | Scoped | Edit `come_in`, `get_out`, and `break_minutes`, with a required reason. The status is recalculated and the change is logged. |

## 7. Warnings and strikes

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/users/{id}/warnings` | Scoped | Warnings and strikes of a person |
| POST | `/users/{id}/warnings` | Scoped | Issue a warning (reason and date). The 3rd free warning creates a strike in a transaction. |
| PATCH | `/warnings/{id}/revoke` | Scoped | Revoke a warning (reason required). If it belongs to a strike, that strike is revoked too. |
| PATCH | `/strikes/{id}/revoke` | Scoped | Revoke a strike (reason required) |

## 8. Leave

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/leave-types` | All | List leave types |
| POST | `/leave-types` | A | Add a leave type |
| PATCH | `/leave-types/{id}` | A | Edit a leave type (name, unit, yearly number) |
| PATCH | `/leave-types/{id}/archive` | A | Archive a leave type |
| GET | `/users/{id}/leave-balances` | Scoped | A person's balances |
| POST | `/leave-requests` | E | Request leave (the server calculates the amount and checks overlap and balance) |
| PATCH | `/leave-requests/{id}/cancel` | E | Cancel my request while it is pending |
| GET | `/leave-requests?status=&type=&user_id=&page=` | Scoped | Requests: HR sees employees', the Admin sees HR users' |
| PATCH | `/leave-requests/{id}/approve` | Scoped | Approve (optional comment) |
| PATCH | `/leave-requests/{id}/reject` | Scoped | Reject (optional comment) |

## 9. Projects

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/projects?department_id=&status=&archived=` | HR, DH, E | Projects the user may see, with progress and the overdue flag |
| POST | `/projects` | HR, DH | Create (name, description, departments, lead, dates, status). The lead becomes a member. |
| GET | `/projects/{id}` | HR, DH, M | Details |
| PATCH | `/projects/{id}` | HR, DH | Edit, including the lead and the status (completing with open tasks needs `confirm=true`) |
| PATCH | `/projects/{id}/archive` | HR, DH | Archive |
| PATCH | `/projects/{id}/restore` | HR, DH | Restore |
| POST | `/projects/{id}/members` | HR, DH | Add a member |
| DELETE | `/projects/{id}/members/{user_id}` | HR, DH | Remove a member (not the lead, not someone with open tasks). The history stays in the audit log. |
| GET | `/projects/{id}/activity` | HR, DH, M | Activity log |

DH can only manage the projects of their own department(s).

## 10. Tasks

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/projects/{id}/tasks?status=&assignee_id=` | HR, DH, M | List tasks |
| POST | `/projects/{id}/tasks` | HR, DH, PL | Create a task (the assignee must be a member) |
| PATCH | `/tasks/{id}` | HR, DH, PL | Edit a task (title, assignee, due date) |
| PATCH | `/tasks/{id}/status` | HR, DH, PL, assignee | Change status (a member only on their own tasks) |
| PATCH | `/tasks/{id}/archive` | HR, DH, PL | Archive a task |
| PATCH | `/tasks/{id}/restore` | HR, DH, PL | Restore a task |

## 11. Settings

|