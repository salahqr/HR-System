<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, HasUuids;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'department_id',
        'job_title',
        'hire_date',
        'salary',
        'phone',
        'address',
        'medical_allowance',
        'normal_allowance',
        'is_supervisor',
        'archived_at',
        'must_change_password',
        'face_enrolled_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'salary' => 'decimal:2',
            'hire_date' => 'date',
            'archived_at' => 'datetime',
            'password' => 'hashed', // hashes on assignment: never call Hash::make yourself
            'must_change_password' => 'boolean',
        ];
    }


// User belongs to a department
public function department(): BelongsTo
{
    return $this->belongsTo(Department::class, 'department_id');
}

// User may be the head of a department
public function headedDepartment(): HasOne
{
    return $this->hasOne(Department::class, 'head_id');
}

    // The token's "sub" claim = the user's UUID
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    // Extra claims inside the token
    public function getJWTCustomClaims()
    {
        return ['role' => $this->role];
    }

    public function attendance()
    {
        return $this->hasMany(Attendance::class);
    }
}