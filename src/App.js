import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StartPage from './StartPage';
import WelcomePage from './WelcomePage';
import AdminPage from './AdminPage';
import { uploadParticipantPhoto } from './s3Service';

function MainApp() {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false); // New state to track submission status
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Start camera
  const openCamera = async () => {
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    // If camera API is not available, fallback to file input (many mobile browsers will open camera)
    if (!hasGetUserMedia) {
      setMessage('Camera API not available — opening file picker (use Camera option on your device).');
      if (fileInputRef.current) fileInputRef.current.click();
      return;
    }
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // Request camera stream (must be in user gesture)
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        streamRef.current = stream;
        // Ensure we show the video element
        setCameraActive(true);
        // If video node is already mounted, attach immediately
        if (videoRef.current) {
          try {
            videoRef.current.srcObject = streamRef.current;
            // Muting helps autoplay in some mobile browsers
            videoRef.current.muted = true;
            videoRef.current.setAttribute('playsinline', '');
            const p = videoRef.current.play();
            if (p && p.catch) p.catch(err => console.warn('video.play() failed:', err));
          } catch (err) {
            console.warn('Failed to attach stream to video element:', err);
          }
        }
      } catch (err) {
        console.error('openCamera error', err);
        setMessage('Camera access failed: ' + (err.message || err));
      }
    } else {
      // This branch is unlikely due to prior check, but keep message for diagnostics
      setMessage('Camera API not available on this device/browser — use the Upload button instead.');
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileSelected = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    // If image, set as photo and preview
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
    setMessage('Image selected from device.');
    // Close any camera streams
    closeCamera();
  };

  // If stream is already requested and video element becomes available, attach it
  // Depend on cameraActive instead of reading ref.current in the dependency array
  useEffect(() => {
    if (streamRef.current && videoRef.current) {
      try {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.muted = true;
        videoRef.current.setAttribute('playsinline', '');
        const p = videoRef.current.play();
        if (p && p.catch) p.catch(err => console.warn('video.play() failed in effect:', err));
      } catch (err) {
        console.warn('Error attaching stream in effect', err);
      }
    }
  }, [cameraActive]);

  // Stop camera
  const closeCamera = () => {
    // Stop any stream we hold
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.warn('Error stopping tracks', err);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch (e) {}
    }
    setCameraActive(false);
  };

  // Take photo
  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      context.drawImage(videoRef.current, 0, 0, 240, 240);
      canvasRef.current.toBlob(blob => {
        setPhoto(blob);
        setPreview(URL.createObjectURL(blob));
      }, 'image/jpeg');
    }
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch (e){}
    }
    setCameraActive(false);
  };

  // Open modal
  const handleRegister = () => {
    setShowModal(true);
    setPhoto(null);
    setPreview(null);
    setName('');
    setCameraActive(false);
  };

  // Close modal
  const handleClose = () => {
    setShowModal(false);
    closeCamera();
    setPhoto(null);
    setPreview(null);
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !photo) {
      setMessage('Please provide both name and photo.');
      return;
    }
    if (!(photo instanceof File || photo instanceof Blob)) {
      setMessage('Photo is not a valid File or Blob.');
      return;
    }
    setMessage('Registering...');
    setIsSubmitting(true); // Disable the button
    try {
      let uploadBlob = photo;
      if (photo instanceof Blob && !(photo instanceof File)) {
        uploadBlob = await photo.arrayBuffer();
      }
      if (photo instanceof File) {
        uploadBlob = await photo.arrayBuffer();
      }
      await uploadParticipantPhoto(uploadBlob, name);
      setMessage('Registered successfully!');
      setIsSubmitted(true); // Mark as submitted
      setIsSubmitting(false); // Ensure submitting state is reset
    } catch (err) {
      setMessage('Registration failed: ' + (err.message || err));
      setIsSubmitting(false); // Re-enable the button on failure
    }
  };

  // Avoid calling setState synchronously inside effects. Reset related state
  // during the name onChange handler instead.

  return (
    <div className="wallpaper-container">
      <img src={require('./images/newmain.png')} alt="Wallpaper" className="wallpaper" />
      {/* Register button at the top */}
      <button className="register-btn" onClick={handleRegister}>Register</button>
      <h1 className="main-title">Welcome to Sangeet</h1>
      <p className="main-subtitle">Celebrate with us! Register and join the fun.</p>
      <div className="child-images">
        <img src={require('./images/child/img1.png')} alt="Child 1" className="child-img" />
        <img src={require('./images/child/img2.png')} alt="Child 2" className="child-img" />
      </div>
      {showModal && (
        <div className="modal-overlay fancy-blur">
          <div className="modal custom-modal">
            {/* Modal header with big title and subtitle */}
            <div className="modal-header-row">
              <h2 className="modal-title">Register</h2>
              <p className="modal-subtitle">Join the celebration! Enter your details below.</p>
              <span className="close-icon" onClick={handleClose}>&times;</span>
            </div>
            {/* Modal content split: image left, form right */}
            <div className="modal-content-row">
              <div className="modal-image-side">
                {/* Rectangle image with rounded corners */}
                <img
                  src={require('./images/child/img1.png')}
                  alt="Icon"
                  className="modal-icon-rect"
                />
              </div>
              <form className="modal-form-side" onSubmit={handleSubmit}>
                <h3 className="modal-title-white">Name</h3>
                <input
                  type="text"
                  value={name}
                  onChange={e => {
                    const v = e.target.value;
                    setName(v);
                    if (!v.trim()) {
                      setIsSubmitted(false);
                      setPhoto(null);
                      setPreview(null);
                    }
                  }}
                />
                <div className="camera-section-row">
                  {/* Show Open Camera button only when camera is NOT active and no photo is captured */}
                  {!cameraActive && !preview && (
                    <button
                      type="button"
                      className="open-camera-btn yellow-btn"
                      onClick={openCamera}
                    >
                      Open Camera
                    </button>
                  )}
                  {/* Upload fallback: triggers file input with camera capture on many mobile devices */}
                  {!preview && (
                    <button type="button" className="open-camera-btn yellow-btn" onClick={triggerFileInput} style={{marginLeft:8}}>
                      Upload from device
                    </button>
                  )}
                  {/* Show Take Photo button when camera is active and no photo is captured */}
                  {cameraActive && !preview && (
                    <button
                      type="button"
                      className="take-photo-btn yellow-btn"
                      onClick={takePhoto}
                    >
                      Take Photo
                    </button>
                  )}
                  {/* Show Retake button only when a photo is captured */}
                  {preview && (
                    <button
                      type="button"
                      className="retake-photo-btn yellow-btn"
                      onClick={async () => {
                        setPhoto(null);
                        setPreview(null);
                        // Re-open camera for retake (keeps user gesture)
                        await openCamera();
                      }}
                    >
                      Retake
                    </button>
                  )}
                </div>
                {cameraActive && (
                  <div>
                    <video ref={videoRef} width="220" height="160" className="video-preview" autoPlay playsInline muted />
                    <canvas ref={canvasRef} width="220" height="160" style={{display:'none'}} />
                  </div>
                )}
                {/* Hidden file input for fallback/capture */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
                {preview && <img src={preview} alt="Preview" className="photo-preview" />}
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isSubmitting || (isSubmitted && name.trim())}
                  style={{
                    backgroundColor: isSubmitted && name.trim() ? 'grey' : '',
                    cursor: isSubmitted && name.trim() ? 'not-allowed' : 'pointer',
                  }}
                  title={isSubmitted && name.trim() ? 'Already submitted' : ''}
                >
                  {isSubmitting ? 'Submit' : isSubmitted && name.trim() ? 'Submitted' : 'Submit'}
                </button>
                {message && <div className="modal-message">{message}</div>}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<MainApp />} />
    <Route path="/start" element={<StartPage />} />
  <Route path="/admin" element={<AdminPage />} />
  <Route path="/" element={<WelcomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
