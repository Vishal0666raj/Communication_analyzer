# AI Communication Coach Backend

A scalable, asynchronous, production-ready Node.js & Express.js backend for an AI-powered Communication Coach application.

The application allows users to upload videos of themselves speaking, processes the video in the background (extracting audio, capturing frames, transcribing text via Whisper, and checking body language/eye contact via MediaPipe), and generates an AI-synthesized coaching report with overall scores, specific strengths/weaknesses, and an interactive, timestamped feedback timeline.

---

## 🚀 Features

* **JWT Authentication**: Secure user registration, login, and profile fetching.
* **Decoupled Background Queue**: File uploads immediately respond with `202 Accepted` and a job ID, offloading heavy processing to a background loop so the API is never blocked.
* **FFmpeg Core Processing**: Video metadata extraction, Wav audio splitting, and frame-by-frame snapshot extraction.
* **Whisper Speech-to-Text**: Integrates OpenAI's Whisper API to obtain transcriptions, sentence segments, and word-level timestamps.
* **MediaPipe Computer Vision**: Spawns a Python child process executing MediaPipe solutions (Pose, Hands, FaceMesh) to estimate head tilts, blink rates, smiles, posture, and hand gesture frequency.
* **Speech Analytics**: Calculates speaking speed in Words Per Minute (WPM), catches filler words ("um", "like", "you know"), flags consecutive word repetitions, and identifies pauses (> 2 seconds).
* **LLM Coaching Feedback**: Employs OpenAI (GPT-4o) or Google Gemini (gemini-2.5-flash) to structure qualitative scores and synthesize strengths/weaknesses.
* **Timestamped Feedback Coalescing**: Consolidates consecutive frames of posture or eye contact issues into unified start/end timeline events.
* **Fault-Tolerant Simulator Modes**: Runs out-of-the-box in developer environments. If API keys, FFmpeg, or Python MediaPipe libraries are missing, the system falls back to high-fidelity simulated logs, permitting seamless integration testing.

---

## 🛠️ Prerequisites

Before launching the backend, ensure you have the following installed on your machine:

1. **Node.js** (v16+) & **npm** (v8+)
2. **MongoDB** (Local instance running on port `27017` or a MongoDB Atlas URI)
3. **FFmpeg** (Required for audio/frame extraction)
   * **macOS**: `brew install ffmpeg`
   * **Linux**: `sudo apt install ffmpeg`
   * **Windows**: Download binaries and add to system Path.
4. **Python 3.8+** (Required for MediaPipe computer vision metrics)
   * Make sure `python3` and `pip3` are accessible from your terminal.

---

## 📦 Installation & Setup

### 1. Clone the project and install Node dependencies
```bash
npm install
```

### 2. Install Python dependencies (for MediaPipe processing)
```bash
pip3 install opencv-python mediapipe numpy
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (a template is provided in the codebase):
```env
PORT=5000
NODE_ENV=development

# Database Connection (Local or Atlas)
MONGODB_URI=mongodb://127.0.0.1:27017/ai_communication_coach

# JSON Web Token Secret
JWT_SECRET=super_secret_ai_communication_coach_jwt_key_2026
JWT_EXPIRES_IN=7d

# AI API Providers (options: openai / gemini)
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Directory configurations
UPLOAD_DIR=src/uploads
TEMP_DIR=src/temp
```

*Note: If `OPENAI_API_KEY` or `GEMINI_API_KEY` are left empty, the backend automatically falls back to a high-fidelity local text-synthesizer, so you can still run the entire pipeline.*

---

## 🚦 How to Run

### 1. Run the Integration Verification Pipeline
Before spinning up the server, you can verify your environment and see the pipeline execute end-to-end (connecting to DB, queueing a job, running services, and saving reports) by running:
```bash
node src/utils/testPipeline.js
```

### 2. Start the Development Server
```bash
node src/server.js
```
The server will boot, establish a connection to MongoDB, start the background queue processor (polling for jobs every 3 seconds), and begin listening on `http://localhost:5000`.

---

## 📖 REST API Reference

All requests must include the header:
`Content-Type: application/json`

For authenticated endpoints, include the header:
`Authorization: Bearer <your_jwt_token>`

### 🔐 Authentication

#### 1. Register User
`POST /api/auth/register`
* **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "securepassword123"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "status": "success",
    "token": "eyJhbGciOi...",
    "data": {
      "user": {
        "id": "6a46...",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "createdAt": "2026-07-02T12:00:00Z"
      }
    }
  }
  ```

#### 2. Login User
`POST /api/auth/login`
* **Request Body**:
  ```json
  {
    "email": "jane@example.com",
    "password": "securepassword123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "token": "eyJhbGciOi..."
  }
  ```

#### 3. Get Authenticated User Profile
`GET /api/users/me`
* **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "6a46...",
        "name": "Jane Doe",
        "email": "jane@example.com"
      }
    }
  }
  ```

