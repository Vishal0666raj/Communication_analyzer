#!/usr/bin/env python3
"""
src/services/vision/analyze_frames.py
Processes a directory of extracted video frames using MediaPipe.
Computes metrics: eye contact, head pose, smiles, blink rate, posture (shoulders), and hand gestures.
Outputs a structured JSON object to stdout.
"""

import os
import sys
import json
import re

# Fallback check for dependencies
try:
    import cv2
    import mediapipe as mp
    import numpy as np
    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False

def parse_frame_index(filename):
    """Extracts sequence index from names like 'frame-001.png'."""
    match = re.search(r'frame-(\d+)\.png', filename)
    if match:
        return int(match.group(1))
    return None

def analyze_frames(frame_dir):
    if not os.path.exists(frame_dir):
        print(json.dumps({"error": f"Directory not found: {frame_dir}"}))
        return

    # Check if dependencies are installed. If not, generate realistic simulated output
    if not DEPENDENCIES_AVAILABLE:
        print(json.dumps({
            "warning": "MediaPipe, OpenCV, or NumPy is not installed in the Python environment. Returning simulation.",
            "frames": simulate_analysis(frame_dir)
        }))
        return

    # Initialize MediaPipe Solutions
    mp_face_mesh = mp.solutions.face_mesh
    mp_pose = mp.solutions.pose
    mp_hands = mp.solutions.hands

    # Load estimators
    face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True)
    pose = mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5)
    hands = mp_hands.Hands(static_image_mode=True, max_num_hands=2, min_detection_confidence=0.5)

    frame_files = [f for f in os.listdir(frame_dir) if f.startswith("frame-") and f.endswith(".png")]
    frame_files.sort(key=parse_frame_index)

    results = []

    for file_name in frame_files:
        frame_idx = parse_frame_index(file_name)
        timestamp = frame_idx - 1.0  # Assuming 1 frame per second
        
        file_path = os.path.join(frame_dir, file_name)
        img = cv2.imread(file_path)
        if img is None:
            continue

        h, w, _ = img.shape
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # 1. Face Analysis (Eye Contact, Head Pose, Smiling)
        face_results = face_mesh.process(img_rgb)
        eye_contact = True
        head_pose = {"pitch": 0.0, "yaw": 0.0, "roll": 0.0}
        smiling = False
        blink_ratio = 0.0

        if face_results.multi_face_landmarks:
            landmarks = face_results.multi_face_landmarks[0].landmark
            
            # Simple smile detection: mouth corner horizontal distance divided by vertical depth
            # landmarks: 61 (L mouth corner), 291 (R mouth corner)
            # landmarks: 0 (top lip), 17 (bottom lip)
            mouth_width = np.linalg.norm(np.array([landmarks[291].x - landmarks[61].x, landmarks[291].y - landmarks[61].y]))
            mouth_height = np.linalg.norm(np.array([landmarks[17].x - landmarks[0].x, landmarks[17].y - landmarks[0].y]))
            
            # Normalize by face scale (using eye outer corners)
            face_width = np.linalg.norm(np.array([landmarks[454].x - landmarks[234].x, landmarks[454].y - landmarks[234].y]))
            ratio = mouth_width / face_width
            if ratio > 0.42: # Threshold for smile
                smiling = True

            # Eye aspect ratio (EAR) to detect blink/closing
            # Left Eye: 362 (inner), 263 (outer), 386 (top), 374 (bottom)
            left_ear = np.linalg.norm(np.array([landmarks[386].x - landmarks[374].x, landmarks[386].y - landmarks[374].y]))
            # Normalize by face width
            if (left_ear / face_width) < 0.04:
                blink_ratio = 1.0 # Blinking

            # Head Pose Estimation via 3D keypoint PnP
            # Points: Nose tip (1), Chin (152), Left eye outer corner (33), Right eye outer corner (263),
            # Left mouth corner (61), Right mouth corner (291)
            model_points = np.array([
                (0.0, 0.0, 0.0),             # Nose tip
                (0.0, -330.0, -65.0),        # Chin
                (-225.0, 170.0, -135.0),     # Left eye outer corner
                (225.0, 170.0, -135.0),      # Right eye outer corner
                (-150.0, -150.0, -125.0),    # Left mouth corner
                (150.0, -150.0, -125.0)      # Right mouth corner
            ])

            # Corresponding 2D image points
            mesh_indices = [1, 152, 33, 263, 61, 291]
            image_points = np.array([
                (landmarks[idx].x * w, landmarks[idx].y * h) for idx in mesh_indices
            ], dtype="double")

            # Camera matrix estimation
            focal_length = w
            center = (w/2, h/2)
            camera_matrix = np.array([
                [focal_length, 0, center[0]],
                [0, focal_length, center[1]],
                [0, 0, 1]
            ], dtype="double")
            
            dist_coeffs = np.zeros((4, 1)) # Assuming no lens distortion
            (success, rotation_vector, translation_vector) = cv2.solvePnP(
                model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
            )

            if success:
                # Convert rotation vector to euler angles
                rmat, _ = cv2.Rodrigues(rotation_vector)
                angles, _, _, _, _, _ = cv2.RQDecomposition(rmat)
                head_pose = {
                    "pitch": float(angles[0] * 360),
                    "yaw": float(angles[1] * 360),
                    "roll": float(angles[2] * 360)
                }

                # Gaze / Eye contact estimation
                # If yaw or pitch exceeds 15 degrees, they are looking away from camera
                if abs(head_pose["yaw"]) > 15.0 or abs(head_pose["pitch"]) > 15.0:
                    eye_contact = False

        # 2. Pose Analysis (Shoulder alignment, Posture)
        pose_results = pose.process(img_rgb)
        posture = "GOOD"
        shoulders = {"left_y": 0.0, "right_y": 0.0, "angle": 0.0}
        
        if pose_results.pose_landmarks:
            pose_landmarks = pose_results.pose_landmarks.landmark
            
            # Left shoulder (11), Right shoulder (12)
            l_shoulder = pose_landmarks[11]
            r_shoulder = pose_landmarks[12]
            
            # Angle of shoulders
            dy = l_shoulder.y - r_shoulder.y
            dx = l_shoulder.x - r_shoulder.x
            angle = np.degrees(np.arctan2(dy, dx))
            
            shoulders = {
                "left_y": float(l_shoulder.y),
                "right_y": float(r_shoulder.y),
                "angle": float(angle)
            }
            
            # If shoulders are tilted significantly or nose (0) hangs too low relative to shoulders
            nose = pose_landmarks[0]
            avg_shoulder_y = (l_shoulder.y + r_shoulder.y) / 2
            
            # slouch indicator (distance between nose and shoulders is too small)
            if abs(angle) > 10.0:
                posture = "TILTED"
            elif (avg_shoulder_y - nose.y) < 0.15:
                posture = "SLOUCHING"

        # 3. Hand Gesture Analysis (Gesticulation / hand visible)
        hands_results = hands.process(img_rgb)
        hands_visible = False
        hand_count = 0
        
        if hands_results.multi_hand_landmarks:
            hands_visible = True
            hand_count = len(hands_results.multi_hand_landmarks)

        results.append({
            "timestamp": timestamp,
            "eyeContact": eye_contact,
            "headPose": head_pose,
            "smiling": smiling,
            "blinkRate": blink_ratio,
            "posture": posture,
            "shoulders": shoulders,
            "handsVisible": hands_visible,
            "handCount": hand_count
        })

    # Close model pipelines
    face_mesh.close()
    pose.close()
    hands.close()

    print(json.dumps({"frames": results}))

