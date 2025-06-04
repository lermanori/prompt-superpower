const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();
const { readData, writeData } = require('./utils/fileStore'); // Import fileStore utils

const app = express();
const PORT = process.env.PORT || 3001;

// Define file name for users
const USERS_FILE = 'users';

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from the main 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secure-secret-key'; // Use a strong secret

// Remove in-memory users array
// const users = []; // REMOVED

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT Verification Error:', err.message);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    // Add basic user info to request (ensure sign includes necessary fields)
    req.user = { id: user.id, email: user.email }; 
    next();
  });
};

// Auth routes using fileStore
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const users = await readData(USERS_FILE);

    if (users.find(user => user.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    await writeData(USERS_FILE, users);
    
    // Sign token with user ID and email
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '1h' }); // Add expiry
    
    console.log(`[Register] User ${newUser.email} registered successfully.`);
    // Return only the token
    res.status(201).json({ token });
  } catch (error) {
    console.error('[Register] Error:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
     if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const users = await readData(USERS_FILE);
    const user = users.find(user => user.email === email);

    if (!user) {
      console.warn(`[Login Attempt] Failed: User not found - ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.warn(`[Login Attempt] Failed: Invalid password - ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Sign token with user ID and email
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' }); // Add expiry
    
    console.log(`[Login] User ${user.email} logged in successfully.`);
    res.json({ token });
  } catch (error) {
    console.error('[Login] Error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Protected route example
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

// Import and use project routes
const projectRoutes = require('./routes/projects');
app.use('/api/projects', projectRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 