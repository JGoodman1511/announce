// ================= FRONTEND: App.jsx =================
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown'; 

const API = 'http://localhost:4000';

export default function App() {
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [mode, setMode] = useState('select');
  const [announcements, setAnnouncements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedAnn, setSelectedAnn] = useState(null);
  const [editingAnn, setEditingAnn] = useState(null);

  // New: Track which categories are minimized
  const [minimizedCategories, setMinimizedCategories] = useState(new Set());

  const contentRef = useRef(null);

  const fitText = (el) => {
    if (!el) return;
    const content = el.querySelector('.announce-content');
    if (!content) return;

    let contentSize = 80;
    const TITLE_RATIO = 1.5;
    const SUBTITLE_RATIO = 1.2;

    const fits = () => {
      const containerRect = el.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      return (
        contentRect.height <= containerRect.height &&
        contentRect.width <= containerRect.width
      );
    };

    let attempts = 0;
    while (!fits() && attempts < 100) {
      contentSize *= 0.85;
      el.style.setProperty('--content-size', `${contentSize}px`);
      el.style.setProperty('--subtitle-size', `${contentSize * SUBTITLE_RATIO}px`);
      el.style.setProperty('--title-size', `${contentSize * TITLE_RATIO}px`);
      attempts++;
    }
  };

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

  const loadCategories = (eventId) => {
    axios.get(`${API}/categories/${eventId}`).then(res => setCategories(res.data));
  };

  useEffect(() => {
    if (currentEvent?.id) {
      loadAnnouncements(currentEvent.id);
      loadCategories(currentEvent.id);
      setMinimizedCategories(new Set()); // Reset minimized state when switching events
    }
  }, [currentEvent?.id]);

  useEffect(() => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    const BASE_CONTENT = 80;
    el.style.setProperty('--content-size', `${BASE_CONTENT}px`);
    el.style.setProperty('--subtitle-size', `${BASE_CONTENT * 1.2}px`);
    el.style.setProperty('--title-size', `${BASE_CONTENT * 1.5}px`);
    void el.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => fitText(el)));
  }, [selectedAnn?.id]);

  const toggleHighlight = async (ann) => {
    const newHighlight = !ann.highlight;
    await axios.put(`${API}/announcements/${ann.id}`, { ...ann, highlight: newHighlight });
    setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, highlight: newHighlight } : a));
    if (selectedAnn?.id === ann.id) {
      setSelectedAnn({ ...ann, highlight: newHighlight });
    }
  };

  const toggleMinimize = (categoryId) => {
    setMinimizedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Reorder helpers
  const moveCategoryUp = (index) => {
    if (index <= 0) return;
    const newCategories = [...categories];
    [newCategories[index], newCategories[index - 1]] = [newCategories[index - 1], newCategories[index]];
    const orderedIds = newCategories.map(c => c.id);
    axios.post(`${API}/categories/reorder`, { eventId: currentEvent.id, orderedIds })
      .then(() => setCategories(newCategories));
  };

  const moveCategoryDown = (index) => {
    if (index >= categories.length - 1) return;
    const newCategories = [...categories];
    [newCategories[index], newCategories[index + 1]] = [newCategories[index + 1], newCategories[index]];
    const orderedIds = newCategories.map(c => c.id);
    axios.post(`${API}/categories/reorder`, { eventId: currentEvent.id, orderedIds })
      .then(() => setCategories(newCategories));
  };

  // EVENT SELECT (unchanged)
  if (mode === 'select') {
    return (
      <div className="event-select">
        <h1 className="event-title">Select Event</h1>
        <div className="event-list">
          {events.map(e => (
            <div key={e.id} className="event-item">
              <button className="event-button" onClick={() => { setCurrentEvent(e); setMode('announce'); }}>
                {e.title}
              </button>
              <button className="delete-button" onClick={async () => {
                if (!window.confirm(`Delete "${e.title}"?`)) return;
                await axios.delete(`${API}/events/${e.id}`);
                setEvents(prev => prev.filter(ev => ev.id !== e.id));
              }}>✕</button>
            </div>
          ))}
          <button className="event-button new" onClick={async () => {
            const title = prompt('Event Name');
            const location = prompt('Event Location');
            const fieldName = prompt('Field Name (optional)');
            await axios.post(`${API}/events`, { title, location, fieldName });
            window.location.reload();
          }}>+ New Event</button>
        </div>
      </div>
    );
  }

  const Nav = () => (
    <div className='navbar'>
      <button onClick={() => setMode('select')}>Event Select</button>
      <button onClick={() => setMode('announce')}>Announce</button>
      <button onClick={() => setMode('edit')}>Edit Cards</button>
      <button onClick={() => setMode('categories')}>Edit Categories</button>
      <button onClick={() => setMode('gameRef')}>Game Reference</button>
    </div>
  );

  // EDIT CATEGORIES (unchanged)
  if (mode === 'categories') {
    return (
      <div>
        <Nav />
        <div className="main" style={{ padding: '20px' }}>
          <h2>Edit Categories for {currentEvent?.title}</h2>
          <button onClick={async () => {
            const name = prompt('New Category Name');
            if (!name) return;
            await axios.post(`${API}/categories`, { eventId: currentEvent.id, name });
            loadCategories(currentEvent.id);
          }} style={{ marginBottom: '20px' }}>
            + New Category
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categories.map((cat, index) => (
              <div key={cat.id} className="category-item" style={{ display: 'flex', alignItems: 'center', background: '#2a2a2a', padding: '12px', borderRadius: '8px', gap: '12px' }}>
                <span style={{ flex: 1, fontSize: '18px' }}>{cat.name}</span>
                <button onClick={() => {
                  const newName = prompt('Edit name', cat.name);
                  if (newName && newName !== cat.name) {
                    axios.put(`${API}/categories/${cat.id}`, { name: newName })
                      .then(() => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: newName } : c)));
                  }
                }}>Edit</button>
                <button onClick={async () => {
                  if (!window.confirm(`Delete "${cat.name}"?`)) return;
                  await axios.delete(`${API}/categories/${cat.id}`);
                  loadCategories(currentEvent.id);
                }} className="delete-button">Delete</button>
                {index > 0 && <button onClick={() => moveCategoryUp(index)} style={{width:'40px'}}>↑</button>}
                {index < categories.length - 1 && <button onClick={() => moveCategoryDown(index)} style={{width:'40px'}}>↓</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // EDIT MODE (unchanged)
  if (mode === 'edit') {
    return (
      <div>
        <Nav />
        <h2>Edit Announcements</h2>
        {editingAnn && (
          <div className='main'>
            <div className="card" ref={contentRef} style={{ height: '100%', overflow: 'hidden' }}>
              <h3>{editingAnn.id ? 'Edit Announcement' : 'New Announcement'}</h3>
              <input placeholder="Title" value={editingAnn.title} onChange={e => setEditingAnn({...editingAnn, title: e.target.value})} style={{width:'100%', marginBottom:10}} />
              <input placeholder="Subtitle" value={editingAnn.subtitle} onChange={e => setEditingAnn({...editingAnn, subtitle: e.target.value})} style={{width:'100%', marginBottom:10}} />
              <textarea placeholder="Markdown Content" value={editingAnn.content} onChange={e => setEditingAnn({...editingAnn, content: e.target.value})} style={{width:'100%', height:150, marginBottom:10}} />
              <select value={editingAnn.categoryId || ''} onChange={e => setEditingAnn({...editingAnn, categoryId: e.target.value || null})} style={{width:'100%', marginBottom:10}}>
                <option value="">No Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={async () => {
                if (editingAnn.id) await axios.put(`${API}/announcements/${editingAnn.id}`, editingAnn);
                else await axios.post(`${API}/announcements`, {...editingAnn, eventId: currentEvent.id});
                setEditingAnn(null);
                loadAnnouncements(currentEvent.id);
              }}>Save</button>
              <button className="secondary" onClick={() => setEditingAnn(null)} style={{marginLeft:10}}>Cancel</button>
            </div>
          </div>
        )}
        {!editingAnn && (
          <div style={{ padding: '20px' }}>
            <button onClick={() => setEditingAnn({id:null, title:'', subtitle:'', content:'', categoryId:null})}>New Announcement</button>
            {announcements.map(a => (
              <div key={a.id} style={{display:'flex', alignItems:'center', gap:'12px', margin:'12px 0', padding:'10px', background:'#2a2a2a', borderRadius:'8px'}}>
                <strong style={{flex:1}}>{a.title}</strong>
                {a.categoryId && <span style={{fontSize:'13px', color:'#888'}}>📂 {categories.find(c=>c.id===a.categoryId)?.name}</span>}
                {a.highlight && <span style={{background:'#22c55e', color:'#000', padding:'2px 8px', borderRadius:'9999px', fontSize:'12px'}}>ANNOUNCED</span>}
                <button onClick={() => setEditingAnn(a)}>Edit</button>
                <button onClick={async () => { await axios.delete(`${API}/announcements/${a.id}`); loadAnnouncements(currentEvent.id); }}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ANNOUNCE MODE - With Minimize Feature
  if (mode === 'announce') {
    const groupedAnns = {};
    categories.forEach(cat => groupedAnns[cat.id] = { name: cat.name, anns: [] });
    const uncategorized = [];

    announcements.forEach(a => {
      if (a.categoryId && groupedAnns[a.categoryId]) {
        groupedAnns[a.categoryId].anns.push(a);
      } else {
        uncategorized.push(a);
      }
    });

    return (
      <div>
        <Nav />

        <div className="container">
          {/* SIDEBAR with Minimize Support */}
          <div className="sidebar">
            {currentEvent && (
              <div className="home-card">
                <h2>{currentEvent.title}</h2>
                {currentEvent.location && <p>📍 {currentEvent.location}</p>}
                {currentEvent.fieldName && <p>🏟 {currentEvent.fieldName}</p>}
              </div>
            )}

            {/* Categorized Announcements */}
            {categories.map(cat => {
              const isMinimized = minimizedCategories.has(cat.id);
              const catAnns = groupedAnns[cat.id]?.anns || [];
              return (
                <React.Fragment key={cat.id}>
                  <div 
                    className="category-label"
                    onClick={() => toggleMinimize(cat.id)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <span>{cat.name}</span>
                    <span style={{ fontSize: '18px', opacity: 0.8 }}>{isMinimized ? '▲' : '▼'}</span>
                  </div>
                  {!isMinimized && catAnns.map(a => (
                    <button
                      key={a.id}
                      className={`ann-button ${a.highlight ? 'highlighted' : ''}`}
                      onClick={() => setSelectedAnn(a)}
                    >
                      {a.title}
                    </button>
                  ))}
                </React.Fragment>
              );
            })}

            {/* Uncategorized */}
            {uncategorized.length > 0 && (
              <>
                <div 
                  className="category-label"
                  onClick={() => toggleMinimize('uncat')}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>Uncategorized</span>
                  <span style={{ fontSize: '18px', opacity: 0.8 }}>{minimizedCategories.has('uncat') ? '▲' : '▼'}</span>
                </div>
                {!minimizedCategories.has('uncat') && uncategorized.map(a => (
                  <button
                    key={a.id}
                    className={`ann-button ${a.highlight ? 'highlighted' : ''}`}
                    onClick={() => setSelectedAnn(a)}
                  >
                    {a.title}
                  </button>
                ))}
              </>
            )}

            {announcements.length === 0 && <p style={{ padding: '10px', color: '#666' }}>No announcements yet</p>}
          </div>

          {/* MAIN CONTENT */}
          <div className="main">
            <div className="card" ref={contentRef}>
              <div className="announce-content">
                {!selectedAnn && <p>Select an announcement from the sidebar</p>}

                {selectedAnn && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h1 className="title">{selectedAnn.title}</h1>
                      <button
                        onClick={() => toggleHighlight(selectedAnn)}
                        style={{
                          padding: '8px 16px',
                          background: selectedAnn.highlight ? '#ef4444' : '#22c55e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        {selectedAnn.highlight ? 'Announced' : 'Announce'}
                      </button>
                    </div>

                    <h2 className="subtitle">{selectedAnn.subtitle}</h2>
                    <div className="content">
                      <ReactMarkdown>{selectedAnn.content}</ReactMarkdown>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // GAME REFERENCE (full screen - unchanged from previous)
  if (mode === 'gameRef') {
    const handleRemove = async () => {
      if (!currentEvent?.gameRef) return;
      if (!window.confirm('Remove the current game reference image?')) return;
      try {
        await axios.delete(`${API}/gameRef/${currentEvent.id}`);
        setCurrentEvent({ ...currentEvent, gameRef: null });
      } catch (error) {
        alert('Failed to remove image. Is the server running?');
      }
    };

    return (
      <div>
        <Nav />
        {currentEvent?.gameRef ? (
          <div style={{ position: 'fixed', top: '50px', left: 0, right: 0, bottom: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img 
              src={`${API}/${currentEvent.gameRef}`} 
              alt="Game Reference"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
            />
            <button onClick={handleRemove} className="delete-button" style={{ position: 'absolute', top: '20px', right: '20px', padding: '12px 20px', fontSize: '16px' }}>
              🗑 Remove Image
            </button>
          </div>
        ) : (
          <div style={{ padding: '40px' }}>
            <h2>Game Reference Image</h2>
            <input type="file" accept="image/*" onChange={async (e) => {
              if (!e.target.files[0]) return;
              const formData = new FormData();
              formData.append('image', e.target.files[0]);
              const res = await axios.post(`${API}/upload/${currentEvent.id}`, formData);
              setCurrentEvent({ ...currentEvent, gameRef: res.data.path });
              e.target.value = '';
            }} style={{ fontSize: '18px' }} />
          </div>
        )}
      </div>
    );
  }

  return null;
}