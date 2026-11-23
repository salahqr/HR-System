<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\WebhookController;
use App\Http\Controllers\AttendanceController;
use Illuminate\Support\Facades\Route;

Route::get('/healthz', function () {
    return response()->json(['status' => 'ok']);
});

Route::prefix('auth')->controller(AuthController::class)->group(function () {
    Route::post('/login', 'login');
    Route::post('/refresh', 'refresh');
    Route::post('/forgot-password', 'forgotPassword');
    Route::post('/reset-password', 'resetPassword');

    Route::middleware('jwt')->group(function () {
        Route::post('/logout', 'logout');
    });
});

Route::prefix('user')
    ->controller(UserController::class)
    ->middleware('jwt')
    ->group(function () {
        Route::get('/users', 'getUsers');
        Route::get('/users/{id}', 'getSpecificUser');
        Route::post('/users', 'createUser');

        Route::put('/users/{user}', 'updateUser');
    });

Route::prefix('departments')
    ->controller(DepartmentController::class)
    ->middleware('jwt')
    ->group(function () {
        Route::get('/', 'getDepartment');
        Route::get('/my', 'getMyDepartment');
        Route::get('/{department}', 'getSpecificDepartment');
        Route::post('/', 'createDepartment');
        Route::put('/', 'updateDepartment');
    });


Route::post('/webhooks/faceRecognition', [WebhookController::class, 'faceRecognition'])
    ->middleware('signature');
Route::get('/attendance/recognize', [AttendanceController::class, 'recognize']);



Route::middleware('auth:api')->group(function () {
    Route::get('/attendance/me/today', [AttendanceController::class, 'getMyToday']);
    Route::get('/users/{user}/attendance', [AttendanceController::class, 'getUserAttendance']);

    Route::middleware('role:admin,hr')->group(function () {
        Route::get('/attendance', [AttendanceController::class, 'getAttendance']);
        Route::put('/attendance/{attendance}', [AttendanceController::class, 'updateManual']);
        Route::post('/users/{user}/face-profile', [AttendanceController::class, 'enrollFace']);
    });
});