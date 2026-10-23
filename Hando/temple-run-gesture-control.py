import cv2
import numpy as np
import time
import pyautogui
import threading
import mediapipe as mp
from collections import deque
import platform
import sys

if platform.system() == "Windows":
    import win32gui
    import win32con
elif platform.system() == "Darwin":  
    try:
        import Cocoa
        import AppKit
        import objc
    except ImportError:
        print("For macOS, install pyobjc: pip install pyobjc")
elif platform.system() == "Linux":
    try:
        import Xlib
        import Xlib.display
    except ImportError:
        print("For Linux, install python-xlib: pip install python-xlib")

cam = cv2.VideoCapture(0)
cam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
cam.set(cv2.CAP_PROP_FPS, 120)

if not cam.isOpened():
    print("Error: Could not open webcam.")
    exit()

print("Webcam opened successfully! Starting gesture recognition...")

cv2.namedWindow("Gesture Controls", cv2.WINDOW_NORMAL)
cv2.resizeWindow("Gesture Controls", 640, 480)

def make_window_top():
    window_name = "Gesture Controls"
    if platform.system() == "Windows":
        hwnd = win32gui.FindWindow(None, window_name)
        if hwnd:
            win32gui.SetWindowPos(
                hwnd, 
                win32con.HWND_TOPMOST, 
                0, 0, 0, 0, 
                win32con.SWP_NOMOVE | win32con.SWP_NOSIZE
            )
            print("Window set to always on top (Windows)")
    elif platform.system() == "Darwin":  
        try:
            windows = AppKit.NSApp.windows()
            for window in windows:
                if window.title() == window_name:
                    window.setLevel_(AppKit.NSStatusWindowLevel)
                    print("Window set to always on top (macOS)")
                    break
        except Exception as e:
            print(f"Failed to set window always on top on macOS: {e}")
    elif platform.system() == "Linux":
        try:
            display = Xlib.display.Display()
            root = display.screen().root
            windows = root.query_tree().children
            for window in windows:
                window_name_data = window.get_wm_name()
                if window_name_data and window_name_data == window_name:
                    window.configure(stack_mode=Xlib.X.Above)
                    display.sync()
                    print("Window set to always on top (Linux)")
                    break
        except Exception as e:
            print(f"Failed to set window always on top on Linux: {e}")
    else:
        print(f"Always-on-top not implemented for platform: {platform.system()}")

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7,
    model_complexity=1
)
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

last_action_time = 0
cooldown = 0.3
current_action = "None"
action_color = (255, 255, 255)
feedback_alpha = 0.0
fade_start_time = 0

gesture_conf = {"fist": 0, "closed_palm": 0, "palm": 0, "one": 0, "two": 0, "three": 0, "four": 0, "all_fingers_together": 0, "none": 0}
conf_threshold = 0.6
history_weight = 0.4

frame_times = deque(maxlen=30)
last_fps_update = time.time()
current_fps = 0

try:
    if cv2.cuda.getCudaEnabledDeviceCount() > 0:
        print("CUDA acceleration enabled")
        use_cuda = True
    else:
        use_cuda = False
except:
    use_cuda = False
    print("CUDA not available, using CPU")

def press_key(key):
    threading.Thread(target=lambda: pyautogui.press(key), daemon=True).start()

def press_multi_keys(keys):
    def press_all():
        for key in keys:
            pyautogui.press(key)
            time.sleep(0.05)
    threading.Thread(target=press_all, daemon=True).start()

def show_feedback(image, action):
    global action_color
    if action == "Turn Left (A)":
        action_color = (255, 0, 0)
    elif action == "Turn Right (D)":
        action_color = (0, 0, 255)
    elif action == "Roll/Land (S)":
        action_color = (0, 165, 255)
    elif action == "Jump (Space/Up)":
        action_color = (0, 255, 0)
    else:
        return image
    h, w = image.shape[:2]
    cv2.rectangle(image, (0, 0), (w, h), action_color, 10)
    return image

def calc_finger_angles(landmarks):
    points = np.array([(lm.x, lm.y, lm.z) for lm in landmarks.landmark])
    
    finger_indices = [
        [0, 1, 2, 3, 4],        
        [0, 5, 6, 7, 8],        
        [0, 9, 10, 11, 12],     
        [0, 13, 14, 15, 16],    
        [0, 17, 18, 19, 20]     
    ]
    
    finger_angles = []
    for finger in finger_indices:
        if len(finger) >= 3:
            v1 = points[finger[2]][:2] - points[finger[1]][:2]
            v2 = points[finger[3]][:2] - points[finger[2]][:2]
            
            v1 = v1 / np.linalg.norm(v1) if np.linalg.norm(v1) > 0 else v1
            v2 = v2 / np.linalg.norm(v2) if np.linalg.norm(v2) > 0 else v2
            
            dot_product = np.clip(np.dot(v1, v2), -1.0, 1.0)
            angle = np.arccos(dot_product) * 180 / np.pi
            finger_angles.append(angle)
    
    return finger_angles

