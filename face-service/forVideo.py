"""
Video Shorts API (FastAPI + Postman)

Two endpoints only:

1) POST /enroll      body: {"name": "Ahmad"}
   Opens the camera, takes 5 good frames, makes the embedding, saves it with the name.
   Use it one time for every person.

2) POST /recognize   (no body)
   Starts the camera and it NEVER stops. Every face in the frame gets a rectangle
   with the person's NAME. Photos / screens get "Not Human".
   Postman gets the answer right away, the camera keeps running in the background.

Run the server (do NOT use --reload):
    uvicorn shorts_api:app --host 127.0.0.1 --port 8000

Stop everything: press Ctrl+C in the server terminal.
In the video window: press R to start / stop recording a short (saved in shorts/).
"""
import json
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

import cv2
import mysql.connector
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

from ttt import check_liveness

# ---------------- Settings ----------------
YUNET_PATH = "models/face_detection_yunet_2023mar.onnx"
SFACE_PATH = "models/face_recognition_sface_2021dec.onnx"

COSINE_THRESHOLD = 0.363
ENROLL_TIMEOUT = 20          # seconds to capture a good face when enrolling
MIN_FACE_WIDTH = 60          # px, ignore tiny / far faces
RECOGNIZE_EVERY = 3          # recognize every N frames (faster video)

VERTICAL_SHORTS = True       # True = 9:16 video for shorts, False = full camera frame
OUT_W, OUT_H = 720, 1280     # size used when VERTICAL_SHORTS = True
FPS = 30
MIRROR = True                # selfie view (text still reads correctly)
OUTPUT_DIR = "shorts"

BOX_COLOR = (181, 119, 0)    # LinkedIn blue (BGR)
UNKNOWN_COLOR = (60, 60, 220)
TEXT_COLOR = (255, 255, 255)
FAKE_LABEL = "Not Human"     # shown when a photo / screen is held to the camera
WINDOW = "Shorts Recorder"


# ---------------- Database ----------------
def get_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
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
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'face_embeddings'
              AND COLUMN_NAME = 'name'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("ALTER TABLE face_embeddings ADD COLUMN name VARCHAR(100) NULL")
        db.commit()
        cursor.close()
    finally:
        db.close()


def load_known_faces():
    """Returns (names, embeddings)."""
    db = get_db()
    try:
        cursor = db.cursor()
        cursor.execute("SELECT name, embedding FROM face_embeddings")
        rows = cursor.fetchall()
        cursor.close()
    finally:
        db.close()

    names, embeddings = [], []
    for name, emb_json in rows:
        names.append(name or "Unknown")
        embeddings.append(np.array(json.loads(emb_json), dtype=np.float32).reshape(1, -1))
    return names, embeddings


init_db()

# ---------------- Models ----------------
detector = cv2.FaceDetectorYN.create(YUNET_PATH, "", (320, 320), score_threshold=0.8)
recognizer = cv2.FaceRecognizerSF.create(SFACE_PATH, "")

# ---------------- Camera loop state ----------------
lock = threading.Lock()
stop_event = threading.Event()
worker: threading.Thread | None = None
_warned = set()


def warn_once(message: str):
    if message not in _warned:
        _warned.add(message)
        print(f"[Warning] {message}")


# ---------------- Helpers ----------------
def prepare(raw):
    """Crop to vertical 9:16 (optional) and mirror."""
    frame = raw
    if VERTICAL_SHORTS:
        h, w = frame.shape[:2]
        target = OUT_W / OUT_H
        if w / h > target:
            new_w = int(h * target)
            x0 = (w - new_w) // 2
            frame = frame[:, x0:x0 + new_w]
        else:
            new_h = int(w / target)
            y0 = (h - new_h) // 2
            frame = frame[y0:y0 + new_h, :]
        frame = cv2.resize(frame, (OUT_W, OUT_H))
    if MIRROR:
        frame = cv2.flip(frame, 1)
    return frame


def detect_faces(frame):
    detector.setInputSize((frame.shape[1], frame.shape[0]))
    _, faces = detector.detect(frame)
    if faces is None:
        return []
    return [f for f in faces if f[2] >= MIN_FACE_WIDTH]


