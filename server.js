require('dotenv').config();
const express = require('express');
const mysql = require('mysql2'); // MySQL package for database connection
const bodyParser = require('body-parser'); // To parse JSON data
const cors = require('cors'); // To handle cross-origin requests
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require("path");


// Initialize express app
const app = express();

const Publishable_Key = "pk_test_51PkjOKP0iAQ6PiqezKI2cm60xKFqJuJ7eqewO0wZq5hAU3XTspsxkp58LoHbxQIFhwrRx5VNkE0TSHebkbZicS4t00MqysuN18";
const Secret_Key = "sk_test_51PkjOKP0iAQ6PiqefnRQKU6Cvhp8YfoggpfIGBO2ye1Vo1xMscbQwl5h8104vDZMKLhY9jvCfKfCZhQSsl0mqTnQ00jK1iEm4r";

const stripe = require("stripe")(Secret_Key);

const port = process.env.PORT || 5500; // You can change the port number if needed


// Middleware Setup
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // Use body-parser middleware to parse JSON data from requests

// View Engine Setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


// Set up MySQL connection
const connection = mysql.createConnection({
  host: '127.0.0.1',    // Your MySQL host
  user: 'root',         // Your MySQL username
  password: 'Koko&1402', // Your MySQL password
  database: 'flask_db'  // Your MySQL database name
});



// Connect to the MySQL database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1); // Exit if database connection fails
    // return;
  }
  console.log('Connected to MySQL database!');
});

const secretKey = 'A8cP4h5X2vP0wW1Zq8fG9Jk3LmO6NnRr'; // Replace with a secure key



// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied, no token provided.' });

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

//Payment  
app.get('/payment', (req, res) => {
  const totalAmount = req.query.totalAmount;  // Get totalAmount from query parameters
  if (!totalAmount) {
      return res.status(400).send('Total amount is missing.');
  }
  res.render('payment', { totalAmount, key: Publishable_Key });
});

app.post('/payment', async (req, res) => {
  const { stripeToken, amount } = req.body;

  try {
      const charge = await stripe.charges.create({
          amount: amount * 100, // amount in cents
          currency: 'INR',
          source: stripeToken,
          description: 'Payment for Eira',
      });
      res.send('Payment successful!');
  } catch (error) {
      console.error(error);
      res.send('Payment failed!');
  }
});


// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.user) {  // or check JWT token
    next(); // User is authenticated, proceed
  } else {
    res.status(401).send('Not logged in');
  }
}

// 
// CRUD Operations for Products
app.post('/addProduct', (req, res) => {
  const { name, description, price, stock } = req.body;
  connection.query('INSERT INTO products (name, description, price, stock) VALUES (?, ?, ?, ?)', 
      [name, description, price, stock], 
      (err, result) => {
          if (err) return res.status(500).send(err);
          res.status(200).json({ id: result.insertId, name, description, price, stock });
      }
  );
});

// Get All Products
app.get('/products', (req, res) => {
  const search = req.query.search || '';
  connection.query('SELECT * FROM products WHERE name LIKE ?', [`%${search}%`], (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
  });
});

// Update Product
app.put('/updateProduct/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock } = req.body;
  connection.query('UPDATE products SET name = ?, description = ?, price = ?, stock = ? WHERE id = ?',
      [name, description, price, stock, id], 
      (err) => {
          if (err) return res.status(500).send(err);
          res.status(200).json({ message: 'Product updated successfully' });
      }
  );
});

// Delete Product
app.delete('/deleteProduct/:id', (req, res) => {
  const { id } = req.params;
  connection.query('DELETE FROM products WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).send(err);
      res.status(200).json({ message: 'Product deleted successfully' });
  });
});

// User Management
app.post('/addUser', (req, res) => {
  const { first_name, last_name, email, password, contact_number, address, is_admin } = req.body;
  connection.query('INSERT INTO user (first_name, last_name, email, password, contact_number, address, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [first_name, last_name, email, password, contact_number, address, is_admin], 
      (err, result) => {
          if (err) return res.status(500).send(err);
          res.status(200).json({ id: result.insertId, first_name, last_name, email });
      }
  );
});

// 
app.get('/users', (req, res) => {
  connection.query('SELECT * FROM user', (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
  });
});

// 
app.put('/updateUser/:id', async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, contact_number, address, password, is_admin } = req.body;

  let updatedFields = [first_name, last_name, email, contact_number, address, is_admin, id];
  let updateQuery = 'UPDATE user SET first_name = ?, last_name = ?, email = ?, contact_number = ?, address = ?, is_admin = ? WHERE id = ?';

  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    updatedFields.splice(5, 0, hashedPassword); // Insert hashedPassword before is_admin
    updateQuery = 'UPDATE user SET first_name = ?, last_name = ?, email = ?, contact_number = ?, address = ?, password = ?, is_admin = ? WHERE id = ?';
  }

  connection.query(updateQuery, updatedFields, (err) => {
      if (err) return res.status(500).send(err);
      res.status(200).json({ message: 'User updated successfully' });
  });
});

// 
app.delete('/deleteUser/:id', (req, res) => {
  const { id } = req.params;
  connection.query('DELETE FROM user WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).send(err);
      res.status(200).json({ message: 'User deleted successfully' });
  });
});

