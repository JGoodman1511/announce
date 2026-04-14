// ================= BACKEND: server.js =================
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const db = new sqlite3.Database('./events.db');

// Initialize DB
 db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    startDate TEXT,
    endDate TEXT,
    division TEXT,
    gameRef TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER,
    title TEXT,
    subtitle TEXT,
    content TEXT,
    parentId INTEGER
  )`);
});

// EVENTS
app.get('/events', (req, res) => {
  db.all('SELECT * FROM events', [], (err, rows) => res.json(rows));
});

app.post('/events', (req, res) => {
  const { title, startDate, endDate, division } = req.body;
  db.run(
    `INSERT INTO events (title, startDate, endDate, division) VALUES (?, ?, ?, ?)`,
    [title, startDate, endDate, division],
    function () {
      res.json({ id: this.lastID });
    }
  );
});

// COPY EVENT
app.post('/events/:id/copy', (req, res) => {
  const id = req.params.id;

  db.get('SELECT * FROM events WHERE id=?', [id], (err, event) => {
    db.run(
      `INSERT INTO events (title, startDate, endDate, division) VALUES (?, ?, ?, ?)`,
      [event.title + ' Copy', event.startDate, event.endDate, event.division],
      function () {
        const newEventId = this.lastID;

        db.all('SELECT * FROM announcements WHERE eventId=?', [id], (err, anns) => {
          anns.forEach(a => {
            db.run(
              `INSERT INTO announcements (eventId, title, subtitle, content, parentId)
               VALUES (?, ?, ?, ?, ?)`,
              [newEventId, a.title, a.subtitle, a.content, a.parentId]
            );
          });
          res.json({ id: newEventId });
        });
      }
    );
  });
});

// DELETE EVENTS
app.delete('/events/:id', (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM events WHERE id=?', [id], function (err) {
    if (err) return res.sendStatus(500);

    // also delete related announcements
    db.run('DELETE FROM announcements WHERE eventId=?', [id]);

    res.sendStatus(200);
  });
});


// ANNOUNCEMENTS
app.get('/announcements/:eventId', (req, res) => {
  db.all('SELECT * FROM announcements WHERE eventId=?', [req.params.eventId], (err, rows) => res.json(rows));
});

app.post('/announcements', (req, res) => {
  const { eventId, title, subtitle, content, parentId } = req.body;
  db.run(
    `INSERT INTO announcements (eventId, title, subtitle, content, parentId)
     VALUES (?, ?, ?, ?, ?)`,
    [eventId, title, subtitle, content, parentId],
    function () {
      res.json({ id: this.lastID });
    }
  );
});

app.put('/announcements/:id', (req, res) => {
  const { title, subtitle, content, parentId } = req.body;
  db.run(
    `UPDATE announcements SET title=?, subtitle=?, content=?, parentId=? WHERE id=?`,
    [title, subtitle, content, parentId, req.params.id],
    () => res.sendStatus(200)
  );
});

app.delete('/announcements/:id', (req, res) => {
  db.run(`DELETE FROM announcements WHERE id=?`, [req.params.id], () => res.sendStatus(200));
});

// GAME REFERENCE IMAGE
app.post('/upload/:eventId', upload.single('image'), (req, res) => {
  const path = req.file.path;
  db.run(`UPDATE events SET gameRef=? WHERE id=?`, [path, req.params.eventId]);
  res.json({ path });
});

app.listen(4000, () => console.log('Server running on 4000'));
