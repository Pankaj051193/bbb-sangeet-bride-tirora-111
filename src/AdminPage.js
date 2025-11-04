import React, { useEffect, useState } from 'react';
import './App.css';
import { listParticipantPhotos, listCompletedParticipantPhotos, downloadS3Object, deleteS3Object, moveCompletedToIncoming } from './s3Service';

function keyToName(key) {
  return key.split('/').pop().replace('.jpg','').replace(/_/g,' ');
}

export default function AdminPage() {
  const [incoming, setIncoming] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLists = async () => {
    setLoading(true);
    try {
      const incKeys = await listParticipantPhotos();
      const compKeys = await listCompletedParticipantPhotos();
      // Build items with thumbnails
      const toItems = async (keys) => {
        return Promise.all(keys.map(async key => {
          const blob = await downloadS3Object(key);
          return { key, name: keyToName(key), photoUrl: URL.createObjectURL(blob) };
        }));
      };
      const inc = await toItems(incKeys);
      const comp = await toItems(compKeys);
      setIncoming(inc);
      setCompleted(comp);
    } catch (e) {
      console.error('Failed to load lists', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Schedule asynchronously to avoid calling setState synchronously inside the effect
    const t = setTimeout(() => { fetchLists(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleDelete = async (key) => {
    if (!confirm('Delete this file from S3?')) return;
    try {
      await deleteS3Object(key);
      await fetchLists();
    } catch (e) { console.error(e); alert('Delete failed'); }
  };

  const handleMoveBack = async (key) => {
    const fileName = key.split('/').pop();
    if (!confirm('Move this file back to incoming?')) return;
    try {
      await moveCompletedToIncoming(fileName);
      await fetchLists();
    } catch (e) { console.error(e); alert('Move failed'); }
  };

  return (
    <div className="wallpaper-container">
      <h1 style={{ textAlign: 'center', marginTop: 24 }}>Admin</h1>
      <div style={{ display: 'flex', gap: 24, padding: 24, justifyContent: 'center' }}>
        <div style={{ width: 320 }}>
          <h3>Incoming Participants</h3>
          <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}>
            {incoming.length === 0 && <div>No incoming participants</div>}
            {incoming.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <img src={p.photoUrl} alt={p.name} style={{ width: 48, height: 48, borderRadius: 8, marginRight: 8 }} />
                <div style={{ flex: 1 }}>{p.name}</div>
                <button className="remove-btn" onClick={() => handleDelete(p.key)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 320 }}>
          <h3>Completed Participants</h3>
          <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}>
            {completed.length === 0 && <div>No completed participants</div>}
            {completed.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <img src={p.photoUrl} alt={p.name} style={{ width: 48, height: 48, borderRadius: 8, marginRight: 8 }} />
                <div style={{ flex: 1 }}>{p.name}</div>
                <button className="add-btn" onClick={() => handleMoveBack(p.key)}>Move</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {loading && <div style={{ position: 'fixed', bottom: 12, right: 12, background: '#fff8', padding: 8, borderRadius: 8 }}>Loading...</div>}
    </div>
  );
}
