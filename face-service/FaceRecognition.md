# Face Recognition

## Models we use

| Name | What it does | License |
|---|---|---|
| YuNet | Finds the face in the camera | MIT |
| SFace | Knows who the face is | Apache 2.0 |
| OpenCV | Runs both models | Apache 2.0 |

Source: https://github.com/opencv/opencv_zoo

Keep the license files of the models in the `models/` folder.

## How it works

1. The camera takes a picture.
2. YuNet finds one face.
3. SFace turns the face into 128 numbers (an embedding).
4. Enroll: we save the average of 5 frames.
5. Check-in: we compare with saved faces. If the score is 0.363 or more, it is a match.

## Face data

- We save only the numbers and the user id. We do not save photos.
- The numbers are saved in the Python service database, not in Laravel.
- Only the Laravel backend can call the face service.
- Keep a manual check-in in case the camera does not recognize someone.

## Limits

- A photo of a person can trick it (no liveness check yet).
- Test with your own camera and users to find the best threshold.