<?php

namespace Database\Factories;

use App\Models\Department;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Department>
 */
class DepartmentFactory extends Factory
{
    protected $model = Department::class;

    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'name' => fake()->unique()->company() . ' Department',
            'head_id' => null,
            'work_start_time' => '09:00:00',
            'grace_period_minutes' => 15,
            'working_days' => [
                'mon', 'tue', 'wed', 'thu', 'sun'
            ],
            'timezone' => 'Asia/Amman',
            'warnings_per_strike' => 3,
            'strike_amount' => 50.00,
            'face_match_threshold' => 0.363,
            'archived_at' => null,
        ];
    }

    public function archived(): static
    {
        return $this->state(fn (array $attributes) => [
            'archived_at' => now(),
        ]);
    }
}