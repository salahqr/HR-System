<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    private const STATUSES = ['present', 'late', 'absent', 'on_leave', 'incomplete'];

    private function canView(User $current, User $target): bool
    {
        if ($current->id === $target->id) {
            return true;
        }

        return match ($current->role) {
            'admin' => true,
            'hr' => $current->is_supervisor || $target->role === 'employee',
            default => false,
        };
    }

    private function canManage(User $current, User $target): bool
    {
        return match ($current->role) {
            'admin' => $target->role !== 'admin',
            'hr' => $current->is_supervisor || $target->role === 'employee',
            default => false,
        };
    }

    private function applyScope($query, User $current)
    {
        if ($current->role === 'employee') {
            return $query->where('attendance.user_id', $current->id);
        }

        if ($current->role === 'hr' && !$current->is_supervisor) {
            return $query->where(function ($q) use ($current) {
                $q->where('attendance.user_id', $current->id)
                    ->orWhereHas('user', fn($u) => $u->where('role', 'employee'));
            });
        }

        return $query; 
    }

    private function statusForCheckIn(Department $department, Carbon $when): string
    {
        $tz = $department->timezone;
        $localDate = $when->copy()->setTimezone($tz)->toDateString();

        $limit = Carbon::parse($localDate . ' ' . $department->work_start_time, $tz)
            ->addMinutes((int) $department->grace_period_minutes);

        return $when->greaterThan($limit) ? 'late' : 'present';
    }


    public function getAttendance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'userId' => ['sometimes', 'nullable', 'uuid', 'exists:users,id'],
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'date' => ['sometimes', 'nullable', 'date'],
            'from' => ['sometimes', 'nullable', 'date'],
            'to' => ['sometimes', 'nullable', 'date', 'after_or_equal:from'],
            'status' => ['sometimes', 'nullable', Rule::in(self::STATUSES)],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Attendance::query()->with('user:id,name,department_id');

        $this->applyScope($query, $request->user());

        $attendances = $query
            ->when($validated['userId'] ?? null, fn($q, $id) => $q->where('attendance.user_id', $id))
            ->when($validated['name'] ?? null, fn($q, $name) =>
                $q->whereHas('user', fn($u) => $u->where('name', 'LIKE', "%{$name}%"))
            )
            ->when($validated['date'] ?? null, fn($q, $date) => $q->whereDate('attendance.date', $date))
            ->when($validated['from'] ?? null, fn($q, $from) => $q->whereDate('attendance.date', '>=', $from))
            ->when($validated['to'] ?? null, fn($q, $to) => $q->whereDate('attendance.date', '<=', $to))
            ->when($validated['status'] ?? null, fn($q, $status) => $q->where('attendance.status', $status))
            ->orderByDesc('attendance.date')
            ->paginate($validated['per_page'] ?? 10)
            ->withQueryString();

        return response()->json($attendances);
    }

    public function getUserAttendance(Request $request, User $user): JsonResponse
    {
        if (!$this->canView($request->user(), $user)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'month' => ['sometimes', 'nullable', 'date_format:Y-m'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $base = Attendance::where('user_id', $user->id);

        if (!empty($validated['month'])) {
            $start = Carbon::createFromFormat('Y-m', $validated['month'])->startOfMonth();
            $base->whereBetween('date', [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()]);
        }

        $counts = (clone $base)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $minutes = (clone $base)
            ->whereNotNull('come_in')
            ->whereNotNull('get_out')
            ->selectRaw('COALESCE(SUM(TIMESTAMPDIFF(MINUTE, come_in, get_out)), 0) as span, COALESCE(SUM(break_minutes), 0) as breaks')
            ->first();

        return response()->json([
            'summary' => [
                'days' => $counts,
                'break_minutes' => (int) $minutes->breaks,
                'worked_minutes' => max(0, (int) $minutes->span - (int) $minutes->breaks),
            ],
            'attendance' => $base->orderByDesc('date')
                ->paginate($validated['per_page'] ?? 10)
                ->withQueryString(),
        ]);
    }

    public function getMyToday(Request $request): JsonResponse
    {
        $user = $request->user();
        $department = $user->department;

        if (!$department) {
            return response()->json(['message' => 'You are not assigned to a department.'], 404);
        }

        $today = Carbon::now('UTC')->setTimezone($department->timezone)->toDateString();

        $row = Attendance::where('user_id', $user->id)->whereDate('date', $today)->first();

        return response()->json(['date' => $today, 'attendance' => $row]);
    }


    public function enrollFace(Request $request, User $user): JsonResponse
    {
        $current = $request->user();

        if (!($current->id === $user->id || $this->canManage($current, $user))) {
            return response()->json(['message' => 'You are not authorized to enroll this user.'], 403);
        }

        if ($user->archived_at !== null) {
            return response()->json(['message' => 'An archived user cannot be enrolled.'], 422);
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders(['X-Face-Secret' => config('services.face.secret')])
                ->post(config('services.face.url') . '/enroll', ['user_id' => $user->id]);
        } catch (ConnectionException $e) {
            return response()->json(['message' => 'The face recognition service is not reachable.'], 503);
        }

        if (!$response->successful()) {
            return response()->json([
                'message' => $response->json('message') ?? 'Could not start enrollment.',
            ], 422);
        }

        return response()->json(['message' => 'Enrollment started.'], 202);
    }


    public function recognize(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'uuid'],
        ]);

        $user = User::with('department')->find($validated['user_id']);

        if (!$user || $user->archived_at !== null || !$user->department) {
            return response()->json(['result' => 'ignored', 'reason' => 'unknown, archived or no department']);
        }

        $department = $user->department;
        $now = Carbon::now('UTC');
        $local = $now->copy()->setTimezone($department->timezone);

        $workingDays = array_map('strtolower', $department->working_days ?? []);

        if (!in_array(strtolower($local->englishDayOfWeek), $workingDays, true)) {
            return response()->json(['result' => 'ignored', 'reason' => 'not a working day']);
        }

        $result = DB::transaction(function () use ($user, $department, $now, $local) {

            // Lock the row so two quick scans cannot both change it.
            $attendance = Attendance::where('user_id', $user->id)
                ->whereDate('date', $local->toDateString())
                ->lockForUpdate()
                ->first();

            if (!$attendance) {
                // The scheduled job missed this user: create the row now.
                $attendance = Attendance::create([
                    'user_id' => $user->id,
                    'date' => $local->toDateString(),
                    'status' => 'absent',
                ]);
            }

            if ($attendance->status === 'on_leave') {
                return 'ignored: user is on leave';
            }

            // Same person seen again within a minute: ignore.
            if (
                $attendance->last_scan_at &&
                abs($attendance->last_scan_at->diffInSeconds($now)) < 60
            ) {
                return 'ignored: duplicate scan';
            }

            if ($attendance->come_in === null) {
                $attendance->come_in = $now;
                $attendance->status = $this->statusForCheckIn($department, $now);
                $action = 'check_in';

            } elseif ($attendance->get_out === null) {
                $attendance->get_out = $now;
                $action = 'check_out';

            } else {
                // Was out, seen again: the gap is a break.
                $attendance->break_minutes += (int) $attendance->get_out->diffInMinutes($now);
                $attendance->get_out = null;
                $action = 'back_from_break';
            }

            $attendance->verification_method = 'face';
            $attendance->last_scan_at = $now;
            $attendance->save();

            return $action;
        });

        return response()->json([
            'result' => $result,
            'user' => ['id' => $user->id, 'name' => $user->name],
        ]);
    }


    public function updateManual(Request $request, Attendance $attendance): JsonResponse
    {
        $current = $request->user();
        $target = $attendance->user()->with('department')->first();

        if ($current->id === $target->id) {
            return response()->json(['message' => 'You cannot edit your own attendance.'], 403);
        }

        if (!$this->canManage($current, $target)) {
            return response()->json(['message' => 'You are not authorized to edit this attendance.'], 403);
        }

        $validated = $request->validate([
            'come_in' => ['sometimes', 'nullable', 'date'],
            'get_out' => ['sometimes', 'nullable', 'date'],
            'break_minutes' => ['sometimes', 'integer', 'min:0', 'max:1440'],
            'status' => ['sometimes', Rule::in(self::STATUSES)],
            'edit_reason' => ['required', 'string', 'min:3', 'max:255'],
        ]);

        $department = $target->department;

        if (!$department) {
            return response()->json(['message' => 'This user has no department.'], 422);
        }

        $tz = $department->timezone;
        $rowDate = $attendance->date->toDateString();

        // Times are sent in the department's local time (or with an offset) and saved in UTC.
        $parse = fn($value) => $value ? Carbon::parse($value, $tz)->utc() : null;

        $comeIn = array_key_exists('come_in', $validated) ? $parse($validated['come_in']) : $attendance->come_in;
        $getOut = array_key_exists('get_out', $validated) ? $parse($validated['get_out']) : $attendance->get_out;

        if ($getOut && !$comeIn) {
            return response()->json(['message' => 'Check-out needs a check-in.'], 422);
        }

        if ($comeIn && $getOut && $getOut->lessThanOrEqualTo($comeIn)) {
            return response()->json(['message' => 'Check-out must be after check-in.'], 422);
        }

        foreach ([$comeIn, $getOut] as $time) {
            if ($time && $time->copy()->setTimezone($tz)->toDateString() !== $rowDate) {
                return response()->json(['message' => 'Times must be on the same date as the attendance row.'], 422);
            }
        }

        $data = [
            'come_in' => $comeIn,
            'get_out' => $getOut,
            'verification_method' => 'manual',
            'edited_by' => $current->id,
            'edit_reason' => $validated['edit_reason'],
        ];

        if (array_key_exists('break_minutes', $validated)) {
            $data['break_minutes'] = $validated['break_minutes'];
        }

        if (array_key_exists('status', $validated)) {
            $data['status'] = $validated['status'];
        } elseif (array_key_exists('come_in', $validated) && $comeIn) {
            // Check-in time changed: work out late/present again.
            $data['status'] = $this->statusForCheckIn($department, $comeIn);
        }

        $attendance->update($data);

        return response()->json([
            'message' => 'Attendance updated successfully.',
            'attendance' => $attendance->fresh(),
        ]);
    }
}