const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'users',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from 'public' and 'templates' folders
app.use(express.static(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'templates')));

// Serve static files from 'uploads' folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'ejs');

// Function to check for duplicate values
async function checkForDuplicate(prn, email) {
  return new Promise((resolve, reject) => {
    const checkDuplicateSql = 'SELECT * FROM users WHERE prn = ? OR email = ?';
    db.query(checkDuplicateSql, [prn, email], (err, results) => {
      if (err) {
        console.error(err);
        reject(err);
      }

      // If any result is returned, it means there is a duplicate
      const isDuplicate = results.length > 0;
      resolve(isDuplicate);
    });
  });
}

// Route to fetch the user's name
app.get('/get-user-name', (req, res) => {
  const email = "example@gmail.com"; // Replace this with the email of the logged-in user (assuming you have access to the user's email)

  // Query the database to fetch the user's name based on their email
  const sql = 'SELECT name FROM users WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error fetching user name. Please try again.');
    }

    if (results.length > 0) {
      const userName = results[0].name;
      res.send(userName); // Send the user's name as a response
    } else {
      res.status(404).send('User not found.'); // Handle the case where user is not found
    }
  });
});

// Routes
app.get('/practice', (req, res) => {
 res.render('practice')
});
// faculty
app.get('/faculty', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'faculty.html'))
});
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'signup.html'));
});
app.get('/practice1', (req, res) => {
 res.render('practice1')});
// Check for duplicate values endpoint
app.post('/check-duplicate', async (req, res) => {
  const { prn, email } = req.body;

  try {
    const isDuplicate = await checkForDuplicate(prn, email);
    res.json({ isDuplicate });
  } catch (error) {
    res.status(500).json({ isDuplicate: true });
  }
});

// Signup endpoint
app.post('/signup', async (req, res) => {
  const { name, prn, faculty_id, event_id, email, password, category } = req.body;

  if (category === 'student') {
    const emailRegex = /^(\d{10})@mitwpu\.edu\.in$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send('Please enter a valid email address in the format PRN@mitwpu.edu.in.');
    }

    if (email.slice(0, 10) !== prn) {
      return res.status(400).send('The entered PRN does not match the email address.');
    }
  }

  try {
    let identifier;
    if (category === 'student') {
      identifier = prn;
    } else if (category === 'faculty') {
      identifier = faculty_id;
    } else if (category === 'event_manager') {
      identifier = event_id;
    }

    const isDuplicate = await checkForDuplicate(identifier, email);
    if (isDuplicate) {
      return res.status(400).send('Credentials are already taken. Please choose another.');
    }

    let signupSql;
    let values;

    if (category === 'student') {
      signupSql = 'INSERT INTO users (name, prn, email, password, category) VALUES (?, ?, ?, ?, ?)';
      values = [name, prn, email, password, category];
    } else if (category === 'faculty') {
      signupSql = 'INSERT INTO users (name, faculty_id, email, password, category) VALUES (?, ?, ?, ?, ?)';
      values = [name, faculty_id, email, password, category];
    } else if (category === 'event_manager') {
      signupSql = 'INSERT INTO users (name, event_id, email, password, category) VALUES (?, ?, ?, ?, ?)';
      values = [name, event_id, email, password, category];
    }

    const loginSql = 'INSERT INTO login_users (username, password) VALUES (?, ?)';

    db.query(signupSql, values, (signupErr) => {
      if (signupErr) {
        console.error(signupErr);
        return res.status(500).send('Error during signup. Please try again.');
      }

      db.query(loginSql, [email, password], (loginErr) => {
        if (loginErr) {
          console.error(loginErr);
          return res.status(500).send('Error during signup. Please try again.');
        }

        res.redirect('/login'); // Redirect to the login page after successful signup
      });
    });
  } catch (error) {
    res.status(500).send('Error during signup. Please try again.');
  }
});

async function checkForDuplicate(identifier, email) {
    return false; 
  }



// Login endpoint
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'login.html'));
});


