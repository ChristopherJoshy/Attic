# Hand Gesture Controlled Temple Run 2

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-0.10+-FF6F00?style=for-the-badge&logo=google&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Last Updated](https://img.shields.io/badge/Last%20Updated-2026-blue?style=for-the-badge)

Control the thrilling endless runner game **Temple Run 2** using **hand gestures**! This project leverages **computer vision and gesture recognition** to map hand movements to in-game actions, providing an immersive, touch-free gaming experience. Powered by **OpenCV, MediaPipe, and PyAutoGUI**, this script detects hand gestures via webcam and translates them into keyboard inputs for Temple Run 2 on **Poki**.

---

## Quick Stats

| Metric | Value |
|--------|-------|
| **Language** | Python 3.8+ |
| **Dependencies** | 4 core libraries |
| **Supported Platforms** | Windows, macOS, Linux |
| **FPS** | ~30 FPS (60 FPS with CUDA) |
| **Gesture Types** | 4 custom mappings |

---

## Features

- **Real-Time Gesture Recognition**: Uses **MediaPipe's** hand tracking model for accurate and responsive gesture detection.
- **Cross-Platform Support**: Works on **Windows, macOS, and Linux** (with appropriate dependencies).
- **Custom Gesture Mapping**:
  - **1 Finger Up** → Turn Left (**A**)
  - **2 Fingers Up** → Turn Right (**D**)
  - **3 Fingers or All Fingers Together** → Roll/Land (**S**)
  - **Open Palm** → Jump (**Space/Up**)
- **Visual Feedback**: Displays detected gestures, confidence levels, FPS, and action indicators on the webcam feed.
- **Always-on-Top Window**: Keeps the gesture control window visible during gameplay.
- **CUDA Support**: Optional GPU acceleration for improved performance (if available).

---

## Screenshots

> *Add your screenshots here*

<!-- 
Placeholders for screenshots:
- Gesture detection window showing hand landmarks
- Gameplay with gesture control active
- Setup/configuration example
-->

---

## Prerequisites

- **Python 3.8+** (Ensure Python is installed on your system)
- **Webcam** (A functional webcam connected to your computer)
- **Temple Run 2** (Playable in a browser at Poki)

---

## Installation

### Required Libraries

Install the following Python packages:

```bash
pip install opencv-python numpy mediapipe pyautogui
```

#### Platform-Specific Dependencies

- **Windows:**
  ```bash
  pip install pywin32
  ```
- **macOS:**
  ```bash
  pip install pyobjc
  ```
- **Linux:**
  ```bash
  pip install python-xlib
  ```

#### Optional (for CUDA Acceleration)

If you have an **NVIDIA GPU and CUDA installed**, install OpenCV with CUDA support. Refer to the **OpenCV CUDA Installation Guide**.

### Clone the Repository

```bash
git clone https://github.com/yourusername/temple-run-gesture-control.git
cd temple-run-gesture-control
```

*(Replace ****`yourusername`**** with your GitHub username.)*

### Install Dependencies

```bash
pip install -r requirements.txt
```

*(Create a ****`requirements.txt`**** file with the required libraries for easier setup.)*

### Verify Webcam

Ensure your webcam is working and accessible by Python.

---

## Usage

1. **Launch Temple Run 2**: Open Temple Run 2 on **Poki** in your browser.
2. **Start the Game**: Keep the browser window active.
3. **Run the Script**:
   ```bash
   python gesture_control.py
   ```
4. **Perform Gestures**:
   - **1 Finger Up** → Turn Left (**A**)
   - **2 Fingers Up** → Turn Right (**D**)
   - **3 Fingers / All Together** → Roll/Slide (**S**)
   - **Open Palm** → Jump (**Space / Up**)
5. **Exit the Program**: Press **`q`** in the gesture control window to quit.

---

## How It Works

1. **Hand Detection**: **MediaPipe** processes webcam frames to detect hand landmarks.
2. **Gesture Recognition**: Custom logic analyzes finger positions and angles to classify gestures.
3. **Action Mapping**: Detected gestures trigger **keyboard inputs** via **PyAutoGUI**, controlling Temple Run 2.
4. **Performance Optimization**: Supports **CUDA acceleration** and maintains a high FPS for smooth gameplay.

---

## Controls Mapping

| Gesture                  | Game Action | Key Pressed  |
| ------------------------ | ----------- | ------------ |
| 1 Finger Up              | Turn Left   | `A`          |
| 2 Fingers Up             | Turn Right  | `D`          |
| 3 Fingers / All Together | Roll/Slide  | `S`          |
| Open Palm                | Jump        | `Space / Up` |

---

## Troubleshooting

- **Webcam Not Detected**: Ensure your webcam is connected and not in use by another application.
- **Gestures Not Recognized**: Adjust lighting conditions and hand positioning; ensure your hand is within the webcam frame.
- **Lag or Low FPS**: Disable CUDA if unsupported (`use_cuda = False`) or reduce webcam resolution in the code.
- **Window Not on Top**: Verify platform-specific dependencies are installed correctly.

---

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and commit them (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a **Pull Request**

### Ideas for Contribution

- Add support for additional games
- Improve gesture recognition accuracy
- Add more gesture mappings
- Enhance visual feedback UI
- Optimize performance
- Add unit tests

---

## License

This project is licensed under the **MIT License** - see the LICENSE file for details.

---

## Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for hand tracking
- [OpenCV](https://opencv.org/) for computer vision
- [PyAutoGUI](https://pyautogui.readthedocs.io/) for automation
- [Poki](https://poki.com/) for Temple Run 2

---

<p align="center">
  <strong>Made with ❤️ for gesture-controlled gaming</strong>
</p>
