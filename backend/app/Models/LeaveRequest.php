<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeaveRequest extends Model
{
    protected $fillable = [
        'user_id',
        'leave_type',
        'leave_kind',
        'start_date',
        'end_date',
        'amount',
        'note',
        'status',
        'approved_by',
        'decision_comment',
    ];
    /** @use HasFactory<\Database\Factories\LeaveRequestFactory> */
    use HasFactory;
}