// Login endpoint
app.post('/login', (req, res) => {
  const { uname, psw } = req.body;

  // Query the login_users table to check if the provided username and password match
  const sql = 'SELECT * FROM login_users WHERE username = ? AND password = ?';
  db.query(sql, [uname, psw], (err, results) => {
    if (err) {
      console.error(err);
      return res.send('Error during login. Please try again.');
    }

    // Check if results contain a matching user
    if (results.length > 0) {
      const user = results[0];

      // Fetch the user's name and category based on the provided username
      const userInfoQuery = 'SELECT name, category,email FROM users WHERE email = ?';
      db.query(userInfoQuery, [uname], (userInfoErr, userInfoResults) => {
        if (userInfoErr) {
          console.error(userInfoErr);
          return res.send('Error during login. Please try again.');
        }

        // Check if results contain the user's name and category
        if (userInfoResults.length > 0) {
          const { name, category,email } = userInfoResults[0];

          // Redirect to the corresponding category page with the user's name as a query parameter
          switch (category) {
            case 'student':
              const fetchEventsSql = 'SELECT * FROM events';
              db.query(fetchEventsSql, (fetchEventsErr, events) => {
                if (fetchEventsErr) {
                  console.error(fetchEventsErr);
                  return res.send('Error fetching events. Please try again.');
                }

                // Render the student template with the user's name and events data
                res.render('practice', { userName: name,email: email, category: category, events: events });
              });
              break;
            case 'faculty':
              const fetchEventsSql1 = 'SELECT * FROM events';
              db.query(fetchEventsSql1, (fetchEventsErr, events) => {
                if (fetchEventsErr) {
                  console.error(fetchEventsErr);
                  return res.send('Error fetching events. Please try again.');
                }

                // Render the student template with the user's name and events data
                res.render('faculty', { userName: name,email: email, category: category, events: events });
              });
              break;
            case 'event_manager':
              res.redirect(`/event?name=${name}`);
              break;
            default:
              res.send('Invalid category.');
          }
        } else {
          res.send('User information not found.');
        }
      });
    } else {
      res.send('Invalid email or password.');
    }
  });
});

// Create the 'uploads' folder if it doesn't exist
const uploadsFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsFolder)) {
  fs.mkdirSync(uploadsFolder);
}

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsFolder); // Specify the destination folder for uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Keep the original file name
  },
});

const upload = multer({ storage: storage });

// Function to check for duplicate event names
async function checkForDuplicateEvent(eventName) {
  return new Promise((resolve, reject) => {
    const checkDuplicateSql = 'SELECT * FROM events WHERE name = ?';
    db.query(checkDuplicateSql, [eventName], (err, results) => {
      if (err) {
        console.error(err);
        reject(err);
      }

      // If any result is returned, it means there is a duplicate
      const isDuplicate = results.length > 0;
      resolve(isDuplicate);
    });
  });
}

// Routes
app.get('/event', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'event_manager.html'));
});

// Check for duplicate event names endpoint
app.post('/event', upload.single('image'), async (req, res) => {
  const event = req.body;
  const imagePath = req.file ? req.file.filename : null;

  try {
    // Check for duplicate event names
    const isDuplicate = await checkForDuplicateEvent(event.name);
    if (isDuplicate) {
      return res.status(400).send('Event name is already taken. Please choose another.');
    }

    // If not a duplicate, proceed with event submission logic
    const eventSql = 'INSERT INTO events (name, start_date, end_date, location, description, image, type, is_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    
    db.query(
      eventSql,
      [event.name, event.start_date, event.end_date, event.location, event.description, imagePath, event.type, event.is_paid],
      (eventErr) => {
        if (eventErr) {
          console.error(eventErr);
          return res.status(500).send('Error during event submission. Please try again.');
        }

        res.redirect('/event-success');
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).send('Error during event submission. Please try again.');
  }
});
// Success page after event submission
app.get('/event-success', (req, res) => {
  res.send('Event submitted successfully!');
});

// Route to fetch events from the database and send as JSON
app.get('/get-events', (req, res) => {
  const fetchEventsSql = 'SELECT * FROM events';

  db.query(fetchEventsSql, (err, events) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error fetching events. Please try again.' });
    }

    // Update image paths to use a relative path or URL accessible to clients
    const updatedEvents = events.map(event => {
      return {
        ...event,
        image: event.image ? `/uploads/${event.image}` : null,
      };
    });

    res.json(updatedEvents);
  });
});

// Route to serve the student page
app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'practice.html'));
});


// Handle the initial registration form submission
app.post('/register', (req, res) => {
  const { name, email, category, event_id, event_description, event_start_date, event_last_date, event_image, event_name } = req.body;

  // Basic validation to ensure required fields are present
  if (!name || !email || !category || !event_id || !event_name) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Additional validation if needed (e.g., checking if event_id is a number)
  if (isNaN(parseInt(event_id))) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
  }

  // Render the register.ejs view with pre-filled data
  res.render('register', {
      name: name,
      email,
      category,
      event: {
          id: event_id,
          name: event_name,
          image: event_image,
          description: event_description,
          start_date: event_start_date,
          end_date: event_last_date
      }
  });
});

