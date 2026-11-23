
import cv2
import numpy as np

V2_PATH = "models/MiniFASNetV2.onnx"
V1SE_PATH = "models/MiniFASNetV1SE.onnx"

INPUT_SIZE = 80
SCALE_V2 = 2.7
SCALE_V1SE = 4.0

# The reference inference code identifies class 1 as Real.
# Verify that your ONNX files use the same pretrained weights.
REAL_CLASS = 1

LIVENESS_THRESHOLD = 0.5

# Load models once, not for every camera frame.
net_v2 = cv2.dnn.readNetFromONNX(V2_PATH)
net_v1se = cv2.dnn.readNetFromONNX(V1SE_PATH)


def crop_face(frame, face_box, scale):
    """Crop and resize a face using the reference implementation."""
    img_h, img_w = frame.shape[:2]
    x, y, w, h = [int(v) for v in face_box]

    if w <= 0 or h <= 0:
        raise ValueError("Invalid face bounding box")

    scale = min(
        (img_h - 1) / h,
        (img_w - 1) / w,
        scale,
    )

    new_w = w * scale
    new_h = h * scale

    center_x = x + w / 2
    center_y = y + h / 2

    left = max(0, int(center_x - new_w / 2))
    top = max(0, int(center_y - new_h / 2))
    right = min(img_w - 1, int(center_x + new_w / 2))
    bottom = min(img_h - 1, int(center_y + new_h / 2))

    if right < left or bottom < top:
        raise ValueError("Face crop is outside the image")

    crop = frame[top:bottom + 1, left:right + 1]

    if crop.size == 0:
        raise ValueError("Face crop is empty")

    return cv2.resize(crop, (INPUT_SIZE, INPUT_SIZE))


def softmax(values):
    """Convert logits into probabilities."""
    values = np.asarray(values, dtype=np.float32).reshape(-1)
    values = values - np.max(values)

    exp_values = np.exp(values)
    return exp_values / exp_values.sum()


def run_model(net, frame, face_box, scale):
    """Run one ONNX model on a face crop."""
    crop = crop_face(frame, face_box, scale)

    # Match the reference preprocessing:
    # HWC -> CHW, float32, add batch dimension.
    # Do not divide pixel values by 255.
    tensor = crop.astype(np.float32).transpose(2, 0, 1)
    tensor = tensor[np.newaxis, ...]

    net.setInput(tensor)
    logits = net.forward().reshape(-1)

    if logits.size != 3:
        raise ValueError(
            f"Expected 3 class scores, got {logits.size}"
        )

    return softmax(logits)


def check_liveness(frame, face_box):
    """Accept only when both models predict Real with sufficient confidence."""
    probs_v2 = run_model(
        net_v2, frame, face_box, SCALE_V2
    )
    probs_v1se = run_model(
        net_v1se, frame, face_box, SCALE_V1SE
    )

    score_v2 = float(probs_v2[REAL_CLASS])
    score_v1se = float(probs_v1se[REAL_CLASS])

    real_v2 = int(np.argmax(probs_v2)) == REAL_CLASS
    real_v1se = int(np.argmax(probs_v1se)) == REAL_CLASS

    is_real = (
        real_v2
        and real_v1se
        and score_v2 >= LIVENESS_THRESHOLD
        and score_v1se >= LIVENESS_THRESHOLD
    )

    score = min(score_v2, score_v1se)

    print("MiniFASNetV2 probabilities:", probs_v2)
    print("MiniFASNetV1SE probabilities:", probs_v1se)
    print(f"V2 real score: {score_v2:.3f}")
    print(f"V1SE real score: {score_v1se:.3f}")
    print(f"Liveness score: {score:.3f}, accepted: {is_real}")

    return is_real, score
