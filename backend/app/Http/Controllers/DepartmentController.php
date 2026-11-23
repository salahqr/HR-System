<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    /**
     * GET /departments
     * Admin and HR: list departments with pagination and filters.
     * ?all=1 returns every active department (id, name) without pagination,
     * for dropdown lists.
     */
    public function getDepartment(Request $request)
    {
        $this->authorizeRoles($request, ['admin', 'hr']);

        $request->validate([
            'name' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'nullable', 'in:active,archived,all'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        if ($request->boolean('all')) {
            return response()->json(
                Department::query()
                    ->whereNull('archived_at')
                    ->orderBy('name')
                    ->get(['id', 'name'])
            );
        }

        $query = Department::query()
            ->with('head:id,name')
            ->withCount('users');

        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->name . '%');
        }

        // Default: active departments only.
        $status = $request->input('status') ?: 'active';

        if ($status === 'active') {
            $query->whereNull('archived_at');
        } elseif ($status === 'archived') {
            $query->whereNotNull('archived_at');
        }

        return response()->json(
            $query->paginate($request->integer('per_page', 10))->withQueryString()
        );
    }

    public function getSpecificDepartment(
        Request $request,
        Department $department
    ) {
        $this->authorizeRoles($request, ['admin', 'hr']);

        $department->load('head:id,name');
        $department->loadCount('users');

        return response()->json($department);
    }

    public function getMyDepartment(Request $request)
    {
        $user = $request->user();

        abort_unless($user, 401, 'Unauthenticated.');

        $department = $user->department()
            ->with('head:id,name')
            ->first();

        if (!$department) {
            return response()->json([
                'message' => 'You are not assigned to a department.'
            ], 404);
        }

        // warnings_per_strike / strike_amount are company-wide static values
        // set by the Admin, so they are not returned from here anymore.
        return response()->json([
            'name' => $department->name,
            'head_name' => $department->head?->name,
            'work_start_time' => $department->work_start_time,
            'grace_period_minutes' => $department->grace_period_minutes,
            'working_days' => $department->working_days,
        ]);
    }

    public function createDepartment(Request $request)
    {
        $this->authorizeRoles($request, ['admin']);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:departments,name'],

            'head_id' => [
                'nullable',
                'uuid',
                Rule::exists('users', 'id')
                    ->where('role', 'hr')
                    ->whereNull('archived_at'),
            ],

            'work_start_time' => ['required', 'date_format:H:i'],
            'grace_period_minutes' => ['required', 'integer', 'min:0'],

            'working_days' => ['required', 'array', 'min:1'],
            'working_days.*' => ['string', Rule::in($this->weekDays())],

            'timezone' => ['required', 'timezone'],
        ]);

        // Same head rule as update: an active HR member.
        // On create the department has no members yet, so the HR must be unassigned.
        if (!empty($validated['head_id'])) {
            $head = User::findOrFail($validated['head_id']);

            if ($head->department_id !== null) {
                return response()->json([
                    'message' => 'The selected HR already belongs to another department.',
                ], 422);
            }
        }

        $department = DB::transaction(function () use ($validated) {
            $department = Department::create($validated);

            if (!empty($validated['head_id'])) {
                User::where('id', $validated['head_id'])
                    ->update(['department_id' => $department->id]);
            }

            return $department;
        });

        return response()->json([
            'message' => 'Department created successfully.',
            'department' => $department->load('head:id,name'),
        ], 201);
    }

    public function updateDepartment(
        Request $request,
        Department $department
    ) {
        $user = $request->user();

        abort_unless($user, 401, 'Unauthenticated.');

        $isAdmin = $user->role === 'admin';
        $isHR = $user->role === 'hr';

        abort_unless($isAdmin || $isHR, 403, 'Forbidden.');

        // Admin: everything. Any HR (normal or supervisor): only who the head is.
        if ($isAdmin) {
            $allowedFields = [
                'name',
                'head_id',
                'work_start_time',
                'grace_period_minutes',
                'working_days',
                'timezone',
                'is_active',
            ];
        } else {
            $allowedFields = ['head_id'];
        }

        $rules = [
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('departments', 'name')->ignore($department->id),
            ],

            'head_id' => [
                'sometimes',
                'nullable',
                'uuid',
                Rule::exists('users', 'id')
                    ->where('role', 'hr')
                    ->whereNull('archived_at'),
            ],

            'work_start_time' => ['sometimes', 'date_format:H:i'],
            'grace_period_minutes' => ['sometimes', 'integer', 'min:0'],

            'working_days' => ['sometimes', 'array', 'min:1'],
            'working_days.*' => ['string', Rule::in($this->weekDays())],

            'timezone' => ['sometimes', 'timezone'],

            'is_active' => ['sometimes', 'boolean'],
        ];

        // Reject fields this role is not allowed to send.
        $sentFields = array_keys($request->only(array_keys($rules)));
        $forbiddenFields = array_values(array_diff($sentFields, $allowedFields));

        if (!empty($forbiddenFields)) {
            return response()->json([
                'message' => 'You are not allowed to change: ' . implode(', ', $forbiddenFields) . '.',
                'forbidden_fields' => $forbiddenFields,
            ], 403);
        }

        $validated = $request->validate(
            array_intersect_key($rules, array_flip($allowedFields))
        );

        // The head must be an active HR member of THIS department.
        if (!empty($validated['head_id'])) {
            $head = User::findOrFail($validated['head_id']);

            if ($head->department_id !== $department->id) {
                return response()->json([
                    'message' => 'The department head must be an HR member assigned to this department.',
                ], 422);
            }
        }

        // Archiving rules.
        $archiving = array_key_exists('is_active', $validated)
            && $validated['is_active'] === false
            && $department->archived_at === null;

        if ($archiving) {
            $activeUsers = $department->users()
                ->whereNull('archived_at')
                ->count();

            if ($activeUsers > 0) {
                return response()->json([
                    'message' => 'Move or archive the active users of this department before archiving it.',
                ], 422);
            }
        }

        DB::transaction(function () use ($department, $validated, $archiving) {

            if (array_key_exists('is_active', $validated)) {
                $department->archived_at = $validated['is_active']
                    ? null
                    : ($department->archived_at ?? now());

                unset($validated['is_active']);
            }

            // An archived department has no head.
            if ($archiving) {
                $validated['head_id'] = null;
            }

            $department->fill($validated);
            $department->save();
        });

        return response()->json([
            'message' => 'Department updated successfully.',
            'department' => $department->fresh()->load('head:id,name'),
        ]);
    }

    private function weekDays(): array
    {
        return [
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
        ];
    }

    private function authorizeRoles(
        Request $request,
        array $roles
    ): void {
        $user = $request->user();

        abort_unless($user, 401, 'Unauthenticated.');

        abort_unless(
            in_array($user->role, $roles, true),
            403,
            'You do not have permission to perform this action.'
        );
    }
}