def is_finger_up(landmarks, finger_tip_idx, finger_mid_idx, wrist_idx=0):
    tip = landmarks.landmark[finger_tip_idx]
    mid = landmarks.landmark[finger_mid_idx]
    wrist = landmarks.landmark[wrist_idx]
    
    is_extended = (tip.y < mid.y) and (mid.y < wrist.y)
    
    return is_extended

def check_gesture(landmarks, frame_width, frame_height):
    if landmarks is None:
        return None
    
    thumb_up = is_finger_up(landmarks, 4, 3, 0)
    index_up = is_finger_up(landmarks, 8, 6, 0)
    middle_up = is_finger_up(landmarks, 12, 10, 0)
    ring_up = is_finger_up(landmarks, 16, 14, 0)
    pinky_up = is_finger_up(landmarks, 20, 18, 0)
    
    finger_angles = calc_finger_angles(landmarks)
    
    wrist = landmarks.landmark[0]
    wrist_pos = (wrist.x * frame_width, wrist.y * frame_height)
    
    index_tip = landmarks.landmark[8]
    index_pos = (index_tip.x * frame_width, index_tip.y * frame_height)
    
    middle_tip = landmarks.landmark[12]
    middle_pos = (middle_tip.x * frame_width, middle_tip.y * frame_height)
    
    ring_tip = landmarks.landmark[16]
    ring_pos = (ring_tip.x * frame_width, ring_tip.y * frame_height)
    
    fingers_up = [index_up, middle_up, ring_up, pinky_up]
    up_count = sum(fingers_up)
    
    palm_landmarks = [0, 5, 9, 13, 17]
    palm_points = [(landmarks.landmark[idx].x * frame_width, 
                   landmarks.landmark[idx].y * frame_height) 
                   for idx in palm_landmarks]
    palm_center = np.mean(palm_points, axis=0)
    
    finger_tip_indices = [8, 12, 16, 20]
    distances = [np.sqrt(((landmarks.landmark[idx].x * frame_width - palm_center[0])**2) + 
                        ((landmarks.landmark[idx].y * frame_height - palm_center[1])**2)) 
                for idx in finger_tip_indices]
    avg_distance = np.mean(distances)
    
    # Check for all fingers together gesture
    finger_tip_coords = [
        (landmarks.landmark[8].x, landmarks.landmark[8].y),  # index
        (landmarks.landmark[12].x, landmarks.landmark[12].y),  # middle
        (landmarks.landmark[16].x, landmarks.landmark[16].y),  # ring
        (landmarks.landmark[20].x, landmarks.landmark[20].y),  # pinky
        (landmarks.landmark[4].x, landmarks.landmark[4].y)   # thumb
    ]
    
    # Calculate distances between all pairs of fingertips
    all_close = True
    for i in range(len(finger_tip_coords)):
        for j in range(i+1, len(finger_tip_coords)):
            dist = np.sqrt(
                (finger_tip_coords[i][0] - finger_tip_coords[j][0])**2 + 
                (finger_tip_coords[i][1] - finger_tip_coords[j][1])**2
            )
            # If any pair is too far apart, not all fingers are together
            if dist > 0.1:  # Threshold in normalized coordinates
                all_close = False
                break
        if not all_close:
            break
    
    if all_close:
        return "all_fingers_together"
    
    # Detect three fingers up (index, middle, ring)
    if index_up and middle_up and ring_up and not pinky_up:
        return "three"
    
    # Existing gesture detection logic
    if up_count == 0 and not thumb_up and avg_distance < 70:
        return "fist"
    
    if up_count == 0 and avg_distance >= 70 and avg_distance < 100:
        return "closed_palm"
    
    # Important: Only recognize palm gesture if both conditions are met - high up_count AND thumb is up
    elif up_count >= 3 and thumb_up and avg_distance > 100:
        # Make sure it's not our "three" gesture
        if not (index_up and middle_up and ring_up and not pinky_up):
            return "palm"
    
    elif up_count == 1 and index_up and not middle_up:
        return "one"
    
    elif up_count == 2 and index_up and middle_up and not ring_up and not pinky_up:
        index_middle_distance = np.sqrt((index_pos[0] - middle_pos[0])**2 + 
                                        (index_pos[1] - middle_pos[1])**2)
        
        if index_middle_distance > 30:
            return "two"
    
    elif up_count == 4:
        return "four"
    
    return None

