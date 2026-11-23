<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyWebhookSignature
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
       $signature = $request->header('X-Signature');

        if (! $signature) {
            abort(403, 'Missing signature');
        }

        $expected = hash_hmac(
            'sha256',
            $request->getContent(), 
            config('services.face.secret')
        );

        if (! hash_equals($expected, $signature)) {
            abort(403, 'Invalid signature');
        }

        return $next($request);  
    }
}
