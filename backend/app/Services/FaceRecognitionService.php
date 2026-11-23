<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class FaceRecognitionService
{
    public function process(array $payload): array
    {
        $data = Validator::make($payload, [
            'status' => [
                'required',
                'string',
                'in:recognition.enrolled,recognition.failed'
            ],
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ])->validate();

        $user = User::findOrFail($data['user_id']);

        return match ($data['status']) {
            'recognition.enrolled' => $this->handleSuccess($user),
            'recognition.failed' => $this->handleFailed(),
        };
    }

    private function handleSuccess(User $user): array
    {
        $user->update([
            'face_enrolled_at' => now(),
        ]);

        return [
            'message' => 'Face enrolled successfully',
            'status' => 200,
        ];
    }

    private function handleFailed(): array
    {
        return [
            'message' => 'Please adjust your face position inside the oval to get better results next time.',
            'status' => 200,
        ];
    }
}
