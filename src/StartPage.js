import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import { listParticipantPhotos, downloadS3Object } from './s3Service';
import SpinningCircleGame from './SpinningCircleGame';

const PARTICIPANT_SIZE = 80;

function StartPage() {
  const [participants, setParticipants] = useState([]);
  //const [circleParticipants, setCircleParticipants] = useState([]);
  // Initialize with 6 null slots so we don't need to adjust state inside effects
  const [circleParticipants, setCircleParticipants] = useState(() => Array.from({ length: 6 }).map(() => null));
  const [completedParticipants, setCompletedParticipants] = useState([]);
  const spinningRef = useRef(null);

  useEffect(() => {
    async function fetchParticipants() {
      const keys = await listParticipantPhotos();
      // Filter out unwanted images (e.g., not ending with .jpg or not matching expected pattern)
      const filteredKeys = keys.filter(key => /incoming-participents\/[A-Za-z0-9_]+\.jpg$/.test(key));
      const items = await Promise.all(filteredKeys.map(async key => {
        const name = key.split('/').pop().replace('.jpg', '').replace(/_/g, ' ');
        const photoBlob = await downloadS3Object(key);
        const photoUrl = URL.createObjectURL(photoBlob);
        const photoFileName = key.split('/').pop();
        return { name, photoUrl, photoFileName };
      }));
      // Reverse so new participants enter from the right
      setParticipants(items.reverse());
    }
    fetchParticipants();
  }, []);

    // Ensure circleParticipants always has 6 entries (null for vacant)
  // useEffect(() => {
  //   if (circleParticipants.length < 6) {
  //     setCircleParticipants(prev => {
  //       const arr = [...prev];
  //       while (arr.length < 6) arr.push(null);
  //       return arr;
  //     });
  //   }
  // }, [circleParticipants]);

  // Find first vacant chair index (null entry)
  const getVacantChairIdx = () => circleParticipants.findIndex(p => p == null);

  // Add to first vacant chair, or append if less than 6
  const addToCircle = (idx) => {
    const vacantIdx = getVacantChairIdx();
    if (vacantIdx !== -1) {
      const newCircle = [...circleParticipants];
      newCircle[vacantIdx] = participants[idx];
      setCircleParticipants(newCircle);
      setParticipants(participants.filter((_, i) => i !== idx));
    }
  };

  // Remove from circle sets spot to null
  const removeFromCircle = (idx) => {
    setParticipants([circleParticipants[idx], ...participants]);
    const newCircle = [...circleParticipants];
    newCircle[idx] = null;
    setCircleParticipants(newCircle);
  };

  // Automatically add next participant from queue to vacated chair
  const handleVacantChair = (updatedChairs) => {
    let newCircle = [...updatedChairs];
    const vacantIdx = newCircle.findIndex(p => p == null);
    if (participants.length > 0 && vacantIdx !== -1) {
      newCircle[vacantIdx] = participants[0];
      setCircleParticipants(newCircle);
      setParticipants(participants.slice(1));
    } else {
      setCircleParticipants(newCircle);
    }
  };

  return (
    <div className="wallpaper-container">
      {/* Change wallpaper image here */}
      <img src={require('./images/startmain2.jpeg')} alt="Wallpaper" className="wallpaper" />
      {/* SpinningCircleGame component at center */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 30 }}>
        <SpinningCircleGame circleParticipants={circleParticipants} onVacantChair={handleVacantChair} onCompletedChange={setCompletedParticipants} />
      </div>
      {/* Participants queue panel - vertical, left side */}
      <div className="participants-panel" style={{
  position: 'fixed',
  left: 32,
  top: 0,
  height: '100vh',
  minWidth: 120,
  maxWidth: 180,
  zIndex: 20,
  background: 'rgba(135, 206, 235, 0.7)', // sky blue
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'center',
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  borderRadius: '16px'
}}>
        <h3 style={{ marginTop: 18 }}>Participants Queue</h3>
        <div className="participants-queue flex-col gap-2 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 60px)', width: '100%', alignItems: 'center', paddingTop: 12 }}>
          {participants.map((p, idx) => (
            <div className="participant-card" key={idx} style={{ minWidth: 'unset', alignItems: 'center' }}>
              <img src={p.photoUrl} alt={p.name} className="participant-photo w-12 h-12" />
              <div className="participant-name" style={{ fontSize: '0.85rem', width: 48 }}>{p.name}</div>
              {/* Single Add button for each participant */}
              <button className="add-btn" onClick={() => addToCircle(idx)} disabled={getVacantChairIdx() === -1} style={{ fontSize: '0.8rem', padding: '2px 8px' }}>Add</button>
            </div>
          ))}
        </div>
      </div>
      {/* Completed participants panel - fixed on the right */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 40 }}>
        <div style={{ background: '#fff8', borderRadius: 12, padding: '12px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', minWidth: 140, maxWidth: '40vw', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
          <h3 style={{ margin: 0, marginBottom: 8, color: '#800000' }}>Completed</h3>
          {completedParticipants.map((p, idx) => {
            if (!p || !p.photoUrl) return null;
            const displayName = p.name.replace(/\.[^/.]+$/, '');
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <img src={p.photoUrl} alt={displayName} style={{ width: 36, height: 36, borderRadius: '50%', marginRight: 8, border: '2px solid #ffe066' }} />
                <span style={{ fontWeight: 600, color: '#222' }}>{displayName}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default StartPage;
