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
    highlight INTEGER DEFAULT 0,
    image TEXT   -- NEW: path to announcement image
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
  const id = parseInt(req.params.id);

  db.get('SELECT title FROM events WHERE id=?', [id], (err, originalEvent) => {
    if (err || !originalEvent) return res.sendStatus(404);

    // Create new event with blank location and fieldName
    db.run(
      `INSERT INTO events (title, location, fieldName, gameRef) VALUES (?, ?, ?, ?)`,
      [originalEvent.title + ' Copy', null, null, null],
      function () {
        const newEventId = this.lastID;

        // Copy categories
        db.all('SELECT * FROM categories WHERE eventId=? ORDER BY sortOrder', [id], (err, cats) => {
          const catMap = {}; // old category id → new category id

          if (cats.length === 0) {
            copyAnnouncements(newEventId, catMap);
            return;
          }

          let completed = 0;
          cats.forEach(cat => {
            db.run(
              `INSERT INTO categories (eventId, name, sortOrder) VALUES (?, ?, ?)`,
              [newEventId, cat.name, cat.sortOrder],
              function () {
                catMap[cat.id] = this.lastID;
                completed++;
                if (completed === cats.length) {
                  copyAnnouncements(newEventId, catMap);
                }
              }
            );
          });
        });
      }
    );
  });

  function copyAnnouncements(newEventId, catMap) {
    db.all('SELECT * FROM announcements WHERE eventId=?', [id], (err, anns) => {
      if (anns.length === 0) {
        return res.json({ id: newEventId });
      }

      let completed = 0;
      anns.forEach(ann => {
        const newCategoryId = ann.categoryId ? catMap[ann.categoryId] || null : null;

        db.run(
          `INSERT INTO announcements (eventId, title, subtitle, content, categoryId, highlight, image)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newEventId, ann.title, ann.subtitle, ann.content, newCategoryId, ann.highlight, ann.image],
          () => {
            completed++;
            if (completed === anns.length) {
              res.json({ id: newEventId });
            }
          }
        );
      });
    });
  }
});

// UPDATE EVENT (title, location, fieldName)
app.put('/events/:id', (req, res) => {
  const { title, location, fieldName } = req.body;
  const id = req.params.id;

  db.run(
    `UPDATE events SET title = ?, location = ?, fieldName = ? WHERE id = ?`,
    [title, location || null, fieldName || null, id],
    function (err) {
      if (err) {
        console.error(err);
        return res.sendStatus(500);
      }
      res.sendStatus(200);
    }
  );
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
  const { eventId, title, subtitle, content, categoryId, highlight = 0, image } = req.body;
  db.run(
    `INSERT INTO announcements (eventId, title, subtitle, content, categoryId, highlight, image)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [eventId, title, subtitle, content, categoryId, highlight ? 1 : 0, image],
    function () {
      res.json({ id: this.lastID });
    }
  );
});

app.put('/announcements/:id', (req, res) => {
  const { title, subtitle, content, categoryId, highlight, image } = req.body;
  db.run(
    `UPDATE announcements SET title=?, subtitle=?, content=?, categoryId=?, highlight=?, image=? WHERE id=?`,
    [title, subtitle, content, categoryId, highlight ? 1 : 0, image, req.params.id],
    () => res.sendStatus(200)
  );
});

app.delete('/announcements/:id', (req, res) => {
  // Also delete associated image file if exists
  db.get('SELECT image FROM announcements WHERE id=?', [req.params.id], (err, row) => {
    if (row && row.image) {
      const filePath = path.join(__dirname, row.image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.run(`DELETE FROM announcements WHERE id=?`, [req.params.id], () => res.sendStatus(200));
  });
});

// Announcement image upload
app.post('/upload/announcement/:annId', upload.single('image'), (req, res) => {
  const imagePath = req.file.path;
  db.run(`UPDATE announcements SET image = ? WHERE id = ?`, [imagePath, req.params.annId]);
  res.json({ path: imagePath });
});

// Remove announcement image
app.delete('/announcement/image/:annId', (req, res) => {
  const annId = req.params.annId;
  db.get('SELECT image FROM announcements WHERE id = ?', [annId], (err, row) => {
    if (row && row.image) {
      const filePath = path.join(__dirname, row.image);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    db.run('UPDATE announcements SET image = NULL WHERE id = ?', [annId], () => {
      res.sendStatus(200);
    });
  });
});

// Game Reference routes (keep your existing ones - the duplicate delete is cleaned up here)
app.post('/upload/:eventId', upload.single('image'), (req, res) => {
  const path = req.file.path;
  db.run(`UPDATE events SET gameRef=? WHERE id=?`, [path, req.params.eventId]);
  res.json({ path });
});

app.delete('/gameRef/:eventId', (req, res) => {
  const eventId = parseInt(req.params.eventId);
  db.get('SELECT gameRef FROM events WHERE id = ?', [eventId], (err, row) => {
    if (row && row.gameRef) {
      const filePath = path.join(__dirname, row.gameRef);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.run('UPDATE events SET gameRef = NULL WHERE id = ?', [eventId], () => res.sendStatus(200));
  });
});


app.listen(4000, () => console.log('Server running on 4000'));
