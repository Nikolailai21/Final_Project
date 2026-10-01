const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.get('/api', (req, res) => {
  res.json({ message: 'Course registration API is running' });
});

// Connect Database
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/csc220_db')
  .then(() => console.log('MongoDB Connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Register Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/offerings', require('./routes/offeringRoutes'));
app.use('/api/registrations', require('./routes/registrationRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));