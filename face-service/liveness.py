import cv2
import numpy as np

V2_PATH = "models/MiniFASNetV2.onnx"
V1SE_PATH = "models/MiniFASNetV1SE.onnx"

INPUT_SIZE = 80          # both models want an 80x80 image
SCALE_V2 = 2.7           # how much bigger than the face box to crop (model 1)
SCALE_V1SE = 4.0         # how much bigger than the face box to crop (model 2)
REAL_CLASS = 1           # output index 1 = real face, the others = fake
LIVENESS_THRESHOLD = 0.5 # you tune this with your own camera

# load once when the server starts
# OpenCV can run .onnx models itself, so no extra library is needed
net_v2 = cv2.dnn.readNetFromONNX(V2_PATH)
net_v1se = cv2.dnn.readNetFromONNX(V1SE_PATH)


def crop_face(frame, face_box, scale):
    img_h, img_w = frame.shape[:2]
    x, y, w, h = face_box

    # do not let the bigger box go outside of the image
    scale = min((img_h - 1) / h, (img_w - 1) / w, scale)
    new_w = w * scale
    new_h = h * scale

    # same center as the face, bigger size
    center_x = x + w / 2
    center_y = y + h / 2
    left = max(0, int(center_x - new_w / 2))
    top = max(0, int(center_y - new_h / 2))
    right = min(img_w - 1, int(center_x + new_w / 2))
    bottom = min(img_h - 1, int(center_y + new_h / 2))

    crop = frame[top:bottom + 1, left:right + 1]
    return cv2.resize(crop, (INPUT_SIZE, INPUT_SIZE))


def softmax(values):
    values = values - np.max(values)
    exp = np.exp(values)
    return exp / exp.sum()


def run_model(net, frame, face_box, scale):
    crop = crop_face(frame, face_box, scale)
    tensor = np.transpose(crop.astype(np.float32), (2, 0, 1))[np.newaxis, ...]
    net.setInput(tensor)
    logits = net.forward()[0]
    return softmax(logits)



def check_liveness(frame, face_box):
    """Check whether both models classify the face as real."""
    box = [int(v) for v in face_box]

    probs_v2 = run_model(net_v2, frame, box, SCALE_V2)
    probs_v1se = run_model(net_v1se, frame, box, SCALE_V1SE)

    # Index 1 is Real in the repository's inference code.
    real_v2 = int(np.argmax(probs_v2)) == 1
    real_v1se = int(np.argmax(probs_v1se)) == 1

    score_v2 = float(probs_v2[1])
    score_v1se = float(probs_v1se[1])

    # Require both models to agree and reach the confidence threshold.
    is_real = (
        real_v2
        and real_v1se
        and score_v2 >= LIVENESS_THRESHOLD
        and score_v1se >= LIVENESS_THRESHOLD
    )

    score = min(score_v2, score_v1se)

    print("MiniFASNetV2:", probs_v2)
    print("MiniFASNetV1SE:", probs_v1se)
    print(f"V2 real score: {score_v2:.3f}")
    print(f"V1SE real score: {score_v1se:.3f}")
    print(f"Liveness: {score:.3f}, accepted: {is_real}")

    return is_real, score
