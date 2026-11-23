<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\FaceRecognitionService;

class WebhookController extends Controller
{
    public function __construct(private FaceRecognitionService $service) {}

    public function faceRecognition(Request $request)
    {
        $result = $this->service->process($request->all());

        return response()->json([
            'message' => $result['message'],
        ], $result['status']);
    }
}
