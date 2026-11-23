<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Department;
use App\Models\Attendance;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create or retrieve the department
        $department = DB::table('departments')
            ->where('name', 'Engineering')
            ->first();

        if (!$department) {
            $departmentId = (string) Str::uuid();

            DB::table('departments')->insert([
                'id' => $departmentId,
                'name' => 'Engineering',
                'work_start_time' => '09:00:00',
                'grace_period_minutes' => 15,
                'working_days' => json_encode([
                    'mon', 'tue', 'wed', 'thu', 'sun'
                ]),
                'timezone' => 'Asia/Amman',
                'warnings_per_strike' => 3,
                'strike_amount' => 50.00,
                'face_match_threshold' => 0.363,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            $departmentId = $department->id;
        }

        // 2. Create Admin
        User::updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Test Admin',
                'password' => 'Admin#1234',
                'role' => 'admin',
                'department_id' => null,
                'job_title' => 'System Admin',
                'hire_date' => '2026-01-01',
                'salary' => 2000,
                'must_change_password' => false,
                'archived_at' => null,
            ]
        );

        // 3. Create HR
        $hr = User::updateOrCreate(
            ['email' => 'hr@example.com'],
            [
                'name' => 'Test HR',
                'password' => 'Hr#1234567',
                'role' => 'hr',
                'department_id' => $departmentId,
                'job_title' => 'HR Officer',
                'hire_date' => '2026-02-01',
                'salary' => 1200,
                'must_change_password' => false,
                'archived_at' => null,
            ]
        );

        // 4. Set HR as department head
        DB::table('departments')
            ->where('id', $departmentId)
            ->update([
                'head_id' => $hr->id,
                'updated_at' => now(),
            ]);

        // 5. Create fixed employee
        User::updateOrCreate(
            ['email' => 'employee@example.com'],
            [
                'name' => 'Test Employee',
                'password' => 'Emp#1234567',
                'role' => 'employee',
                'department_id' => $departmentId,
                'job_title' => 'Developer',
                'hire_date' => '2026-03-01',
                'salary' => 900,
                'must_change_password' => true,
                'archived_at' => null,
            ]
        );

        // 6. Create archived employee
        User::updateOrCreate(
            ['email' => 'archived@example.com'],
            [
                'name' => 'Archived User',
                'password' => 'Arch#123456',
                'role' => 'employee',
                'department_id' => $departmentId,
                'job_title' => 'Former Staff',
                'hire_date' => '2025-01-01',
                'salary' => 700,
                'archived_at' => now(),
            ]
        );

        // 7. Generate 25 additional employees
        User::factory()
            ->count(25)
            ->employee()
            ->create([
                'department_id' => $departmentId,
            ]);

        // 8. Generate 5 supervisors
        User::factory()
            ->count(5)
            ->supervisor()
            ->create([
                'department_id' => $departmentId,
            ]);

        // 9. Generate 3 additional HR users
        User::factory()
            ->count(3)
            ->hr()
            ->create([
                'department_id' => $departmentId,
            ]);



        // generate departements
               $departments = [
            'Engineering',
            'Human Resources',
            'Finance',
            'Marketing',
            'Information Technology',
            'Operations',
            'Project Management',
            'Customer Support',
        ];

        foreach ($departments as $name) {
            Department::firstOrCreate(
                ['name' => $name],
                [
                    'work_start_time' => '09:00:00',
                    'grace_period_minutes' => 15,
                    'working_days' => [
                        'mon', 'tue', 'wed', 'thu', 'sun'
                    ],
                    'timezone' => 'Asia/Amman',
                    'warnings_per_strike' => 3,
                    'strike_amount' => 50.00,
                    'face_match_threshold' => 0.363,
                ]
            );
        }


        // create 5 attendance records for each employee
        $employees = User::where('role', 'employee')->get();
        foreach ($employees as $employee) {
            Attendance::factory()
                ->count(5)
                ->create([
                    'user_id' => $employee->id,
                ]);   
        }

    }
}