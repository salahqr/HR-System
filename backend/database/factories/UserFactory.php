<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    protected static ?string $password = null;

    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('Password#123'),

            'role' => 'employee',
            'department_id' => null,

            'job_title' => fake()->randomElement([
                'Software Developer',
                'Backend Developer',
                'Frontend Developer',
                'UI/UX Designer',
                'Project Manager',
                'Accountant',
                'HR Specialist',
                'Marketing Specialist',
                'QA Engineer',
                'System Administrator',
            ]),

            'hire_date' => fake()->dateTimeBetween('-5 years', 'now')->format('Y-m-d'),
            'salary' => fake()->numberBetween(500, 2000),

            'phone' => fake()->numerify('079#######'),
            'address' => fake()->address(),

            'is_supervisor' => false,

            'medical_allowance' => 40,
            'normal_allowance' => 40,
            'medical_used' => 0,
            'normal_used' => 0,

            'must_change_password' => false,
            'archived_at' => null,
        ];
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'admin',
            'department_id' => null,
            'job_title' => 'System Administrator',
            'salary' => 2000,
        ]);
    }

    public function hr(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'hr',
            'job_title' => 'HR Officer',
            'salary' => 1200,
        ]);
    }

    public function employee(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'employee',
        ]);
    }

    public function supervisor(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'employee',
            'is_supervisor' => true,
        ]);
    }

    public function archived(): static
    {
        return $this->state(fn (array $attributes) => [
            'archived_at' => now(),
        ]);
    }

    public function mustChangePassword(): static
    {
        return $this->state(fn (array $attributes) => [
            'must_change_password' => true,
        ]);
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}