// Handle the final event registration submission
app.post('/registerEvent', (req, res) => {
  const { name, email, category, event_id, event_name, purpose } = req.body;

  // Basic validation to ensure required fields are present
  if (!name || !email || !category || !event_id || !event_name || !purpose) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Additional validation if needed (e.g., checking if event_id is a number)
  if (isNaN(parseInt(event_id))) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
  }

  // Check if the user has already registered for this event
  const checkRegistrationSql = 'SELECT * FROM registrations WHERE email = ? AND event_id = ?';
  db.query(checkRegistrationSql, [email, event_id], (checkErr, existingRegistrations) => {
      if (checkErr) {
          console.error('Error checking existing registration:', checkErr);
          return res.status(500).json({ success: false, message: 'Internal server error. Please try again.' });
      }

      // If user has already registered for this event
      if (existingRegistrations.length > 0) {
          return res.status(400).json({ success: false, message: 'You have already registered for this event.' });
      }

      // Insert registration details into the registrations table
      const insertRegistrationSql = 'INSERT INTO registrations (name, email, category, event_id, event_name, purpose) VALUES (?, ?, ?, ?, ?, ?)';
      db.query(insertRegistrationSql, [name, email, category, event_id, event_name, purpose], (err, result) => {
          if (err) {
              console.error('Error registering for event:', err);
              return res.status(500).json({ success: false, message: 'Internal server error. Please try again.' });
          }

          // Fetch event details for rendering on a confirmation page or redirect
          const fetchEventSql = 'SELECT * FROM events WHERE id = ?';
          db.query(fetchEventSql, [event_id], (fetchErr, event) => {
              if (fetchErr) {
                  console.error('Error fetching event details:', fetchErr);
                  return res.status(500).json({ success: false, message: 'Internal server error. Please try again.' });
              }

              // Check if event details are retrieved
              if (event.length === 0) {
                  return res.status(404).json({ success: false, message: 'Event not found.' });
              }

              // Assuming successful registration, send a success response
              const eventData = {
                  success: true,
                  message: 'Registration successful.',
                  event: event[0] // Assuming only one event is fetched by id
              };
              res.status(200).json(eventData);
          });
      });
  });
});






app.get('/users', (req, res) => {
  let sql = 'SELECT * FROM users ORDER BY category';
  db.query(sql, (err, results) => {
      if(err) throw err;
      res.render('users', { users: results });
  });
});



// showing events
app.get('/eventstable', (req, res) => {
  let sql = 'SELECT * FROM events';
  db.query(sql, (err, results) => {
      if(err) throw err;
      res.render('events', { events: results });
  });
});

// Route to handle event registration
app.post('/register-event', (req, res) => {
  // Retrieve registration information from the request body
  const userName = req.body.userName;
  const eventId = req.body.eventId;
  const eventName = req.body.eventName;

  // You can add confirmation logic here, for example:
  // If user confirms registration (assuming it's passed in the request body as 'confirmation')
  const confirmation = req.body.confirmation;
  if (confirmation === 'yes') {
      // Perform registration logic here (insert registration record into the database, etc.)
      // Once registration is successful, you can redirect the user or send a response
      res.send('Registration successful!');
  } else {
      // Handle if user declines registration
      res.send('Registration declined.');
  }
});
app.post('/dashboard', (req, res) => {
  // Assuming userEmail is available in the request body
  const userEmail = req.body.email;

  console.log('User email:', userEmail); // Log userEmail

  // Fetch user details from the database based on userEmail
  db.query('SELECT * FROM users WHERE email = ?', [userEmail], (err, userResults) => {
      if (err) {
          // Handle error
          console.error('Error fetching user details:', err);
          res.status(500).send('Internal Server Error');
          return;
      }

      console.log('User details:', userResults); // Log userResults

      // Check if userResults is empty
      if (userResults.length === 0) {
          console.log('User not found'); // Log user not found
          res.status(404).send('User not found');
          return;
      }

      // Fetch registrations associated with the user, including event image
      db.query(`
        SELECT r.*, e.image AS event_image 
        FROM registrations r
        JOIN events e ON r.event_id = e.id 
        WHERE r.email = ?`, [userEmail], (err, registrationResults) => {
          if (err) {
              // Handle error
              console.error('Error fetching registrations:', err);
              res.status(500).send('Internal Server Error');
              return;
          }

          // Render the dashboard.ejs template with user and registration data
          res.render('dashboard', { user: userResults[0], registrations: registrationResults });
      });
  });
});


// Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
