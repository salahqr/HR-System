<?php

namespace Database\Factories;

use App\Models\Attendance;
use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\User;

/**
 * @extends Factory<Attendance>
 */
class AttendanceFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'date' => $this->faker->date(),
            'come_in' => $this->faker->dateTimeThisMonth(),
            'get_out' => $this->faker->dateTimeThisMonth(),
            'status' => $this->faker->randomElement(['present', 'late', 'absent', 'on_leave', 'holiday']),
            'verification_method' => $this->faker->randomElement(['face', 'manual']),
            'edited_by' => User::factory(),
            'edit_reason' => $this->faker->sentence(),
        ];
    }
}
