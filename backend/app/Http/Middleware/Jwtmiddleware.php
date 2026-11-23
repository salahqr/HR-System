<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Exceptions\TokenExpiredException;
use Tymon\JWTAuth\Exceptions\TokenInvalidException;
use Tymon\JWTAuth\Facades\JWTAuth;

class Jwtmiddleware
{
public function handle(Request $request, Closure $next): Response
{
$token = $request->cookie('token');
dump([
    'all_cookies' => $request->cookies->all(),
    'token_cookie' => $request->cookie('token'),
    'has_token' => $request->hasCookie('token'),
]);


dump([
    'cookie_header' => $request->server('HTTP_COOKIE'),
    'cookies' => $request->cookies->all(),
]);

if (!$token) {
    $cookieHeader = $request->headers->get('Cookie', '');

    if (preg_match('/(?:^|;\s*)token=([^;]*)/', $cookieHeader, $matches)) {
        $token = rawurldecode($matches[1]);
    }
}

    try {
        $user = JWTAuth::setToken($token)->authenticate();

    } catch (TokenExpiredException $e) {
        return response()->json(['error' => 'Token expired'], 401);

    } catch (TokenInvalidException $e) {
        return response()->json(['error' => 'Token invalid'], 401);

    } catch (JWTException $e) {
        return response()->json(['error' => 'Token missing'], 401);
    }

    if (!$user || $user->archived_at !== null) {
        return response()->json(['error' => 'User not found'], 401);
    }

    $request->attributes->set('auth_id', $user->id);
    $request->attributes->set('auth_role', $user->role);

    // Makes $request->user() work inside controllers.
    $request->setUserResolver(fn () => $user);

    return $next($request);
}
}