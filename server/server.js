const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const fs = require('fs'); 
const path = require('path');

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
    location TEXT,
    fieldName TEXT,
    gameRef TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER,
    name TEXT NOT NULL,
    sortOrder INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER,
    title TEXT,
    subtitle TEXT,
    content TEXT,
    categoryId INTEGER,
    highlight INTEGER DEFAULT 0
  )`);
});

// EVENTS
app.get('/events', (req, res) => {
  db.all('SELECT * FROM events', [], (err, rows) => res.json(rows));
});

app.post('/events', (req, res) => {
  const { title, location, fieldName } = req.body;
  db.run(
    `INSERT INTO events (title, location, fieldName) VALUES (?, ?, ?)`,
    [title, location, fieldName],
    function () {
      res.json({ id: this.lastID });
    }
  );
});

// COPY EVENT (kept for completeness, now includes categories too)
app.post('/events/:id/copy', (req, res) => {
  const id = req.params.id;

  db.get('SELECT * FROM events WHERE id=?', [id], (err, event) => {
    db.run(
      `INSERT INTO events (title, location, fieldName, gameRef) VALUES (?, ?, ?, ?)`,
      [event.title + ' Copy', event.location, event.fieldName, event.gameRef],
      function () {
        const newEventId = this.lastID;

        // Copy announcements
        db.all('SELECT * FROM announcements WHERE eventId=?', [id], (err, anns) => {
          anns.forEach(a => {
            db.run(
              `INSERT INTO announcements (eventId, title, subtitle, content, categoryId, highlight)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [newEventId, a.title, a.subtitle, a.content, a.categoryId, a.highlight]
            );
          });
          // Copy categories
          db.all('SELECT * FROM categories WHERE eventId=? ORDER BY sortOrder', [id], (err, cats) => {
            let order = 0;
            cats.forEach(c => {
              db.run(
                `INSERT INTO categories (eventId, name, sortOrder) VALUES (?, ?, ?)`,
                [newEventId, c.name, order++]
              );
            });
            res.json({ id: newEventId });
          });
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

    db.run('DELETE FROM announcements WHERE eventId=?', [id]);
    db.run('DELETE FROM categories WHERE eventId=?', [id]);

    res.sendStatus(200);
  });
});

// CATEGORIES
app.get('/categories/:eventId', (req, res) => {
  db.all('SELECT * FROM categories WHERE eventId=? ORDER BY sortOrder ASC', [req.params.eventId], (err, rows) => res.json(rows));
});

app.post('/categories', (req, res) => {
  const { eventId, name } = req.body;
  db.get('SELECT MAX(sortOrder) as maxOrder FROM categories WHERE eventId=?', [eventId], (err, row) => {
    const nextOrder = (row?.maxOrder || 0) + 1;
    db.run(
      `INSERT INTO categories (eventId, name, sortOrder) VALUES (?, ?, ?)`,
      [eventId, name, nextOrder],
      function () {
        res.json({ id: this.lastID });
      }
    );
  });
});

app.put('/categories/:id', (req, res) => {
  const { name } = req.body;
  db.run(
    `UPDATE categories SET name=? WHERE id=?`,
    [name, req.params.id],
    () => res.sendStatus(200)
  );
});

app.delete('/categories/:id', (req, res) => {
  db.run(`DELETE FROM categories WHERE id=?`, [req.params.id], () => res.sendStatus(200));
});

app.post('/categories/reorder', (req, res) => {
  const { eventId, orderedIds } = req.body;
  if (!orderedIds || orderedIds.length === 0) return res.sendStatus(200);

  let completed = 0;
  const total = orderedIds.length;

  orderedIds.forEach((id, index) => {
    db.run(
      `UPDATE categories SET sortOrder = ? WHERE id = ? AND eventId = ?`,
      [index, id, eventId],
      () => {
        completed++;
        if (completed === total) res.sendStatus(200);
      }
    );
  });
});

// ANNOUNCEMENTS
app.get('/announcements/:eventId', (req, res) => {
  db.all('SELECT * FROM announcements WHERE eventId=?', [req.params.eventId], (err, rows) => res.json(rows));
});

app.post('/announcements', (req, res) => {
  const { eventId, title, subtitle, content, categoryId, highlight = 0 } = req.body;
  db.run(
    `INSERT INTO announcements (eventId, title, subtitle, content, categoryId, highlight)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [eventId, title, subtitle, content, categoryId, highlight ? 1 : 0],
    function () {
      res.json({ id: this.lastID });
    }
  );
});

app.put('/announcements/:id', (req, res) => {
  const { title, subtitle, content, categoryId, highlight } = req.body;
  db.run(
    `UPDATE announcements SET title=?, subtitle=?, content=?, categoryId=?, highlight=? WHERE id=?`,
    [title, subtitle, content, categoryId, highlight ? 1 : 0, req.params.id],
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

app.delete('/gameRef/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  db.get('SELECT gameRef FROM events WHERE id = ?', [eventId], (err, row) => {
    if (row && row.gameRef) {
      // Delete physical file if it exists
      const filePath = path.join(__dirname, row.gameRef);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.run('UPDATE events SET gameRef = NULL WHERE id = ?', [eventId], (err) => {
      if (err) return res.sendStatus(500);
      res.sendStatus(200);
    });
  });
});
// REMOVE GAME REFERENCE IMAGE
app.delete('/gameRef/:eventId', (req, res) => {
  const eventId = parseInt(req.params.eventId);

  db.get('SELECT gameRef FROM events WHERE id = ?', [eventId], (err, row) => {
    if (err) return res.sendStatus(500);

    if (row && row.gameRef) {
      // Delete the actual file from disk
      const filePath = path.join(__dirname, row.gameRef);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to delete file:', e);
        }
      }
    }

    // Clear the path in the database
    db.run('UPDATE events SET gameRef = NULL WHERE id = ?', [eventId], (err) => {
      if (err) return res.sendStatus(500);
      res.sendStatus(200);
    });
  });
});



app.listen(4000, () => console.log('Server running on 4000'));
