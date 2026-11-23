<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Central access rules
    |--------------------------------------------------------------------------
    */

    private function getUserAccess(User $currentUser, ?User $target = null): array
    {
        $access = [
            'visible_roles' => [],
            'self_only' => false,
            'can_create' => false,
            'creatable_roles' => [],
            'allowed_fields' => [],
            'can_update' => false,
        ];

        // Self edit: personal fields only.
        // TODO: add the third personal field you decide on (name/email removed on purpose).
        $personalFields = ['phone', 'address'];

        $adminFields = [
            'name',
            'email',
            'department_id',
            'job_title',
            'hire_date',
            'salary',
            'phone',
            'address',
            'role',
            'is_supervisor',
            'is_active',
            'is_head_of_department',
        ];

        $hrFields = [
            'name',
            'email',
            'department_id',
            'job_title',
            'hire_date',
            'salary',
            'phone',
            'address',
            'is_active',
            'is_head_of_department',
        ];

        switch ($currentUser->role) {

            case 'admin':

                $access['visible_roles'] = ['admin', 'hr', 'employee'];
                $access['can_create'] = true;
                $access['creatable_roles'] = ['admin', 'hr', 'employee'];

                if ($target !== null) {

                    if ($currentUser->id === $target->id) {
                        $access['allowed_fields'] = $personalFields;
                    } elseif ($target->role === 'admin') {
                        // Admin cannot edit another admin.
                        return $access;
                    } else {
                        $access['allowed_fields'] = $adminFields;
                    }

                    $access['can_update'] = true;
                }

                break;

            case 'hr':

                $access['visible_roles'] = $currentUser->is_supervisor
                    ? ['admin', 'hr', 'employee']
                    : ['employee'];

                if ($currentUser->is_supervisor) {
                    $access['can_create'] = true;
                    $access['creatable_roles'] = ['hr', 'employee'];
                }

                if ($target !== null) {

                    if ($currentUser->id === $target->id) {
                        $access['allowed_fields'] = $personalFields;
                        $access['can_update'] = true;
                        break;
                    }

                    // Normal HR can only edit employees.
                    if (!$currentUser->is_supervisor && $target->role !== 'employee') {
                        return $access;
                    }

                    // Supervisor HR can edit employees, HR users and admins
                    // (an admin is treated like a normal employee here).
                    $access['allowed_fields'] = $hrFields;
                    $access['can_update'] = true;
                }

                break;

            case 'employee':

                $access['self_only'] = true;

                if ($target !== null) {

                    if ($currentUser->id !== $target->id) {
                        return $access;
                    }

                    $access['allowed_fields'] = $personalFields;
                    $access['can_update'] = true;
                }

                break;
        }

        return $access;
    }

    /**
     * Limit a users query to what the current user may see.
     * Everyone can always see their own row.
     */
    private function applyVisibility($query, User $currentUser, array $access): bool
    {
        if ($access['self_only']) {
            $query->where('users.id', $currentUser->id);
            return true;
        }

        if (!empty($access['visible_roles'])) {
            $query->where(function ($q) use ($access, $currentUser) {
                $q->whereIn('users.role', $access['visible_roles'])
                    ->orWhere('users.id', $currentUser->id);
            });
            return true;
        }

        return false;
    }

    /*
    |--------------------------------------------------------------------------
    | Get Users
    |--------------------------------------------------------------------------
    */

    public function getUsers(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'nullable', 'string'],
            'job_title' => ['sometimes', 'nullable', 'string'],
            'department_id' => [
                'sometimes',
                'nullable',
                'uuid',
                'exists:departments,id',
            ],
            'status' => ['sometimes', 'nullable', 'in:active,archived,all'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $currentUser = $request->user();
        $access = $this->getUserAccess($currentUser);

        $users = User::query();

        if (!$this->applyVisibility($users, $currentUser, $access)) {
            return response()->json([
                'message' => 'Unauthorized.',
            ], 403);
        }

        // Default: active users only.
        $status = $validated['status'] ?? 'active';

        $users
            ->when($validated['name'] ?? null, function ($query, $name) {
                $query->where('users.name', 'LIKE', "%{$name}%");
            })
            ->when($validated['job_title'] ?? null, function ($query, $jobTitle) {
                $query->where('users.job_title', 'LIKE', "%{$jobTitle}%");
            })
            ->when($validated['department_id'] ?? null, function ($query, $departmentId) {
                $query->where('users.department_id', $departmentId);
            })
            ->when($status !== 'all', function ($query) use ($status) {
                if ($status === 'active') {
                    $query->whereNull('users.archived_at');
                } else {
                    $query->whereNotNull('users.archived_at');
                }
            })
            ->leftJoin(
                'departments',
                'users.department_id',
                '=',
                'departments.id'
            )
            ->select([
                'users.id',
                'users.name',
                'users.email',
                'users.role',
                'users.job_title',
                'users.department_id',
                'departments.name as department_name',
                'users.archived_at',
                'users.is_supervisor',
            ])
            ->latest('users.created_at');

        return response()->json(
            $users->paginate($validated['per_page'] ?? 10)->withQueryString(),
            200
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Create User
    |--------------------------------------------------------------------------
    */

    public function createUser(Request $request): JsonResponse
    {
        $currentUser = $request->user();
        $access = $this->getUserAccess($currentUser);

        if (!$access['can_create']) {
            return response()->json([
                'message' => 'You are not authorized to create users.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', Rule::in($access['creatable_roles'])],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date', 'before_or_equal:today'],
            'salary' => ['nullable', 'numeric', 'min:0'],
            'phone' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:500'],
            'is_supervisor' => ['sometimes', 'boolean'],
            'is_head_of_department' => ['sometimes', 'boolean'],
        ]);

        $isAdmin = $currentUser->role === 'admin';

        // Only admins can create HR supervisors.
        if (!$isAdmin) {
            $validated['is_supervisor'] = false;
        }

        // Only HR users can be supervisors.
        if (
            ($validated['is_supervisor'] ?? false) &&
            $validated['role'] !== 'hr'
        ) {
            return response()->json([
                'message' => 'Only HR users can be supervisors.',
            ], 422);
        }

        $isHead = $validated['is_head_of_department'] ?? false;

        unset($validated['is_head_of_department']);

        if ($isHead && !($validated['department_id'] ?? null)) {
            return response()->json([
                'message' => 'A department is required to assign a department head.',
            ], 422);
        }

        if ($isHead && $validated['role'] !== 'hr') {
            return response()->json([
                'message' => 'Only HR users can be department heads.',
            ], 422);
        }

        // First login must change the password.
        // Needs a boolean column "must_change_password" (default false) + fillable.
        $validated['must_change_password'] = true;

        $user = DB::transaction(function () use ($validated, $isHead) {

            $validated['password'] = Hash::make($validated['password']);

            $user = User::create($validated);

            if ($isHead) {
                Department::where('id', $user->department_id)
                    ->update(['head_id' => $user->id]);
            }

            return $user;
        });

        return response()->json([
            'message' => 'User created successfully',
            'user' => $user,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Get Specific User
    |--------------------------------------------------------------------------
    */

    public function getSpecificUser(Request $request, $id): JsonResponse
    {
        $currentUser = $request->user();
        $access = $this->getUserAccess($currentUser);

        $query = User::query();

        if (!$this->applyVisibility($query, $currentUser, $access)) {
            return response()->json([
                'message' => 'Unauthorized.',
            ], 403);
        }

        $user = $query->where('users.id', $id)->firstOrFail();

        return response()->json([
            'message' => 'User retrieved successfully',
            'user' => $user,
        ], 200);
    }

    /*
    |--------------------------------------------------------------------------
    | Update User
    |--------------------------------------------------------------------------
    */

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $currentUser = $request->user();

        $access = $this->getUserAccess($currentUser, $user);

        if (!$access['can_update']) {
            return response()->json([
                'message' => 'You are not authorized to update this user.',
            ], 403);
        }

        $allowedFields = $access['allowed_fields'];

        $rules = [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'department_id' => ['sometimes', 'nullable', 'uuid', 'exists:departments,id'],
            'job_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'hire_date' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'salary' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'role' => ['sometimes', Rule::in(['admin', 'hr', 'employee'])],
            'is_supervisor' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'is_head_of_department' => ['sometimes', 'boolean'],
        ];

        // Reject fields this user is not allowed to send (instead of ignoring them).
        $sentFields = array_keys($request->only(array_keys($rules)));
        $forbiddenFields = array_values(array_diff($sentFields, $allowedFields));

        if (!empty($forbiddenFields)) {
            return response()->json([
                'message' => 'You are not allowed to change: ' . implode(', ', $forbiddenFields) . '.',
                'forbidden_fields' => $forbiddenFields,
            ], 403);
        }

        $validated = $request->validate(
            collect($rules)->only($allowedFields)->all()
        );

        $data = collect($validated)
            ->only($allowedFields)
            ->all();

        if (empty($data)) {
            return response()->json([
                'message' => 'No valid fields provided for update.',
            ], 422);
        }

        /*
        |--------------------------------------------------------------------------
        | Supervisor validation
        |--------------------------------------------------------------------------
        */

        $finalRole = $data['role'] ?? $user->role;

        if ($finalRole !== 'hr') {

            if (($data['is_supervisor'] ?? false) === true) {
                return response()->json([
                    'message' => 'Only HR users can be supervisors.',
                ], 422);
            }

            // Role is no longer HR: remove the supervisor flag.
            if ($user->is_supervisor || array_key_exists('is_supervisor', $data)) {
                $data['is_supervisor'] = false;
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Department head validation
        |--------------------------------------------------------------------------
        */

        $isHead = array_key_exists('is_head_of_department', $data)
            ? (bool) $data['is_head_of_department']
            : null;

        unset($data['is_head_of_department']);

        $departmentId = array_key_exists('department_id', $data)
            ? $data['department_id']
            : $user->department_id;

        $isActive = array_key_exists('is_active', $data)
            ? (bool) $data['is_active']
            : ($user->archived_at === null);

        if ($isHead === true && !$departmentId) {
            return response()->json([
                'message' => 'A department is required to assign a department head.',
            ], 422);
        }

        if ($isHead === true && $finalRole !== 'hr') {
            return response()->json([
                'message' => 'Only HR users can be department heads.',
            ], 422);
        }

        if ($isHead === true && !$isActive) {
            return response()->json([
                'message' => 'An archived user cannot be a department head.',
            ], 422);
        }

        /*
        |--------------------------------------------------------------------------
        | Update
        |--------------------------------------------------------------------------
        */

        DB::transaction(function () use ($data, $user, $isHead) {

            $oldDepartmentId = $user->department_id;

            // Convert API is_active into database archived_at.
            if (array_key_exists('is_active', $data)) {

                $data['archived_at'] = $data['is_active']
                    ? null
                    : ($user->archived_at ?? now());

                unset($data['is_active']);
            }

            $user->update($data);

            if ($isHead !== null) {

                // Always clear old head rows of this user first.
                Department::where('head_id', $user->id)
                    ->update(['head_id' => null]);

                if ($isHead) {
                    Department::where('id', $user->department_id)
                        ->update(['head_id' => $user->id]);
                }

            } else {

                // Department changed, role changed, or archived: lose head position.
                if (
                    $oldDepartmentId !== $user->department_id ||
                    $user->role !== 'hr' ||
                    $user->archived_at !== null
                ) {
                    Department::where('head_id', $user->id)
                        ->update(['head_id' => null]);
                }
            }
        });

        return response()->json([
            'message' => 'User updated successfully.',
            'user' => $user->fresh(),
        ], 200);
    }
}