---

### 📹 Video Processing & Jobs

#### 4. Upload Video and Queue Job
`POST /api/upload-video`
* **Request Content-Type**: `multipart/form-data`
* **Request Body**:
  * `video`: Binary file (supported extensions: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`)
* **Response (202 Accepted)**:
  ```json
  {
    "status": "success",
    "message": "Video uploaded successfully and queued for analysis.",
    "data": {
      "job": {
        "id": "60a76ae6...",
        "status": "QUEUED",
        "progress": 0,
        "videoFilename": "video-1782975094796.mp4",
        "createdAt": "2026-07-02T12:05:00Z"
      }
    }
  }
  ```

#### 5. Get Job Details (Full Document)
`GET /api/jobs/:jobId`
* **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "job": {
        "_id": "60a76ae6...",
        "userId": "6a46...",
        "videoPath": "src/uploads/video-1782975094796.mp4",
        "audioPath": "src/temp/audio-60a76ae6.wav",
        "status": "COMPLETED",
        "progress": 100,
        "reportId": "6a460a78ae60238fa934a21b",
        "createdAt": "2026-07-02T12:05:00Z",
        "updatedAt": "2026-07-02T12:07:00Z"
      }
    }
  }
  ```

#### 6. Poll Job Status (Lightweight Status Checking)
`GET /api/jobs/:jobId/status`
* **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "jobId": "60a76ae6...",
      "status": "PROCESSING",
      "progress": 50,
      "error": null
    }
  }
  ```

#### 7. Delete Job (Clears physical video/audio/frames and associated DB report)
`DELETE /api/jobs/:jobId`
* **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Job and all associated files deleted successfully."
  }
  ```

---

### 📊 Coaching Reports

#### 8. Retrieve Compiled AI Coaching Report
`GET /api/reports/:jobId`
* **Response (200 OK - When Ready)**:
  ```json
  {
    "status": "success",
    "data": {
      "report": {
        "_id": "6a460a78ae60238fa934a21b",
        "jobId": "60a76ae6...",
        "overallScore": 90,
        "confidenceScore": 84,
        "grammarScore": 90,
        "bodyLanguageScore": 90,
        "eyeContactScore": 70,
        "postureScore": 100,
        "gestureScore": 100,
        "communicationScore": 87,
        "vocabularyScore": 80,
        "speakingSpeed": 122,
        "summary": "You delivered a session at 122 WPM. Your posture was good...",
        "fillerWords": [
          { "word": "um", "start": 3.8, "end": 4.4, "formattedStart": "00:03", "formattedEnd": "00:04" }
        ],
        "pauses": [
          { "start": 14.2, "end": 16.5, "duration": 2.3, "formattedStart": "00:14", "formattedEnd": "00:16" }
        ],
        "strengths": [
          "Excellent speaking speed...",
          "Assertive posture..."
        ],
        "weaknesses": [
          "High filler usage...",
          "Inconsistent eye contact..."
        ],
        "timeline": [
          {
            "startTime": "00:03",
            "endTime": "00:04",
            "category": "Speech",
            "issue": "Used filler word \"Um\"",
            "suggestion": "Pause momentarily rather than filling the silence."
          },
          {
            "startTime": "00:04",
            "endTime": "00:06",
            "category": "Eye Contact",
            "issue": "Looking away from the camera",
            "suggestion": "Maintain direct gaze with the camera to command authority."
          }
        ]
      }
    }
  }
  ```

* **Response (200 OK - When Still Processing)**:
  ```json
  {
    "status": "success",
    "message": "The analysis is still processing. Please check back shortly.",
    "data": {
      "jobId": "60a76ae6...",
      "status": "PROCESSING",
      "progress": 50
    }
  }
  ```

---

## 🛠️ Project Structure

```
src/
├── app.js               # Express application configurations
├── server.js            # Main server boot and signal hooks
├── config/              # Central configurations (db, logger)
├── controllers/         # Request handling logic
├── routes/              # Express endpoint routing
├── middleware/          # JWT protection, uploads, and validator mappings
├── models/              # User, Job, and Report MongoDB/Mongoose models
├── services/            # Audio/frame extractions, Whisper, MediaPipe, AI, Analytics
├── utils/               # Exceptions, time-converters, test pipelines
└── jobs/                # Polling loop background queue processor
```

---

## 📜 License
ISC License