def simulate_analysis(frame_dir):
    """Produces highly realistic simulated visual analysis if libraries are missing."""
    frame_files = [f for f in os.listdir(frame_dir) if f.startswith("frame-") and f.endswith(".png")]
    frame_files.sort(key=parse_frame_index)
    
    simulated_frames = []
    
    for i, file_name in enumerate(frame_files):
        idx = parse_frame_index(file_name)
        timestamp = idx - 1.0
        
        # Make specific frames have posture issues or poor eye contact to verify the pipeline end-to-end
        # e.g. at 4-6 seconds, user looks away (yaw = 18.0)
        # e.g. at 12-14 seconds, user slouches
        
        eye_contact = True
        head_pose = {"pitch": 1.2, "yaw": -0.8, "roll": 0.5}
        posture = "GOOD"
        hands_visible = True
        
        if 4.0 <= timestamp <= 6.0:
            eye_contact = False
            head_pose = {"pitch": -5.0, "yaw": 22.5, "roll": 2.0} # looking right
        
        if 12.0 <= timestamp <= 14.0:
            posture = "SLOUCHING"
            
        if timestamp > 20.0:
            hands_visible = False # hand drops out of frame
            
        simulated_frames.append({
            "timestamp": timestamp,
            "eyeContact": eye_contact,
            "headPose": head_pose,
            "smiling": True if timestamp < 5.0 or timestamp > 25.0 else False,
            "blinkRate": 1.0 if idx % 8 == 0 else 0.0,
            "posture": posture,
            "shoulders": {"left_y": 0.45, "right_y": 0.45, "angle": 0.0 if posture == "GOOD" else 8.5},
            "handsVisible": hands_visible,
            "handCount": 2 if hands_visible else 0
        })
        
    return simulated_frames

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: analyze_frames.py <frame_directory>"}))
        sys.exit(1)
    
    analyze_frames(sys.argv[1])
