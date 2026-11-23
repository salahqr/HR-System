import json
import time
import os
import cv2
import numpy as np
import mysql.connector
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from liveness import check_liveness

YUNET_PATH = "models/face_detection_yunet_2023mar.onnx"
SFACE_PATH = "models/face_recognition_sface_2021dec.onnx"

COSINE_THRESHOLD = 0.363
TIMEOUT_SECONDS = 15 # return to 15 later 
MIN_FACE_WIDTH = 80      # px, rejects faces that are too far from the camera
SHOW_PREVIEW = True      


def get_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )


def init_db():
    db = get_db()
    try:
        cursor = db.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS face_embeddings (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id CHAR(36) NOT NULL UNIQUE,
                embedding JSON NOT NULL
            )
        """)
        db.commit()
        cursor.close()
    finally:
        db.close()


init_db()

app = FastAPI()

detector = cv2.FaceDetectorYN.create(YUNET_PATH, "", (320, 320), score_threshold=0.8)
recognizer = cv2.FaceRecognizerSF.create(SFACE_PATH, "")


def get_face_embedding(frames_needed: int = 1) -> list[float]:
    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        raise HTTPException(status_code=503, detail="Camera not available")

    embeddings = []
    start = time.time()

    try:
        while len(embeddings) < frames_needed:
            if time.time() - start > TIMEOUT_SECONDS:
                raise HTTPException(status_code=408, detail="Could not capture a clear face in time")

            success, frame = camera.read()
            if not success:
                raise HTTPException(status_code=503, detail="Failed to read from camera")

            height, width = frame.shape[:2]
            detector.setInputSize((width, height))
            _, faces = detector.detect(frame)

            if SHOW_PREVIEW:
                display = frame.copy()
                if faces is not None:
                    for face in faces:
                        x, y, w, h = face[:4].astype(int)
                        center = (x + w // 2, y + h // 2)
                        SCALE = 1.2  # 1.0 = exact face box, bigger = larger ellipse
                        axes = (int(w * SCALE / 2), int(h * SCALE / 2))
                        color = (0, 255, 0) if len(faces) == 1 else (0, 0, 255)
                        cv2.ellipse(display, center, axes, 0, 0, 360, color, 2)
                cv2.imshow("Camera", display)
                cv2.waitKey(1)

            if faces is None or len(faces) != 1:
                continue

            face = faces[0]
            if face[2] < MIN_FACE_WIDTH:
                continue

            is_real, live_score = check_liveness(frame, face[:4])   # NEW: 3. is it real?
            if not is_real:                  
                print("not real face ")                        # NEW
                continue                                             

            aligned_face = recognizer.alignCrop(frame, face)
            embedding = recognizer.feature(aligned_face)
            embeddings.append(embedding.flatten())
    finally:
        camera.release()
        if SHOW_PREVIEW:
            cv2.destroyAllWindows()

    mean_embedding = np.mean(embeddings, axis=0)
    return mean_embedding.astype(np.float32).tolist()


def get_user(user_embedding: list[float]) -> tuple[str, float]:
    # shape (1, 128) float32 is what recognizer.match expects
    query = np.array(user_embedding, dtype=np.float32).reshape(1, -1)

    db = get_db()
    try:
        cursor = db.cursor()
        cursor.execute("SELECT user_id, embedding FROM face_embeddings")
        rows = cursor.fetchall()
        cursor.close()
    finally:
        db.close()

    best_user, best_score = None, -1.0

    for user_id, embedding_json in rows:
        saved = np.array(json.loads(embedding_json), dtype=np.float32).reshape(1, -1)
        score = recognizer.match(saved, query, cv2.FaceRecognizerSF_FR_COSINE)
        if score > best_score:
            best_user, best_score = user_id, score

    # threshold is checked ONCE, after we know the best candidate
    if best_user is None or best_score < COSINE_THRESHOLD:
        raise HTTPException(status_code=401, detail="User not recognized")

    return best_user, float(best_score)


class EnrollRequest(BaseModel):
    user_id: str


LARAVEL_URL = "http://127.0.0.1:8000/api"
FACERECOGNITION_WEBHOOK_SECRET = os.getenv(
    "FACERECOGNITION_WEBHOOK_SECRET"
)

# Request model
class EnrollRequest(BaseModel):
    user_id: int


async def call_laravel(endpoint: str, data: dict):

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:

            response = await client.post(
                f"{LARAVEL_URL.rstrip('/')}/{endpoint.lstrip('/')}",
                json=data,
                headers={
                    "X-Signature": FACERECOGNITION_WEBHOOK_SECRET
                }
            )

            response.raise_for_status()

            return response.json()

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Laravel returned status {e.response.status_code}"
        )

    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to Laravel"
        )


# Enroll employee face
@app.post("/enroll")
async def enroll(body: EnrollRequest):

    embedding = get_face_embedding(frames_needed=5)

    db = get_db()

    try:
        cursor = db.cursor()

        cursor.execute(
            """
            INSERT INTO face_embeddings (user_id, embedding)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE embedding = VALUES(embedding)
            """,
            (body.user_id, json.dumps(embedding))
        )

        db.commit()
        cursor.close()

    finally:
        db.close()

    laravel_response = await call_laravel(
        "/webhooks/faceRecognition",
        {
            "user_id": body.user_id,
            "status": "enrolled"
        }
    )

    return {
        "status": "enrolled",
        "user_id": body.user_id,
        "laravel": laravel_response
    }


# Recognize employee and record attendance
@app.post("/recognize")
async def recognize():

    embedding = get_face_embedding(frames_needed=5)

    user_id, score = get_user(embedding)

    if user_id is None:
        return {
            "status": "not_recognized",
            "user_id": None
        }

    laravel_response = await call_laravel(
        "/attendance/recognize",
        {
            "user_id": user_id,
            "recognized_at": datetime.now(timezone.utc).isoformat()
        }
    )

    return {
        "status": "recognized",
        "user_id": user_id,
        "confidence": score,
        "time": time.time(),
        "laravel": laravel_response
    }