def is_real_face(frame, face) -> bool:
    try:
        is_real, score = check_liveness(frame, face[:4])
        print(f"Liveness: {score:.3f}, accepted: {is_real}")
        return bool(is_real)
    except Exception as e:
        warn_once(f"Liveness check failed; rejecting frame: {e}")
        return False


def identify(frame, face, names, embeddings) -> str:
    """Best matching name, 'Unknown', or FAKE_LABEL for photos / screens."""
    if not is_real_face(frame, face):
        return FAKE_LABEL
    if not embeddings:
        return "Unknown"

    aligned = recognizer.alignCrop(frame, face)
    query = recognizer.feature(aligned).astype(np.float32).reshape(1, -1)

    best_name, best_score = "Unknown", -1.0
    for name, saved in zip(names, embeddings):
        score = recognizer.match(saved, query, cv2.FaceRecognizerSF_FR_COSINE)
        if score > best_score:
            best_name, best_score = name, score
    return best_name if best_score >= COSINE_THRESHOLD else "Unknown"


def draw_face_label(frame, face, name):
    x, y, w, h = face[:4].astype(int)
    color = UNKNOWN_COLOR if name in ("Unknown", FAKE_LABEL) else BOX_COLOR

    cv2.rectangle(frame, (x, y), (x + w, y + h), color, 3)

    font = cv2.FONT_HERSHEY_DUPLEX
    scale, thick, pad = 1.0, 2, 10
    (tw, th), base = cv2.getTextSize(name, font, scale, thick)
    label_h = th + base + pad * 2
    ly1 = max(0, y - label_h)
    ly2 = ly1 + label_h
    lx1 = max(0, min(x, frame.shape[1] - tw - pad * 2))
    lx2 = lx1 + tw + pad * 2

    cv2.rectangle(frame, (lx1, ly1), (lx2, ly2), color, -1)
    cv2.putText(frame, name, (lx1 + pad, ly2 - base - pad), font, scale,
                TEXT_COLOR, thick, cv2.LINE_AA)


def open_camera():
    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        return None
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    return camera