// Get Order History
app.get('/orders', (req, res) => {
  const startDate = req.query.startDate || '1970-01-01';
  const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);
  
  connection.query('SELECT o.id as order_id, u.first_name, u.last_name, o.quantity, o.total_price, o.created_at FROM orders o JOIN user u ON o.user_id = u.id WHERE o.created_at BETWEEN ? AND ?', 
  [startDate, endDate], 
  (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
  });
});

// 
// Define a POST endpoint to handle form submissions
app.post('/add', async (req, res) => {
  // Extract data from the request body
  const { firstName, lastName, contactNumber, address, email, password } = req.body;

  // Validate received data
  if (!firstName || !lastName || !contactNumber || !address || !email || !password) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }
  
  try {
    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds, you can adjust it


  // Insert data into the 'user' table in the MySQL database
  const sql = 'INSERT INTO user (first_name, last_name, contact_number, address, email, password) VALUES (?, ?, ?, ?, ?, ?)';
  connection.query(sql, [firstName, lastName, contactNumber, address, email, hashedPassword], (err, results) => {
    if (err) {
      console.error('Error inserting data:', err);
      return res.status(500).json({ error: 'Error inserting data.' });
    }
    res.json({ message: 'User added successfully!' });
  });
   } catch (err) {
    console.error('Error hashing password:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Define a POST endpoint to handle login requests
app.post('/login', (req, res) => {
  // Extract data from the request body
  const { email, password } = req.body;

  // Validate received data
  if (!email || !password) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }

  // Check user credentials
  const sql = 'SELECT * FROM user WHERE email = ?';
  // AND password = ?';
  connection.query(sql, [email],  (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      return res.status(500).json({ error: 'Error querying the database.' });
    }

    if (results.length === 0) {
      return res.status(400).json({ error: 'User not found' });
    }

  const user = results[0];
    
// Compare provided password with stored hash
 bcrypt.compare(password, user.password, (err, isMatch) => {
  if (err) {
    console.error('Error comparing passwords:', err);
    return res.status(500).json({ error: 'Error comparing passwords.' });
  }

  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

    // Generate JWT token
      const token = jwt.sign({ id: user.id, email: user.email }, secretKey, { expiresIn: '3h' });

      res.json({
        message: 'Login successful!',
        token,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          contactNumber: user.contact_number,
          address: user.address
        }
      });
    });
  });
});

// GET /user/:id endpoint
app.get('/user/:id',authenticateToken, (req, res) => {
  const userId = req.params.id;

  const sql = 'SELECT * FROM user WHERE id = ?';
  connection.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      return res.status(500).json({ error: 'Error querying the database.' });
    }

    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ error: 'User not found.' });
    }
  });
});


// API endpoint to update profile
app.post('/api/updateProfile', authenticateToken, (req, res) => { 
  const { email, firstName, lastName, contactNumber, address } = req.body;

  // validation for required fields
  if (!email) {
      return res.status(400).json({ error: 'Email is required' });
  }

  const updateQuery = `
      INSERT INTO user (email, first_name, last_name, contact_number, address)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      first_name = VALUES(first_name),
      last_name = VALUES(last_name),
      contact_number = VALUES(contact_number),
      address = VALUES(address);
  `;

  // Execute the query to update or insert the profile
  connection.query(updateQuery, [email, firstName, lastName, contactNumber, address], (err, result) => {
      if (err) {
          console.error('Error updating profile:', err);
          return res.status(500).json({ error: 'Failed to update profile' });
      }

      res.json({ message: 'Profile updated successfully' });
  });
});


// Get Cart Items for a User
app.get('/api/cart', authenticateToken, (req, res) => {
  const userId = req.user.id; // Get the user ID from the token
  connection.query('SELECT * FROM cart WHERE user_id = ?', [userId], (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
  });
});

// Logout and Clear Cart
app.post('/logout', authenticateToken, (req, res) => {
  const userId = req.user.id; // Get the user ID from the token
  //
  connection.query('DELETE FROM cart WHERE user_id = ?', [userId], (err) => {
      if (err) return res.status(500).send(err);
      res.json({ message: 'Logged out and cart cleared successfully.' });
  });
});


// Update Product Quantity in Cart
app.put('/api/cart/:productId', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { quantity } = req.body; // Get the new quantity from the request body
  const productId = req.params.productId;

  // Update quantity in the cart
  connection.query('UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?', [quantity, userId, productId], (err) => {
      if (err) return res.status(500).send(err);
      res.json({ message: 'Quantity updated successfully.' });
  });
});

// Remove Product from Cart
app.delete('/api/cart/:productId', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId;

  // Delete product from the cart
  connection.query('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId], (err) => {
      if (err) return res.status(500).send(err);
      res.json({ message: 'Product removed from cart successfully.' });
  });
});

// 
// Mock database 
const users = [
  {
    id: 1,
    email: 'koshasolanki14@gmail.com',
    password: '$2b$10$qTJfoRlggiVx6XyX4U9WjOKe7Axq2pJ.4LlPomXx/VHR1ab7B.hZC', // Use bcrypt to hash the password
  },
];

// Admin Login Route
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Compare password
  bcrypt.compare(password, user.password, (err, isMatch) => {
    if (err) throw err;
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Create and assign a token
    const token = jwt.sign({ id: user.id }, secretKey, { expiresIn: '1h' });
    res.json({ token });
  });
});

// Start the server and listen on the specified port
app.listen(port, function(error) {
  if(error) throw error;
  // console.log(`Server running at http://127.0.0.1:${port}`);
  console.log("Server created Successfully");
});
