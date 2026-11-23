<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $role = $request->attributes->get('auth_role');

        if (!$role || !is_string($role)) {
            return response()->json([
                'error' => 'Unauthenticated.',
            ], 401);
        }

        $allowed = config("roles.{$role}");

        if ($allowed === null) {
            return response()->json([
                'error' => 'Invalid user role.',
            ], 403);
        }

        $permission = $request->route()?->getName();

        if (!$permission) {
            return response()->json([
                'error' => 'Route does not have a permission name.',
            ], 403);
        }

        if ($allowed === '*' || (
            is_array($allowed) &&
            in_array($permission, $allowed, true)
        )) {
            return $next($request);
        }

        return response()->json([
            'error' => "You don't have permission to access this resource.",
        ], 403);
    }
}