# ---------------- The camera that never stops ----------------
def camera_loop(names, embeddings, startup):
    camera = open_camera()
    if camera is None:
        startup["error"] = "Camera not available"
        startup["ready"].set()
        return
    startup["ready"].set()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL)

    writer = None
    rec_start = 0.0
    frame_count = 0
    read_fails = 0
    last_seen = None
    current_labels = []      # list of (face, name), reused between recognition runs

    print("Camera is on. It never stops. Press Ctrl+C in the server terminal to stop.")

    try:
        while not stop_event.is_set():
            ok, raw = camera.read()
            if not ok:
                read_fails += 1
                cv2.waitKey(20)
                if read_fails % 100 == 0:
                    print("Camera not sending frames, reopening it...")
                    camera.release()
                    time.sleep(1)
                    camera = open_camera() or cv2.VideoCapture(0)
                continue
            read_fails = 0

            frame = prepare(raw)

            # any error here only prints a warning, the camera keeps going
            try:
                faces = detect_faces(frame)

                if frame_count % RECOGNIZE_EVERY == 0:
                    current_labels = [(f, identify(frame, f, names, embeddings)) for f in faces]
                else:
                    current_labels = [
                        (f, current_labels[i][1] if i < len(current_labels) else "Unknown")
                        for i, f in enumerate(faces)
                    ]

                for face, name in current_labels:
                    draw_face_label(frame, face, name)

                seen = sorted(name for _, name in current_labels)
                if seen != last_seen:
                    last_seen = seen
                    print("Face seen:", ", ".join(seen) if seen else "no face")
            except Exception as e:
                warn_once(str(e))
            frame_count += 1

            if writer is not None:
                writer.write(frame)

            preview = frame.copy()
            if writer is not None:
                elapsed = int(time.time() - rec_start)
                cv2.circle(preview, (40, 50), 14, (0, 0, 255), -1)
                cv2.putText(preview, f"REC {elapsed}s", (65, 62),
                            cv2.FONT_HERSHEY_DUPLEX, 0.9, (255, 255, 255), 2, cv2.LINE_AA)
            else:
                cv2.putText(preview, "R = record", (20, 60),
                            cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
            cv2.imshow(WINDOW, preview)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("r"):
                if writer is None:
                    path = os.path.join(
                        OUTPUT_DIR, datetime.now().strftime("short_%Y%m%d_%H%M%S.mp4")
                    )
                    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                    writer = cv2.VideoWriter(path, fourcc, FPS, (frame.shape[1], frame.shape[0]))
                    rec_start = time.time()
                    print(f"Recording -> {path}")
                else:
                    writer.release()
                    writer = None
                    print("Saved.")
    except Exception as e:
        print(f"[Error] camera loop crashed: {e}. Call /recognize again to restart it.")
    finally:
        if writer is not None:
            writer.release()
            print("Saved.")
        camera.release()
        cv2.destroyAllWindows()
        print("Camera closed.")


# ---------------- FastAPI ----------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # server is stopping (Ctrl+C): stop the camera and save any recording
    stop_event.set()
    if worker is not None and worker.is_alive():
        worker.join(timeout=5)


app = FastAPI(lifespan=lifespan)


class EnrollRequest(BaseModel):
    name: str


@app.post("/enroll")
def enroll(body: EnrollRequest, frames_needed: int = 5):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    if worker is not None and worker.is_alive():
        raise HTTPException(
            status_code=409,
            detail="The camera is busy with /recognize. Restart the server, enroll, then call /recognize.",
        )

    camera = open_camera()
    if camera is None:
        raise HTTPException(status_code=503, detail="Camera not available")

    embeddings = []
    start = time.time()

    try:
        while len(embeddings) < frames_needed:
            if time.time() - start > ENROLL_TIMEOUT:
                raise HTTPException(status_code=408, detail="Could not capture a clear face in time")

            ok, raw = camera.read()
            if not ok:
                raise HTTPException(status_code=503, detail="Failed to read from camera")

            frame = prepare(raw)
            faces = detect_faces(frame)

            preview = frame.copy()
            for f in faces:
                draw_face_label(preview, f, name)
            cv2.imshow("Enroll - look at the camera", preview)
            cv2.waitKey(1)

            if len(faces) != 1:
                continue
            if not is_real_face(frame, faces[0]):
                print("not a real face, frame skipped")
                continue

            aligned = recognizer.alignCrop(frame, faces[0])
            embeddings.append(recognizer.feature(aligned).flatten())
    finally:
        camera.release()
        cv2.destroyAllWindows()

    mean_embedding = np.mean(embeddings, axis=0).astype(np.float32).tolist()

    db = get_db()
    try:
        cursor = db.cursor()
        cursor.execute("SELECT user_id FROM face_embeddings WHERE name = %s", (name,))
        row = cursor.fetchone()
        if row:
            user_id = row[0]
            cursor.execute(
                "UPDATE face_embeddings SET embedding = %s WHERE user_id = %s",
                (json.dumps(mean_embedding), user_id),
            )
        else:
            user_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO face_embeddings (user_id, name, embedding) VALUES (%s, %s, %s)",
                (user_id, name, json.dumps(mean_embedding)),
            )
        db.commit()
        cursor.close()
    finally:
        db.close()

    return {"status": "enrolled", "name": name, "user_id": user_id}


@app.post("/recognize")
def recognize():
    global worker

    with lock:
        if worker is not None and worker.is_alive():
            return {"status": "already running"}

        try:
            names, embeddings = load_known_faces()
        except Exception as e:
            warn_once(f"database error, faces will show as Unknown: {e}")
            names, embeddings = [], []

        stop_event.clear()
        startup = {"ready": threading.Event(), "error": None}
        worker = threading.Thread(
            target=camera_loop, args=(names, embeddings, startup), daemon=True
        )
        worker.start()

        startup["ready"].wait(timeout=10)
        if startup["error"]:
            raise HTTPException(status_code=503, detail=startup["error"])

    return {
        "status": "started",
        "enrolled_faces": len(names),
        "message": "Camera is running and will not stop. Press Ctrl+C in the server terminal to stop it.",
    }