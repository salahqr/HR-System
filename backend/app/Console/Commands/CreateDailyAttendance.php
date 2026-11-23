<?php

namespace App\Console\Commands;

use App\Models\Department;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateDailyAttendance extends Command
{
    protected $signature = 'attendance:create-daily';
    protected $description = 'Insert today attendance rows for employees of working departments';

    public function handle()
    {
        $today = now();
        $date  = $today->toDateString();
        $day   = strtolower($today->format('D')); // mon, tue, wed...

        $departments = Department::whereNull('archived_at')
            ->whereJsonContains('work_days', $day)
            ->pluck('id');

        $onLeave = LeaveRequest::where('status', 'approved')
            ->where('leave_kind', 'full_day')
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->pluck('user_id')
            ->flip();

        User::whereIn('department_id', $departments)
            ->whereNull('archived_at')
            ->chunkById(500, function ($users) use ($date, $onLeave) {
                $rows = $users->map(fn ($u) => [
                    'id'         => (string) Str::uuid(),
                    'user_id'    => $u->id,
                    'date'       => $date,
                    'status'     => isset($onLeave[$u->id]) ? 'on_leave' : 'absent',
                    'created_at' => now(),
                    'updated_at' => now(),
                ])->all();

                DB::table('attendance')->insertOrIgnore($rows);
            });

        $this->info('Done');
    }
}