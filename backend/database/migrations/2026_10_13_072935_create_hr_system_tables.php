<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->foreignUuid('head_id')->nullable();
            $table->time('work_start_time');
            $table->unsignedInteger('grace_period_minutes');
            $table->json('working_days');
            $table->string('timezone');
            $table->unsignedTinyInteger('warnings_per_strike')->default(3);
            $table->decimal('strike_amount', 10, 2)->default(50.00);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password')->nullable();

            $table->enum('role', ['admin', 'hr', 'employee'])
                ->default('employee');

            $table->foreignUuid('department_id')
                ->nullable()
                ->constrained('departments');

            $table->string('job_title')->nullable();
            $table->date('hire_date')->nullable();
            $table->decimal('salary', 10, 2)->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();

            $table->timestamp('face_enrolled_at')->nullable();


            $table->boolean('is_supervisor')->default(false);

            $table->integer('medical_allowance')->nullable()->default(20);
            $table->integer('normal_allowance')->nullable()->default(20);
            $table->integer('medical_used')->nullable()->default(0);
            $table->integer('normal_used')->nullable()->default(0);

            $table->boolean('must_change_password')->default(false);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->foreign('head_id')->references('id')->on('users');
        });

        Schema::create('attendance', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->date('date');
            $table->dateTime('come_in')->nullable();
            $table->dateTime('get_out')->nullable();
            $table->timestamp('last_scan_at')->nullable();
            $table->unsignedInteger('break_minutes')->default(0);


            $table->enum('status', [
                'present', 'late', 'absent', 'on_leave', 'incomplete',
            ]);

            $table->enum('verification_method', ['face', 'manual'])->nullable();
            $table->foreignUuid('edited_by')->nullable()->constrained('users');
            $table->string('edit_reason')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'date']);
        });

        Schema::create('leave_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->enum('leave_type', ['medical', 'normal']);
            $table->enum('leave_kind', ['full_day', 'early']);
            $table->date('start_date');
            $table->date('end_date');
            $table->time('leave_time')->nullable();
            $table->string('note')->nullable();
            $table->decimal('amount', 4, 2); 
            $table->enum('status', [
                'pending', 'approved', 'rejected', 'cancelled',
            ])->default('pending');

            $table->foreignUuid('approved_by')->nullable()->constrained('users');
            $table->string('decision_comment')->nullable();
            $table->timestamps();
        });

        // strikes must exist before warnings (warnings.strike_id)
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

        Schema::create('projects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignUuid('lead_id')->constrained('users');
            $table->date('start_date');
            $table->date('due_date');

            $table->enum('status', [
                'not_started', 'in_progress', 'on_hold',
                'completed', 'cancelled',
            ])->default('not_started');

            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('project_departments', function (Blueprint $table) {
            $table->foreignUuid('project_id')->constrained('projects');
            $table->foreignUuid('department_id')->constrained('departments');

            $table->primary(['project_id', 'department_id']);
        });

        Schema::create('project_members', function (Blueprint $table) {
            $table->foreignUuid('project_id')->constrained('projects');
            $table->foreignUuid('user_id')->constrained('users');

            $table->primary(['project_id', 'user_id']);
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects');
            $table->string('title');
            $table->foreignUuid('assignee_id')->constrained('users');
            $table->date('due_date')->nullable();

            $table->enum('status', ['todo', 'in_progress', 'done'])
                ->default('todo');

            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('project_members');
        Schema::dropIfExists('project_departments');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('warnings');
        Schema::dropIfExists('strikes');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('attendance');
        Schema::dropIfExists('face_profiles');

        Schema::table('departments', function (Blueprint $table) {
            $table->dropForeign(['head_id']);
        });

        Schema::dropIfExists('users');
        Schema::dropIfExists('departments');
    }
};