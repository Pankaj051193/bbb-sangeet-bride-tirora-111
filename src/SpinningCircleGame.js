import React, { useRef, useState, useMemo, useEffect } from "react";
import { moveParticipantPhotoToCompleted, listCompletedParticipantPhotos, downloadS3Object } from "./s3Service";

export default function SpinningCircleGame({ circleParticipants = [], onVacantChair, onCompletedChange }) {
  const FRAME_COUNT = 6;
  // Make the circle scale based on viewport width for mobile friendliness
  const [size, setSize] = React.useState(() => Math.min(420, Math.floor((typeof window !== 'undefined' ? window.innerWidth : 420) * 0.85)));
  React.useEffect(() => {
    const onResize = () => setSize(Math.min(420, Math.floor(window.innerWidth * 0.85)));
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const radius = Math.floor(size * 0.57); // proportional to previous 240/420
  const frameW = Math.floor(size * 0.43); // proportional to previous 180/420
  const frameH = Math.floor(size * 0.24); // proportional to previous 100/420
  const musics =['m1.mp3','m2.mp3','m3.mp3','m4.mp3'];
  var randomMusic = musics[0];
  // Initial frames (can be empty or seeded)
  const defaultFrames = [
    { id: 1, label: "A", color: "#e57373" },
    { id: 2, label: "B", color: "#64b5f6" },
    { id: 3, label: "C", color: "#81c784" },
    { id: 4, label: "D", color: "#ffd54f" },
    { id: 5, label: "E", color: "#ba68c8" },
    { id: 6, label: "F", color: "#ffb74d" },
  ];

 
  // Rotation state
  const rotRef = useRef(0);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [circleRotation, setCircleRotation] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [winners, setWinners] = useState([]);
  const [completedParticipants, setCompletedParticipants] = useState([]);
  const audioRef = useRef(null);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const animRef = useRef(null);
  const [activeParticipants, setActiveParticipants] = useState(circleParticipants);

   // Use participants for frames if available
  const frames = useMemo(() => {
    return defaultFrames.map((frame, idx) => {
      const participant = activeParticipants[idx];
      return participant
        ? { ...frame, participant }
        : frame;
    });
  }, [activeParticipants]);

  // Calculate positions for 6 frames in a circle
  const positions = useMemo(() => {
    return frames.map((f, i) => {
      const angle = (i / FRAME_COUNT) * 2 * Math.PI;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      return { ...f, x, y, angle };
    });
  }, [frames]);

  const ARROW_ANGLE = 0; // right side

  function startSpinWithMusic() {
    if (isSpinning) return;
    setIsSpinning(true);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setAudioDuration(audioRef.current.duration * 1000);
    }
    let start;
    let lastAngle = circleRotation;
    let lastTimestamp;
    const minSpeed = 0.02; // deg/ms (very slow)
    const maxSpeed = 0.2; // deg/ms (fast)
    let speed = minSpeed;
    let accelTime = 3000; // ms to reach max speed
    let decelTime = 3000; // ms to slow down
    let musicDuration = 0;
    randomMusic = musics[Math.floor(Math.random() * musics.length)];
    console.log("Music : "+randomMusic);
    function step(t) {
      if (!start) {
        start = t;
        lastTimestamp = t;
        musicDuration = audioRef.current?.duration ? audioRef.current.duration * 1000 : 10000;
      }
      const elapsed = t - start;
      // Acceleration phase
      if (elapsed < accelTime) {
        // Ease out cubic for acceleration
        const k = elapsed / accelTime;
        speed = minSpeed + (maxSpeed - minSpeed) * (1 - Math.pow(1 - k, 3));
      }
      // Constant speed phase
      else if (elapsed < musicDuration - decelTime) {
        speed = maxSpeed;
      }
      // Deceleration phase
      else if (elapsed < musicDuration) {
        // Ease in cubic for deceleration
        const k = (elapsed - (musicDuration - decelTime)) / decelTime;
        speed = maxSpeed - (maxSpeed - minSpeed) * (k * k * k);
      }
      // Stop if music ended
      if (audioRef.current && audioRef.current.paused) {
        // Find the closest chair to the arrow after final rotation
        const finalRotation = lastAngle % 360;
        let minDiff = 360;
        let snapDelta = 0;
        let validChairs = positions.filter(frame => frame.participant);
        validChairs.forEach((frame) => {
          const chairAngle = (frame.angle * 180 / Math.PI + finalRotation) % 360;
          let diff = Math.abs((chairAngle - ARROW_ANGLE + 360) % 360);
          if (diff > 180) diff = 360 - diff;
          if (diff < minDiff) {
            minDiff = diff;
            snapDelta = ARROW_ANGLE - chairAngle;
          }
        });
        setCircleRotation(lastAngle + snapDelta);
        // Find and set the selected participant index (only non-vacant)
        let closestIdx = null;
        minDiff = 360;
        validChairs.forEach((frame, idx) => {
          const chairAngle = (frame.angle * 180 / Math.PI + lastAngle + snapDelta) % 360;
          let diff = Math.abs((chairAngle - ARROW_ANGLE + 360) % 360);
          if (diff > 180) diff = 360 - diff;
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = positions.findIndex(pos => pos.id === frame.id);
          }
        });
        setSelectedIdx(closestIdx);
        // Move selected participant photo to completed S3 bucket
        const selectedFrame = positions[closestIdx];
        console.log('Moving to completed:', selectedFrame);
        if (selectedFrame && selectedFrame.participant && selectedFrame.participant.photoFileName) {
          (async () => {
            try {
              await moveParticipantPhotoToCompleted(selectedFrame.participant.photoFileName);
              // Refresh completed panel after moving
              const completedKeys = await listCompletedParticipantPhotos();
              const completedItems = await Promise.all(
                completedKeys.map(async (key) => {
                  const photoUrl = URL.createObjectURL(await downloadS3Object(key));
                  const fileName = key.split('/').pop();
                  return {
                    name: fileName,
                    photoUrl,
                    photoFileName: fileName,
                  };
                })
              );
              const reversed = completedItems.reverse();
              setCompletedParticipants(reversed);
              if (onCompletedChange) onCompletedChange(reversed);
              console.log('Moved to completed and refreshed panel:', selectedFrame.participant.photoFileName);
            } catch (err) {
              console.error('Failed to move to completed:', err);
            }
          })();
        } else {
          console.warn('No valid photoFileName for selected participant:', selectedFrame?.participant);
        }
        setIsSpinning(false);
        return;
      }
      // Rotate
      const dt = t - lastTimestamp;
      lastAngle = (lastAngle + speed * dt) % 360;
      setCircleRotation(lastAngle);
      lastTimestamp = t;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function getClosestChairIdx(currentRotation) {
    // Find which chair is closest to the arrow (right side)
    let minDiff = 360;
    let closestIdx = 0;
    positions.forEach((frame, idx) => {
      // Calculate chair's current angle in degrees
      const chairAngle = (frame.angle * 180 / Math.PI + currentRotation) % 360;
      let diff = Math.abs((chairAngle - ARROW_ANGLE + 360) % 360);
      if (diff > 180) diff = 360 - diff;
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    return closestIdx;
  }

  // Remove winner from active participants only when popup is closed
  const handleClosePopup = () => {
    if (selectedIdx !== null) {
      // Add winner to history
      if (frames[selectedIdx] && frames[selectedIdx].participant) {
        setWinners(prev => [...prev, frames[selectedIdx].participant]);
      }
      setActiveParticipants(prev => {
        const updated = [...prev];
        updated[selectedIdx] = null;
        // Notify parent about the updated chair array
        if (onVacantChair) onVacantChair(updated);
        return updated;
      });
      setSelectedIdx(null);
    }
  };

  useEffect(() => {
    setActiveParticipants(circleParticipants);
  }, [circleParticipants]);

  useEffect(() => {
    async function fetchCompletedParticipants() {
      const completedKeys = await listCompletedParticipantPhotos();
      const completedItems = await Promise.all(
        completedKeys.map(async (key) => {
          const photoUrl = URL.createObjectURL(await downloadS3Object(key));
          const fileName = key.split('/').pop();
          return {
            name: fileName,
            photoUrl,
            photoFileName: fileName,
          };
        })
      );
      const reversed = completedItems.reverse();
      setCompletedParticipants(reversed);
      if (onCompletedChange) onCompletedChange(reversed);
    }
    fetchCompletedParticipants();
  }, []);

  return (
    <div>
      <div style={{
        position: "relative",
        width: size + 120, // more space for arrow
        height: size,
        maxWidth: '100%'
      }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
            transform: `rotate(${circleRotation}deg)`,
          }}
        >
          {/* Only frames, no circle or background */}
          {positions.map((frame, idx) => (
            <div
              key={frame.id}
              style={{
                position: "absolute",
                left: size / 2 + frame.x - frameW / 2,
                top: size / 2 + frame.y - frameH / 2,
                width: frameW,
                height: frameH,
                background: "transparent",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                // Each chair rotates in the opposite direction to keep upright
                transform: `rotate(${-circleRotation}deg)`,
              }}
            >
              {/* Chair back (rounded, slightly taller) */}
              <div
                style={{
                  width: frameW * 0.7,
                  height: frameH * 0.5,
                  background: frame.color,
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 32,
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                  boxShadow: "0 4px 16px #800000",
                  border: "3px solid #fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 28,
                  color: "#fff",
                  position: "relative",
                  marginBottom: -10,
                }}
              >
                {/* Show participant image if present */}
                {frame.participant ? (
                  <img
                    src={frame.participant.photoUrl}
                    alt={frame.participant.name}
                    style={{
                      width: 130,
                      height: 130,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #fff",
                      boxShadow: "0 2px 8px #800000",
                      marginRight: 8,
                      marginTop: -65, // adjust upward to keep it visually centered
                    }}
                  />
                ) : (
                  frame.label
                )}
                
              </div>
              {/* Chair seat (thicker, with shadow) */}
              <div
                style={{
                  width: frameW * 0.85,
                  height: frameH * 0.22,
                  background: frame.color,
                  borderRadius: 16,
                  marginTop: -8,
                  boxShadow: "0 6px 16px #800000",
                  border: "3px solid #fff",
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Seat shadow */}
                <div
                  style={{
                    position: "absolute",
                    bottom: -8,
                    left: "10%",
                    width: "80%",
                    height: 10,
                    background: "#800000",
                    borderRadius: 8,
                    opacity: 0.18,
                    zIndex: 0,
                  }}
                />
                {/* Add participant name here */}
                {frame.participant && (
                  <span
                    style={{
                      position: "relative",
                      zIndex: 2,
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 18,
                      textShadow: "1px 1px 6px #000",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "80%",
                    }}
                  >
                    {frame.participant.name}
                  </span>
                )}
              </div>
              {/* Chair legs (4 legs, metallic look) */}
              <div
                style={{
                  display: "flex",
                  width: frameW * 0.7,
                  justifyContent: "space-between",
                  marginTop: 2,
                  position: "relative",
                  zIndex: 0,
                }}
              >
                {[0, 1, 2, 3].map((leg) => (
                  <div
                    key={leg}
                    style={{
                      width: 10,
                      height: 28,
                      background: "linear-gradient(180deg,#eee,#bbb 80%,#800000 100%)",
                      borderRadius: 4,
                      boxShadow: "0 2px 8px #800000",
                      marginLeft: leg === 0 ? 0 : 4,
                      marginRight: leg === 3 ? 0 : 4,
                    }}
                  />
                ))}
              </div>
              {/* Chair armrests */}
              <div
                style={{
                  position: "absolute",
                  top: frameH * 0.55,
                  left: frameW * 0.08,
                  width: frameW * 0.84,
                  height: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: frameW * 0.22,
                    height: 12,
                    background: frame.color,
                    borderRadius: 8,
                    border: "2px solid #fff",
                    boxShadow: "0 2px 8px #800000",
                  }}
                />
                <div
                  style={{
                    width: frameW * 0.22,
                    height: 12,
                    background: frame.color,
                    borderRadius: 8,
                    border: "2px solid #fff",
                    boxShadow: "0 2px 8px #800000",
                  }}
                />
              </div>
            </div>
          ))}
          {/* Centered Start button (not rotating) */}
        </div>
        <button
          style={{
            position: "absolute",
            left: Math.max(8, size / 2 - 60),
            top: size / 2 - 32,
            width: Math.min(140, Math.floor(size * 0.28)),
            height: Math.min(80, Math.floor(size * 0.15)),
            background: isSpinning ? "#aaa" : "#800000",
            color: "#fff",
            borderRadius: 32,
            fontWeight: 700,
            fontSize: Math.min(28, Math.floor(size * 0.06)),
            border: "none",
            boxShadow: "0 8px 20px rgba(80,0,0,0.18)",
            cursor: isSpinning ? "not-allowed" : "pointer",
            opacity: isSpinning ? 0.6 : 1,
            zIndex: 30,
            pointerEvents: isSpinning ? "none" : "auto",
          }}
          onClick={startSpinWithMusic}
          disabled={isSpinning}
        >
          Start
        </button>
      </div>
      {/* Static arrow at further right and more towards the top of the circle */}
      <div style={{
        position: "absolute",
        right: -32,
        top: Math.max(8, size / 2 - 36),
        width: Math.min(48, Math.floor(size * 0.11)),
        height: Math.min(48, Math.floor(size * 0.11)),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
      }}>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <polygon points="0,20 28,8 28,16 40,16 40,24 28,24 28,32" fill="#800000" stroke="#fff" strokeWidth="3" />
        </svg>
      </div>
  {/* Add audio element for music */}
  
  <audio ref={audioRef} src={require("./music/"+ randomMusic)} onEnded={() => setIsSpinning(false)} />

      {selectedIdx !== null && positions[selectedIdx] && positions[selectedIdx].participant && (
        <>
          <div />
          {/* Pop-up */}
          <div
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              width: 'min(90vw, 660px)',
              maxHeight: '90vh',
              overflowY: 'auto',
              transform: "translate(-50%,-50%)",
              zIndex: 100,
              display: "flex",
              backdropFilter: "blur(8px)",
              flexDirection: "column",
              alignItems: "center",
              padding: 16,
              animation: "popUp 0.5s cubic-bezier(.25,1.5,.5,1) forwards"
            }}
          >
            <img
              src={positions[selectedIdx].participant.photoUrl}
              alt={positions[selectedIdx].participant.name}
              style={{
                width: 'min(60vw, 260px)',
                height: 'min(60vw, 260px)',
                borderRadius: "50%",
                border: "6px solid #ffe066",
                boxShadow: "0 12px 48px #80000088",
                objectFit: "cover",
                background: "#fff",
                marginBottom: 24,
              }}
            />
            <div
              style={{
                color: "#fff",
                fontWeight: 900,
                fontSize: "2rem",
                background: "#080808cc",
                padding: "18px 48px",
                borderRadius: 28,
                boxShadow: "0 4px 24px #80000055",
                textShadow: "2px 2px 12px #000",
                marginBottom: 24,
              }}
            >
              {positions[selectedIdx].participant.name}
            </div>
            <button
              onClick={handleClosePopup}
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                padding: "10px 32px",
                borderRadius: 18,
                background: "#800000",
                color: "#fff",
                border: "none",
                boxShadow: "0 2px 12px #80000044",
                cursor: "pointer",
                marginTop: 12,
              }}
            >
              Close
            </button>
          </div>
        </>
      )}
      
      {/* Completed panel moved to parent component to avoid positioning inside transformed ancestor */}
      <style>
        {`
          @keyframes popUp {
            0% {
              opacity: 0;
              transform: translate(-50%,-50%) scale(0.7);
            }
            100% {
              opacity: 1;
              transform: translate(-50%,-50%) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
}

/* CSS in JS - Global styles */
const globalStyles = `
  .blur-overlay-global {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.3);
    backdrop-filter: blur(8px);
    z-index: 99;
    pointer-events: none;
  }
`;

// Inject global styles
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = globalStyles;
document.head.appendChild(styleSheet);
