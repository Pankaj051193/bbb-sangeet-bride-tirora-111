import React, { useRef, useState, useEffect } from 'react';
import './App.css';

export default function WelcomePage() {
  const videoRef = useRef(null);
  // Start unmuted by default; if browser blocks autoplay with sound we'll fallback to muted
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Try to play with sound. If the browser blocks it, fall back to muted autoplay.
    const p = v.play();
    if (p && p.catch) {
      p.catch(() => {
        try {
          v.muted = true;
          setMuted(true);
          v.play().catch(() => {});
        } catch (e) {}
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    // Toggle muted state and ensure playback/resume
    v.muted = !v.muted;
    setMuted(v.muted);
    // Some browsers require a user gesture to allow sound — play() after user click
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  };

  return (
    <div className="welcome-video-container">
      <video
        ref={videoRef}
        className="welcome-video"
        src={require('./music/Welcome.mp4')}
        autoPlay
        muted={muted}
        loop
        playsInline
      />
      <div className="welcome-overlay">        
        <button className="unmute-btn" onClick={toggleMute} aria-pressed={!muted}>
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </div>
  );
}
