<?php

return [

    'admin' => [],  

    'hr' => [],

    'employee' => [],

    'update_fields' => [
        'admin'    => ['name', 'email', 'role', 'job_title', 'hire_date', 'salary', 'phone', 'address'],
        'hr'       => ['name', 'job_title', 'hire_date', 'salary', 'phone', 'address'],
        'employee' => ['phone', 'address'],
    ],
];

/*
example make insde parmaion

'profile.view',
'profile.edit',
'attendance.checkin',

*/