// ================= FRONTEND: App.jsx =================
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown'; 

//Start

const API = 'http://localhost:4000';

export default function App() {
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [mode, setMode] = useState('select');
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnn, setSelectedAnn] = useState(null);
  const [editingAnn, setEditingAnn] = useState(null);

  const contentRef = useRef(null);
  const [fontSize, setFontSize] = useState({
    title: 120,
    subtitle: 60,
    content: 40
  });

  useEffect(() => {
  if (announcements.length > 0 && !selectedAnn) {
    setSelectedAnn(announcements[0]);
  }
}, [announcements]);

  useEffect(() => {
    axios.get(`${API}/events`).then(res => setEvents(res.data));
  }, []);

  const loadAnnouncements = (eventId) => {
    axios.get(`${API}/announcements/${eventId}`).then(res => setAnnouncements(res.data));
  };

  useEffect(() => {
  if (!contentRef.current) return;

  const el = contentRef.current;

  let titleSize = 120;
  let subtitleSize = 60;
  let contentSize = 40;

  const fitText = () => {
    let attempts = 0;

    const isOverflowing = () => {
      // Force browser reflow BEFORE measuring
      el.getBoundingClientRect();

      return el.scrollHeight > el.clientHeight;
    };

    while (isOverflowing() && attempts < 100) {
      titleSize *= 0.85;
      subtitleSize *= 0.85;
      contentSize *= 0.85;

      el.style.setProperty('--title-size', `${titleSize}px`);
      el.style.setProperty('--subtitle-size', `${subtitleSize}px`);
      el.style.setProperty('--content-size', `${contentSize}px`);

      attempts++;
    }

    setFontSize({
      title: titleSize,
      subtitle: subtitleSize,
      content: contentSize
    });
  };

  // Reset before fitting
  el.style.setProperty('--title-size', `120px`);
  el.style.setProperty('--subtitle-size', `60px`);
  el.style.setProperty('--content-size', `40px`);

  setTimeout(fitText, 50);

}, [selectedAnn]);

  // EVENT SELECT PAGE
  if (mode === 'select') {
    return (
      <div className="event-select">
        <h1 className="event-title">Select Event</h1>

        <div className="event-list">
          {events.map(e => (
            <div key={e.id} className="event-item">

              <button
                className="event-button"
                onClick={() => {
                  setCurrentEvent(e);
                  loadAnnouncements(e.id);
                  setMode('announce');
                }}
              >
                {e.title}
              </button>

              <button
                className="delete-button"
                onClick={async () => {
                  const confirmDelete = window.confirm(
                    `Delete event "${e.title}"? This cannot be undone.`
                  );

                  if (!confirmDelete) return;

                  await axios.delete(`${API}/events/${e.id}`);

                  setEvents(prev => prev.filter(ev => ev.id !== e.id));
                }}
              >
                ✕
              </button>

            </div>
          ))}

          <button
            className="event-button new"
            onClick={async () => {
              const title = prompt('Event Name');
              const location = prompt('Event Location');
              const fieldName = prompt('Field Name (optional)');

              const res = await axios.post(`${API}/events`, {
                title,
                location,
                fieldName
              });
              window.location.reload();
            }}
          >
            + New Event
          </button>
        </div>
      </div>
    );
  }

  // NAV BAR
  const Nav = () => (
    <div className='navbar'>
      <button onClick={() => setMode('select')}>Event Select</button>
      <button onClick={() => setMode('announce')}>Announce Mode</button>
      <button onClick={() => setMode('edit')}>Edit Mode</button>
      <button onClick={() => setMode('gameRef')}>Game Reference</button>
    </div>
  );

  // EDIT MODE
  if (mode === 'edit') {
  return (
    <div>
      <Nav />
      <h2>Edit Announcements</h2>

      {/* ===== FORM VIEW ===== */}
      {editingAnn && (
        <div className='main'>
          <div
            className="card"
            ref={contentRef}
            style={{
              height: '100%',
              overflow: 'hidden'
            }}
          >
          <h3>{editingAnn.id ? 'Edit Announcement' : 'New Announcement'}</h3>

          <input
            placeholder="Title"
            value={editingAnn.title}
            onChange={(e) =>
              setEditingAnn({ ...editingAnn, title: e.target.value })
            }
            style={{ display: 'block', marginBottom: 10, width: '100%' }}
          />

          <input
            placeholder="Subtitle"
            value={editingAnn.subtitle}
            onChange={(e) =>
              setEditingAnn({ ...editingAnn, subtitle: e.target.value })
            }
            style={{ display: 'block', marginBottom: 10, width: '100%' }}
          />

          <textarea
            placeholder="Markdown Content"
            value={editingAnn.content}
            onChange={(e) =>
              setEditingAnn({ ...editingAnn, content: e.target.value })
            }
            style={{ display: 'block', marginBottom: 10, width: '100%', height: 150 }}
          />

          {/* Parent Dropdown */}
          <select
            value={editingAnn.parentId || ''}
            onChange={(e) =>
              setEditingAnn({
                ...editingAnn,
                parentId: e.target.value || null
              })
            }
            style={{ display: 'block', marginBottom: 10 }}
          >
            <option value="">Home (No Parent)</option>
            {announcements.map(a => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>

          {/* Buttons */}
          <button
            onClick={async () => {
              if (editingAnn.id) {
                await axios.put(
                  `${API}/announcements/${editingAnn.id}`,
                  editingAnn
                );
              } else {
                await axios.post(`${API}/announcements`, {
                  ...editingAnn,
                  eventId: currentEvent.id
                });
              }

              setEditingAnn(null);
              loadAnnouncements(currentEvent.id);
            }}
          >
            Save
          </button>

          <button
            className="secondary"
            onClick={() => setEditingAnn(null)}
            style={{ marginLeft: 10 }}
          >
            Cancel
          </button>
          </div>
        </div>
      )}

      {/* ===== LIST VIEW ===== */}
      {!editingAnn && (
        <div>
          <button onClick={() => {
            setEditingAnn({
              id: null,
              title: '',
              subtitle: '',
              content: '',
              parentId: null
            });
          }}>
            New Announcement
          </button>

          {announcements.map(a => (
            <div key={a.id}>
              <strong>{a.title}</strong>

              <button onClick={() => setEditingAnn(a)}>
                Edit
              </button>

              <button onClick={async () => {
                await axios.delete(`${API}/announcements/${a.id}`);
                loadAnnouncements(currentEvent.id);
              }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

  // ANNOUNCE MODE
if (mode === 'announce') {
  return (
    <div>
      <Nav />

      <div className="container">
        
        {/* SIDEBAR */}
        <div className="sidebar">

          {/* HOME CARD (NEW) */}
          {currentEvent && (
            <div className="home-card">
              <h2>{currentEvent.title}</h2>

              {currentEvent.location && (
                <p>📍 {currentEvent.location}</p>
              )}

              {currentEvent.fieldName && (
                <p>🏟 {currentEvent.fieldName}</p>
              )}
            </div>
          )}

          {/* ANNOUNCEMENTS */}
          {announcements.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAnn(a)}
            >
              {a.title}
            </button>
          ))}
        </div>

        {/* MAIN CONTENT */}
        <div className="main">
          <div className="card">
            {!selectedAnn && <p>Select an announcement</p>}

            {selectedAnn && (
              <div>
                <h1 style={{ fontSize: 'var(--title-size)', marginBottom: 10 }}>
                  {selectedAnn.title}
                </h1>

                <h2 style={{ fontSize: 'var(--subtitle-size)', marginBottom: 20 }}>
                  {selectedAnn.subtitle}
                </h2>

                <div style={{ fontSize: 'var(--content-size)' }}>
                  <ReactMarkdown>{selectedAnn.content}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}


  // GAME REFERENCE
  if (mode === 'gameRef') {
    return (
      <div>
        <Nav />

        {!currentEvent.gameRef && (
          <input type="file" onChange={async (e) => {
            const formData = new FormData();
            formData.append('image', e.target.files[0]);
            const res = await axios.post(`${API}/upload/${currentEvent.id}`, formData);
            setCurrentEvent({ ...currentEvent, gameRef: res.data.path });
          }} />
        )}

        {currentEvent.gameRef && (
          <img src={`${API}/${currentEvent.gameRef}`} style={{ width: '100%' }} />
        )}
      </div>
    );
  }

  return null;
}