def add_watermark(frame):
    h, w = frame.shape[:2]
    watermark_text = "Made by CJ"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.7
    thickness = 2
    
    text_size = cv2.getTextSize(watermark_text, font, font_scale, thickness)[0]
    
    position = (w - text_size[0] - 10, h - 10)
    
    overlay = frame.copy()
    cv2.putText(overlay, watermark_text, position, font, font_scale, (255, 255, 255), thickness)
    
    alpha = 0.7
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
    
    return frame

make_window_top()

def refresh_topmost():
    make_window_top()
    threading.Timer(2.0, refresh_topmost).start()

refresh_topmost()

try:
    while cam.isOpened():
        frame_start = time.time()
        
        success, frame = cam.read()
        if not success:
            print("Failed to read frame from webcam.")
            cam.release()
            time.sleep(0.5)
            cam = cv2.VideoCapture(0)
            continue
            
        frame = cv2.flip(frame, 1)
        frame_height, frame_width = frame.shape[:2]
        
        if use_cuda:
            gpu_frame = cv2.cuda_GpuMat()
            gpu_frame.upload(frame)
            gpu_frame_rgb = cv2.cuda.cvtColor(gpu_frame, cv2.COLOR_BGR2RGB)
            frame_rgb = gpu_frame_rgb.download()
        else:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        results = hands.process(frame_rgb)
        
        gesture = None
        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]
            
            mp_drawing.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(255, 0, 255), thickness=2, circle_radius=4),
                mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=2)
            )
            
            gesture = check_gesture(hand_landmarks, frame_width, frame_height)
        
        current_time = time.time()
        if gesture:
            for g in gesture_conf:
                gesture_conf[g] *= (1 - history_weight)
            gesture_conf[gesture] += history_weight
            gesture_conf["none"] = max(0, gesture_conf["none"] - history_weight)
        else:
            for g in gesture_conf:
                gesture_conf[g] *= (1 - history_weight)
            gesture_conf["none"] += history_weight
        
        best_gesture = max(gesture_conf, key=gesture_conf.get)
        if gesture_conf[best_gesture] > conf_threshold and best_gesture != "none":
            if current_time - last_action_time > cooldown:
                if best_gesture == "one":
                    current_action = "Turn Left (A)"
                    press_key('a')
                elif best_gesture == "two":
                    current_action = "Turn Right (D)"
                    press_key('d')
                # Check for three fingers or all fingers together before checking for palm
                elif best_gesture == "three" or best_gesture == "all_fingers_together":
                    current_action = "Roll/Land (S)"
                    press_key('s')
                elif best_gesture == "palm":
                    current_action = "Jump (Space/Up)"
                    press_multi_keys(['space', 'up'])
                # Keep the four finger gesture as Roll/Land for backward compatibility
                elif best_gesture == "four":
                    current_action = "Roll/Land (S)"
                    press_key('s')
                last_action_time = current_time
                fade_start_time = current_time
                feedback_alpha = 1.0
        else:
            current_action = "None"
        
        if feedback_alpha > 0:
            fade_elapsed = current_time - fade_start_time
            if fade_elapsed < 0.3:
                feedback_alpha = 1.0 - (fade_elapsed / 0.3)
            else:
                feedback_alpha = 0.0
            if feedback_alpha > 0:
                show_feedback(frame, current_action)
        
        if current_action != "None":
            cv2.putText(frame, f"Action: {current_action}", (10, 70), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, action_color, 2)
        
        if gesture:
            gesture_display = gesture.replace("_", " ").capitalize()
            cv2.putText(frame, f"Gesture: {gesture_display}", 
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
            
            cv2.putText(frame, f"Confidence: {gesture_conf[gesture]:.2f}", 
                        (10, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        
        frame_end = time.time()
        frame_time = frame_end - frame_start
        frame_times.append(frame_time)
        
        if current_time - last_fps_update > 1.0:
            if frame_times:
                current_fps = int(1.0 / np.mean(frame_times))
                last_fps_update = current_time
        
        cv2.putText(frame, f"FPS: {current_fps}", (frame_width - 120, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        
        controls_y = frame_height - 130
        cv2.rectangle(frame, (0, controls_y), (300, frame_height), (0, 0, 0), -1)
        cv2.putText(frame, "Controls:", (10, controls_y + 20), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(frame, "1 finger: Turn Left (A)", (10, controls_y + 45), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(frame, "2 fingers: Turn Right (D)", (10, controls_y + 70), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(frame, "3 fingers or all together: Roll/Land (S)", (10, controls_y + 95), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(frame, "Open palm: Jump (Space/Up)", (10, controls_y + 120), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        frame = add_watermark(frame)
        
        cv2.imshow("Gesture Controls", frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("Q key pressed. Exiting...")
            break
            
except Exception as e:
    print(f"Error running the application: {e}")
finally:
    hands.close()
    cam.release()
    cv2.destroyAllWindows()
    print("Application closed successfully.")
    
# made by cj