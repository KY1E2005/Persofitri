// Import the SQLite3 module and enable verbose mode for debugging
const sqlite3 = require('sqlite3').verbose();
// Import the Express module for building the web server
const express = require('express');
// Create an instance of an Express application
const app = express();
// Define the port number the server will listen on
const PORT = 3000;
// Import the Body-Parser middleware for parsing incoming request bodies
const bodyParser = require('body-parser');

// Middleware to parse URL-encoded data from the request body
app.use(express.urlencoded({ extended: true }));
// Middleware to parse JSON data from the request body
app.use(express.json());
// Middleware to serve static files from the current directory
app.use(express.static('.'));
// Middleware to parse JSON data from the request body (included for compatibility)
app.use(bodyParser.json());

const db = new sqlite3.Database('./Database.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Failed to connect to the database:', err.message);
        return;
    }
    console.log('Connected to the SQLite database.');

    db.run(`CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY, Name TEXT, Password TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS BMI_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        age INTEGER,
        gender TEXT,
        height REAL,
        weight REAL,
        BMI REAL,
        user_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES Users(id)
      )`);
});

app.post('/register', (req, res) => {
    const { name, password } = req.body;
    const sql = `INSERT INTO Users (Name, Password) VALUES (?, ?)`;
    db.run(sql, [name, password], function(err) {
        if (err) {
            console.error(err.message);
            res.status(500).send('Failed to register user.');
            return;
        }
        const userId = this.lastID; // Get the inserted user ID
        console.log(`A new user has been added to the database with ID: ${userId}`);

        // Store user_id in a cookie or session
        res.cookie('user_id', userId);
        res.redirect('./BMI-Calculator.html');
    });
});



app.post('/calculate-bmi', (req, res) => {
    const { age, gender, height, weight, bmi, user_id } = req.body;
    if (!user_id) {
        return res.status(400).json({ status: 'Failed to save data', error: 'User ID is required' });
    }
    const sql = `INSERT INTO BMI_info (age, gender, height, weight, BMI, user_id) VALUES (?, ?, ?, ?, ?, ?)`;

    db.run(sql, [age, gender, height, weight, bmi, user_id], (err) => {
        if (err) {
            console.error('Error executing SQL:', err.message);
            res.status(500).json({ status: 'Failed to save data' });
        } else {
            console.log('BMI data has been saved successfully.');
            res.json({ status: 'Data saved successfully' }); // Send status to the client
        }
    });
});


app.get('/get-user-name', (req, res) => {
    const userId = req.query.user_id; // Get user ID from the query parameters
    if (!userId) {
        res.status(400).json({ status: 'User ID is missing' });
        return;
    }
    const sql = `SELECT Name FROM Users WHERE id = ?`; // SQL query to get the user's name based on the user ID
    db.get(sql, [userId], (err, row) => {
        if (err) {
            console.error('Error executing SQL:', err.message);
            res.status(500).json({ status: 'Failed to retrieve user name' });
        } else if (row) {
            res.json({ name: row.Name });
        } else {
            res.status(404).json({ status: 'User not found' });
        }
    });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { name, password } = req.body;// Extract name and password from the request body
    const sql = `SELECT * FROM Users WHERE Name = ? AND Password = ?`; // SQL query to find the user by name and password
    db.get(sql, [name, password], (err, user) => { // Execute the query with the provided name and password
        if (err) {
            console.error(err.message);
            res.status(500).json({ success: false, message: 'Server error' }); // Respond with a 500 status code and an error message
            return;
        }
        if (!user) {  // If no user is found
            res.status(401).json({ success: false, message: 'Invalid username or password' });
            return;
        }
        // Get the latest BMI and gender for the user
        const bmiSql = `SELECT BMI, gender FROM BMI_info WHERE user_id = ? ORDER BY id DESC LIMIT 1`; // SQL query to get the latest BMI and gender for the user
        db.get(bmiSql, [user.id], (err, bmiInfo) => { // Execute the query with the user's ID
            if (err) {
                console.error(err.message);
                res.status(500).json({ success: false, message: 'Server error' }); 
                return;
            }
            if (!bmiInfo) { // If no BMI information is found
                res.status(404).json({ success: false, message: 'BMI information not found' });
                return;
            }
            res.json({ // Respond with the user information, including the latest BMI and gender
                success: true, // Indicate that the login was successful
                user_id: user.id, // Include the user's ID
                bmi: bmiInfo.BMI,
                gender: bmiInfo.gender
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
