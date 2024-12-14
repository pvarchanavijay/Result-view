const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

// Database connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "micro2"
});

// Login process
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Query to check if the user exists with the provided credentials
    const sql = "SELECT * FROM login WHERE username = ? AND password = ?";
    db.query(sql, [email, password], (err, data) => {
        if (err) return res.json({ error: "Error in database query" });

        if (data.length > 0) {
            const user = data[0];
            const token = jwt.sign({ userId: user.id }, 'secretkey', { expiresIn: '1h' });

            // Return different roles based on the usertype
            if (user.usertype === 1) { 
                return res.json({ token: token, role: 'admin', email }); // Send email back
            } else { 
                return res.json({ token: token, role: 'user', email }); // Send email back
            }
        } else {
            return res.json({ message: "Invalid Credentials!!!" });
        }
    });
});


// Registration process
app.post('/register', (req, res) => {
    const { fullname, email, rollno, phone, year, department, password } = req.body;

    // Insert into the registration table
    const registrationQuery = `
        INSERT INTO registration (fullname, email, rollno, phone, year, department)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(registrationQuery, [fullname, email, rollno, phone, year, department], (err, result) => {
        if (err) {
            console.error('Error inserting into registration table:', err.message);
            return res.status(500).send({ message: 'Error inserting into registration table.' });
        }

        console.log('Data inserted into registration table:', result);

        const loginQuery = `
            INSERT INTO login (username, password)
            VALUES (?, ?)
        `;

        db.query(loginQuery, [email, password], (err, result) => {
            if (err) {
                console.error('Error inserting into login table:', err.message);
                return res.status(500).send({ message: 'Error inserting into login table.' });
            }

            console.log('Data inserted into login table:', result);
            res.status(200).send({ message: 'Registration successful!' });
        });
    });
});

// Admin route to fetch student data
app.get('/Admin', (req, res) => {
    const query = 'SELECT fullname, email, rollno, phone, year, department FROM registration';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching students:', err);
            return res.status(500).json({ message: 'Error fetching student data' });
        }

        res.status(200).json(results);
    });
});

// Add marks of students
app.post('/addmarks', (req, res) => {
    const { rollno, DFCA, SE, DS, Maths, Python } = req.body;

    const checkQuery = 'SELECT rollno FROM registration WHERE rollno = ?';

    db.query(checkQuery, [rollno], (err, result) => {
        if (err) {
            console.error('Error checking rollno in registration table:', err);
            return res.status(500).send('Error checking roll number.');
        }

        if (result.length === 0) {
            return res.status(404).send('Roll number does not exist!');
        }

        const insertQuery = `INSERT INTO marks (rollno, DFCA, SE, DS, Maths, Python) VALUES (?, ?, ?, ?, ?, ?)`;

        db.query(insertQuery, [rollno, DFCA, SE, DS, Maths, Python], (err, result) => {
            if (err) {
                console.error('Error inserting marks:', err);
                return res.status(500).send('Marks already added for this student');
            }

            res.status(200).send('Marks added successfully');
        });
    });
});

// Student Marklist
app.get('/Marklist', (req, res) => {
    const query = 'SELECT * FROM marks JOIN registration ON marks.rollno = registration.rollno';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching marks:', err);
            return res.status(500).json({ message: 'Error fetching marks' });
        }
        console.log(results);  // Log the results to ensure data is returned
        res.status(200).json(results);
    });
});

// Passing student Id
app.get('/getStudentMarks/:rollno', (req, res) => {
    const rollno = req.params.rollno;
    const query = 'SELECT * FROM marks WHERE rollno = ?';

    db.query(query, [rollno], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching student data', error: err });
        }
        if (result.length > 0) {
            res.json(result[0]);  // Send back the first student data
        } else {
            res.status(404).json({ message: 'Student not found' });
        }
    });
});

// Update Marks
app.put('/Updatemarks', (req, res) => {
    const { rollno, DFCA, SE, DS, Maths, Python } = req.body;

    if (!rollno || !DFCA || !SE || !DS || !Maths || !Python) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    const query = `
        UPDATE marks 
        SET dfca = ?, se = ?, ds = ?, maths = ?, python = ? 
        WHERE rollno = ?
    `;
    db.query(query, [DFCA, SE, DS, Maths, Python, rollno], (err, result) => {
        if (err) {
            console.error('Error updating marks:', err);
            return res.status(500).json({ message: 'Error updating marks.' });
        }

        if (result.affectedRows > 0) {
            res.json({ message: 'Marks updated successfully!' });
        } else {
            res.status(404).json({ message: 'Student not found or no changes made.' });
        }
    });
});



app.delete('/DeleteMark/:rollno', (req, res) => {
    const rollno = req.params.rollno;

    console.log('Attempting to delete rollno:', rollno);

    // Step 1: Check if the student with the given rollno exists in the marks table
    const selectQuery = 'SELECT * FROM marks WHERE rollno = ?';
    db.query(selectQuery, [rollno], (selectErr, selectResult) => {
        if (selectErr) {
            console.error('Error checking if rollno exists in marks:', selectErr);
            return res.status(500).send('Error checking record');
        }

        if (selectResult.length === 0) {
            return res.status(404).send('No record found with the given rollno');
        }

        
        const { rollno, dfca, se, ds, maths, python } = selectResult[0];

        
        const insertBinQuery = 'INSERT INTO bin (rollno, dfca, se, ds, maths, python) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(insertBinQuery, [rollno, dfca, se, ds, maths, python], (insertErr) => {
            if (insertErr) {
                console.error('Error inserting data into bin:', insertErr);
                return res.status(500).send('Error archiving marks');
            }

            // Step 4: Delete the marks from the marks table
            const deleteQuery = 'DELETE FROM marks WHERE rollno = ?';
            db.query(deleteQuery, [rollno], (deleteErr, deleteResult) => {
                if (deleteErr) {
                    console.error('Error deleting data from marks:', deleteErr);
                    return res.status(500).send('Error deleting marks');
                }

                // If the delete operation is successful
                if (deleteResult.affectedRows > 0) {
                    res.status(200).send('Marks deleted and archived successfully!');
                } else {
                    res.status(404).send('No record found with the given rollno');
                }
            });
        });
    });
});


// Result View 
app.get('/getStudentMarksByEmail/:email', (req, res) => {
    const email = req.params.email;

    const studentQuery = `
        SELECT r.rollno, r.fullname, r.year, r.department, m.dfca, m.se, m.ds, m.maths, m.python 
        FROM registration r 
        LEFT JOIN marks m ON r.rollno = m.rollno 
        WHERE r.email = ?
    `;

    db.query(studentQuery, [email], (err, result) => {
        if (err) {
            console.error('Error fetching student marks by email:', err);
            return res.status(500).json({ message: 'Error fetching student data' });
        }

        if (result.length > 0) {
            const studentInfo = {
                rollno: result[0].rollno,
                fullname: result[0].fullname,
                year: result[0].year,
                department: result[0].department,
            };

            const marks = {
                DFCA: result[0].dfca || 'N/A',
                SE: result[0].se || 'N/A',
                DS: result[0].ds || 'N/A',
                Maths: result[0].maths || 'N/A',
                Python: result[0].python || 'N/A',
            };

            res.status(200).json({ studentInfo, marks });
        } else {
            res.status(404).json({ message: 'Student not found.' });
        }
    });
});






// Start the server
app.listen(8081, () => {
    console.log("Listening on port 8081...");
});
