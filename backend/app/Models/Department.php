<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'head_id',
        'work_start_time',
        'grace_period_minutes',
        'working_days',
        'timezone',
        'warnings_per_strike',
        'strike_amount',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'working_days' => 'array',
            'grace_period_minutes' => 'integer',
            'warnings_per_strike' => 'integer',
            'strike_amount' => 'decimal:2',
            'archived_at' => 'datetime',
        ];
    }

    public function head(): BelongsTo
    {
        return $this->belongsTo(User::class, 'head_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'department_id');
    }
}