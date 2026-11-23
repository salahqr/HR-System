<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attendance extends Model {
    protected $fillable = [
        'user_id',
        'date',
        'come_in',
        'get_out',
        'status',
        'verification_method',
        'edited_by',
        'edit_reason',
        'last_scan_at',
        'break_minutes',
    ];

    protected $casts = [
        'date' => 'date',
        'come_in' => 'datetime',
        'get_out' => 'datetime',
    ];

    public function user() {
        return $this->belongsTo(User::class);
    }
}