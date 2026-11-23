<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Tymon\JWTAuth\JWTGuard;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;
class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $token = $this->guard()->attempt($credentials + ['archived_at' => null]);

        if (!$token) {
            return response()->json(['message' => 'Email or password is wrong'], 401);
        }

        $minutes = $this->guard()->factory()->getTTL(); 

        return response()
            ->json(["msg"=>"login seccssfull"]) 
            ->cookie('token', $token, $minutes, '/', null, app()->isProduction(), true, false, 'lax');
    }

    public function refresh(): JsonResponse
    {
        try {
            return response()
            ->json(['user' => $this->guard()->user()]) 
            ->cookie('token',$this->tokenResponse($this->guard()->refresh()) , 30, '/', null, app()->isProduction(), true, false, 'lax');
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Cannot refresh'], 401);
        }
    }

    public function logout(): JsonResponse
    {
        return response()->json(['message' => 'Successfully logged out'])->withoutCookie('token');
    }



    public function forgotPassword(Request $request) {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'error' => 'Email not found'
            ], 404);
        }

        $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $code = '';

        for ($i = 0; $i < 6; $i++) {
            $code .= $characters[random_int(0, strlen($characters) - 1)];
        }

        Cache::put(
            'password_reset_' . $user->id,
            Hash::make($code),
            now()->addMinutes(5)
        );
    

        Mail::html(
            "
            <h2>Password Reset</h2>
            <h1>{$code}</h1>
            <p>Your code expires in 5 minutes.</p>
            ",
            function ($message) use ($user) {
                $message->to($user->email)
                        ->subject('code for Password Reset');
            }
        );

        return response()->json([
            'message' => 'code sent to your email'
        ], 200);
    }
 public function resetPassword(Request $request) {
    $request->validate([
        'email' => 'required|email',
        'code' => 'required|string|size:6',
        'password' => 'required|string|min:8',
    ]);

    $user = User::where('email', $request->email)->first();

    if (!$user) {
        return response()->json([
            'error' => 'Invalid reset details'
        ], 400);
    }

    $storedCode = Cache::get('password_reset_' . $user->id);

    if (!$storedCode || !Hash::check($request->code, $storedCode)) {
        return response()->json([
            'error' => 'Invalid or expired code'
        ], 400);
    }

    $user->update([
        'password' => Hash::make($request->password)
    ]);

    Cache::forget('password_reset_' . $user->id);

    return response()->json([
        'message' => 'Password reset successful'
    ], 200);
}

    /** @return JWTGuard */
    private function guard()
    {
        return auth('api');
    }

    private function tokenResponse(string $token): JsonResponse
    {
        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => $this->guard()->factory()->getTTL() * 60,
        ]);
    }
}