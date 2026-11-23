<?php

namespace App\Http\Controllers;
use App\Models\{LeaveRequest, User};
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class LeaveRequestController extends Controller
{
    private function isSupervisor(User $u): bool
    {
        return $u->role === 'hr' && $u->is_supervisor;
    }

    private function canDecide(User $actor, User $owner): bool
    {
        if ($actor->id === $owner->id) return false;              // never your own
        if ($this->isSupervisor($actor)) return true;             // employee, hr, admin
        if ($actor->role === 'hr')       return $owner->role === 'employee';
        if ($actor->role === 'admin')    return in_array($owner->role, ['hr', 'employee']);
        return false;
    }

    private function canView(User $actor, User $owner): bool
    {
        return $actor->id === $owner->id || $this->canDecide($actor, $owner);
    }

    // ---------- show ----------

    public function index(Request $request)
    {
        $user = $request->user();
        $q = LeaveRequest::with('user:id,name,role,department_id')->latest();

        if ($user->role === 'employee') {
            $q->where('user_id', $user->id);
        } elseif ($user->role === 'hr' && !$user->is_supervisor) {
            $q->where(fn ($w) => $w->where('user_id', $user->id)
                ->orWhereHas('user', fn ($u) => $u->where('role', 'employee')));
        } elseif ($user->role === 'admin') {
            $q->where(fn ($w) => $w->where('user_id', $user->id)
                ->orWhereHas('user', fn ($u) => $u->whereIn('role', ['hr', 'employee'])));
        }
        // supervisor HR: no filter, sees everything

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        return $q->paginate(15);
    }

    public function show(Request $request, string $id)
    {
        $leave = LeaveRequest::with(['user:id,name,role', 'approver:id,name'])->findOrFail($id);
        abort_unless($this->canView($request->user(), $leave->user), 403);
        return $leave;
    }

    // ---------- create (shares the same helpers) ----------

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $this->validated($request);
        $data['amount'] = $this->calcAmount($user, $data);

        $this->assertValid($user, $data);

        return response()->json(
            LeaveRequest::create($data + ['user_id' => $user->id]), 201
        );
    }

    // ---------- update: owner edits own pending request ----------

    public function update(Request $request, string $id)
    {
        $user  = $request->user();
        $leave = LeaveRequest::findOrFail($id);

        abort_unless($leave->user_id === $user->id, 403);
        abort_unless($leave->status === 'pending', 422, 'Only pending requests can be edited.');

        $data = $this->validated($request);
        $data['amount'] = $this->calcAmount($user, $data);

        $this->assertValid($user, $data, $leave->id);

        $leave->update($data);
        return $leave->fresh();
    }

    // ---------- decide: HR / admin approve or reject ----------

    public function decide(Request $request, string $id)
    {
        $data = $request->validate([
            'status'           => 'required|in:approved,rejected',
            'decision_comment' => 'required_if:status,rejected|nullable|string|max:255',
        ]);

        return DB::transaction(function () use ($request, $id, $data) {
            $leave = LeaveRequest::lockForUpdate()->findOrFail($id);
            $owner = User::lockForUpdate()->findOrFail($leave->user_id);

            abort_unless($this->canDecide($request->user(), $owner), 403);
            abort_unless($leave->status === 'pending', 422, 'Already decided.');

            if ($data['status'] === 'approved') {
                abort_if($this->remaining($owner, $leave->leave_type) < $leave->amount,
                    422, 'Not enough balance.');
                $owner->increment($leave->leave_type . '_used', $leave->amount);
            }

            $leave->update([
                'status'           => $data['status'],
                'approved_by'      => $request->user()->id,
                'decision_comment' => $data['decision_comment'] ?? null,
            ]);

            return $leave->fresh();
        });
    }

    // ---------- cancel: owner only ----------

    public function cancel(Request $request, string $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $leave = LeaveRequest::lockForUpdate()->findOrFail($id);
            abort_unless($leave->user_id === $request->user()->id, 403);

            if ($leave->status === 'approved') {
                abort_unless($leave->start_date->isFuture(), 422, 'Leave already started.');
                User::whereKey($leave->user_id)
                    ->decrement($leave->leave_type . '_used', $leave->amount); // refund
            } else {
                abort_unless($leave->status === 'pending', 422, 'Cannot cancel this request.');
            }

            $leave->update(['status' => 'cancelled']);
            return $leave->fresh();
        });
    }

    // ---------- helpers ----------

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'leave_type' => 'required|in:medical,normal',
            'leave_kind' => 'required|in:full_day,early',
            'start_date' => 'required|date|after_or_equal:today',
            'end_date'   => 'nullable|required_if:leave_kind,full_day|date|after_or_equal:start_date',
            'leave_time' => 'nullable|required_if:leave_kind,early|date_format:H:i',
            'note'       => 'nullable|string|max:255',
        ]);

        if ($data['leave_kind'] === 'early') {
            $data['end_date'] = $data['start_date'];
        } else {
            $data['leave_time'] = null;
        }
        return $data;
    }

    private function calcAmount(User $user, array $d): float
    {
        if ($d['leave_kind'] === 'early') return 0.5;

        $workDays = $user->department?->working_days ?? ['mon', 'tue', 'wed', 'thu', 'fri'];
        $count = 0;
        foreach (CarbonPeriod::create($d['start_date'], $d['end_date']) as $day) {
            if (in_array(strtolower($day->format('D')), $workDays)) $count++;
        }
        return $count;
    }

    private function remaining(User $u, string $type): float
    {
        return $u->{$type . '_allowance'} - $u->{$type . '_used'};
    }

    private function assertValid(User $user, array $d, ?string $ignoreId = null): void
    {
        abort_if($d['amount'] <= 0, 422, 'No working days in that range.');

        $overlap = LeaveRequest::where('user_id', $user->id)
            ->whereIn('status', ['pending', 'approved'])
            ->where('start_date', '<=', $d['end_date'])
            ->where('end_date', '>=', $d['start_date'])
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();
        abort_if($overlap, 422, 'You already have a request in these dates.');

        abort_if($this->remaining($user, $d['leave_type']) < $d['amount'],
            422, 'Not enough balance.');
    }}





    /*
        need to make warnings and strikes :   
            - Cannot approve your own request
            - HR Supervisor can approve everyone
            - Normal HR can approve employees only
            - Admin can approve HR and employees

            warnings => just noreml creat but when make warnings_per_strike it go to strike put have warnings_per_strike read from deparment
                        and  make funcation revoked 
            
            strikes => just noreml creat by make one even if not have strike 
                        and  make funcation revoked  


        Schema::create('strikes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->decimal('amount', 10, 2);
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason')->nullable();
            $table->timestamps();
        });
        
        Schema::create('warnings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->string('reason');
            $table->foreignUuid('issued_by')->constrained('users');
            $table->foreignUuid('strike_id')->nullable()->constrained('strikes');
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason')->nullable();
            $table->timestamps();
        });
    */






    /*
        RULES
            -----
            Approval (applies to any request table: leave, correction, etc.)
            - Cannot approve your own request (requester_id != approver_id)
            - Role levels: employee=1, hr=2, hr_supervisor=3, admin=4
            - HR Supervisor: can approve everyone
            - HR: employees only
            - Admin: HR and employees
            -> put this in a Policy, not in the controller

            Warnings
            - Created normally by HR+
            - When a user's ACTIVE, UNLINKED warnings reach department.warnings_per_strike,
                a strike is created automatically and those warnings are linked to it
            - Can be revoked (who + why)

            Strikes
            - Created automatically from warnings OR manually (no warnings needed)
            - Can be revoked (who + why)
            - Revoking an auto strike: its warnings stay linked and stay "used"
                (change this if you want them to become active again)



        Schema::create('strikes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('issued_by')->nullable()->constrained('users')->nullOnDelete(); // null = auto-generated
            $table->string('reason');
            $table->decimal('penalty_amount', 10, 2)->nullable();   // only if it's a money deduction
            $table->boolean('is_automatic')->default(false);

            $table->timestamp('revoked_at')->nullable();
            $table->foreignUuid('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('revoked_reason')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'revoked_at']);
        });

        Schema::create('warnings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('issued_by')->constrained('users');
            $table->string('reason');
            $table->foreignUuid('strike_id')->nullable()->constrained('strikes')->nullOnDelete();

            $table->timestamp('revoked_at')->nullable();
            $table->foreignUuid('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('revoked_reason')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'strike_id', 'revoked_at']);
        });
        
    */