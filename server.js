/**
 * FINGERPRINT BIOMETRIC ATTENDANCE SYSTEM BACKEND (Node.js/Express) - PRODUCTION READY
 *
 * This file sets up a RESTful API using Express for a fingerprint-based student attendance system.
 * It mocks the database and the complex fingerprint matching service integration for demonstration.
 *
 * Architecture Focus:
 * 1. API Layer: Express handles routing, middleware, and request/response.
 * 2. Data Layer: In-memory arrays simulate MongoDB collections (Users and Attendance).
 * 3. Service Layer Integration: Placeholder for the actual Fingerprint Matching service call.
 * 4. Security: Basic API Key simulation for securing endpoints.
 */
// --- Production Dependencies ---
require('dotenv').config(); // Loads environment variables from a .env file into process.env
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Database Layer (Mongoose Schemas & Connection) ---

// 1. User Schema: Defines the structure for student records in the database.
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    // The fingerprint template is sensitive data. In a real-world high-security system,
    // this might be stored in a separate, more secure vault or service.
    fingerprintTemplate: { type: Array, required: true, select: false }, // `select: false` prevents it from being returned in queries by default.
    createdAt: { type: Date, default: Date.now }
});

// 2. Attendance Schema: Defines the structure for attendance log entries.
const AttendanceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Indexed for fast lookups
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ['IN', 'OUT'], required: true },
    device: { type: String } // IP address of the scanning device
});

// 3. Create Mongoose Models from Schemas
const User = mongoose.model('User', UserSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);

// 4. Establish Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('[DB] MongoDB connection successful.'))
    .catch(err => {
        console.error('[DB] MongoDB connection error:', err);
        process.exit(1); // Exit the process if DB connection fails on startup
    });


// --- Configuration and Middleware ---
// Using JSON parsing
app.use(bodyParser.json());

// Simple CORS middleware (Allows all origins for easy testing)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    next();
});

/**
 * --- Security Middleware (Simulated API Key) ---
 * A real system would use JWT, OAuth, or Firebase Authentication.
 * We'll use a simple header check to simulate an API gateway layer protection.
 */

// Read API key from environment if provided; otherwise generate a temporary one on startup.
// 32 bytes (64 hex characters) is a good starting point for a strong, random key.
const REQUIRED_API_KEY = process.env.ATTENDANCE_API_KEY;
if (!REQUIRED_API_KEY) {
    console.error('[FATAL] ATTENDANCE_API_KEY environment variable not set. Shutting down.');
    process.exit(1);
}

const apiAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === REQUIRED_API_KEY) {
        // Log successful auth and proceed
        console.log(`[AUTH] API Key validated for request: ${req.path}`);
        next();
    } else {
        // Deny access
        console.error(`[AUTH] Unauthorized Access Attempt from: ${req.ip}`);
        return res.status(401).json({ message: 'Unauthorized: Invalid or missing X-API-Key header.' });
    }
};

// Apply auth middleware to all /api/v1 routes
const router = express.Router();
router.use(apiAuth);


// ---------------------------------------------------------------------
// --- CORE FINGERPRINT MATCHING SERVICE (Simulated Logic) ---
// ---------------------------------------------------------------------

/**
 * Mocks the complex process of identifying a user based on a fingerprint template.
 * In production, this would be a call to a dedicated matching service that compares
 * the incoming fingerprint data (e.g., minutiae) against the stored templates.
 * @param {Array<number>} incomingTemplate - The fingerprint template captured by the scanner.
 * @returns {string | null} The userId if a match is found, otherwise null.
 *
 * PRODUCTION NOTE: This is the most complex part. A real implementation would:
 * 1. Fetch a batch of potential candidate templates from the database.
 * 2. Use a specialized library (e.g., a C++ addon for Node.js) to perform the 1-to-N comparison efficiently.
 * 3. Return the ID of the user with the highest matching score above a certain threshold.
 */
const identifyUserFromFingerprint = async (incomingTemplate) => {
    if (!incomingTemplate || !Array.isArray(incomingTemplate) || incomingTemplate.length < 50) {
        console.warn("[MATCHING] Incoming fingerprint template is malformed or too short. Denying attendance.");
        return null;
    }

    // --- PRODUCTION SIMULATION ---
    // This simulates the process. We fetch ALL users and their templates.
    // WARNING: This is INEFFICIENT and does NOT scale. Do not use `select('+fingerprintTemplate')`
    // like this in a real system with thousands of users. See "PRODUCTION NOTE" above.
    const allUsers = await User.find({}).select('+fingerprintTemplate');

    // MOCK COMPARISON: Find the first user. A real algorithm would compare `incomingTemplate`
    // against each `user.fingerprintTemplate`.
    const matchedUser = allUsers[0]; // Placeholder for real matching logic

    if (matchedUser) {
        console.log(`[MATCHING] Successful match simulated for user: ${matchedUser._id}`);
        return matchedUser._id; // Return the MongoDB ObjectId
    }

    return null;
};


// ---------------------------------------------------------------------
// --- API ENDPOINTS ---
// ---------------------------------------------------------------------

/**
 * POST /api/v1/users/enroll
 * Registers a new student and stores their initial fingerprint template.
 * @body {string} name - Student's full name.
 * @body {Array<number>} fingerprintTemplate - The data representing the user's fingerprint.
 */
router.post('/users/enroll', async (req, res) => {
    try {
        const { name, fingerprintTemplate } = req.body;

        if (!name || !fingerprintTemplate || !Array.isArray(fingerprintTemplate) || fingerprintTemplate.length === 0) {
            return res.status(400).json({ message: 'Missing required fields: name and fingerprintTemplate must be provided.' });
        }

        // Check if a user with the same name already exists to prevent duplicates
        const existingUser = await User.findOne({ name });
        if (existingUser) {
            return res.status(409).json({ message: `A student named '${name}' is already enrolled.` });
        }

        const newUser = new User({ name, fingerprintTemplate });
        await newUser.save();

        console.log(`[USER] New student enrolled: ${newUser.name} (${newUser._id})`);
        res.status(201).json({
            message: 'Student successfully enrolled and fingerprint data stored.',
            user: { id: newUser._id, name: newUser.name, createdAt: newUser.createdAt } // Return the DB-generated ID
        });
    } catch (error) {
        console.error('[ERROR] /users/enroll:', error);
        res.status(500).json({ message: 'An internal server error occurred during enrollment.' });
    }
});

/**
 * GET /api/v1/users
 * Retrieves a list of all enrolled students.
 * This is useful for the admin dashboard to display all registered users.
 */
router.get('/users', async (req, res) => {
    try {
        // Fetch all users from the database. The fingerprintTemplate is excluded by default due to `select: false` in the schema.
        const allUsers = await User.find({}).sort({ name: 1 }); // Sort alphabetically by name

        console.log(`[USER] Admin requested list of all ${allUsers.length} students.`);
        res.status(200).json(allUsers);
    } catch (error) {
        console.error('[ERROR] /users:', error);
        res.status(500).json({ message: 'An internal server error occurred while fetching students.' });
    }
});

/**
 * POST /api/v1/attendance/check_in_out
 * Records an attendance event by identifying the user from the incoming fingerprint scan.
 * @body {Array<number>} incomingTemplate - The fingerprint template captured by the attendance terminal.
 */
router.post('/attendance/check_in_out', async (req, res) => {
    try {
        const { incomingTemplate } = req.body;

        if (!incomingTemplate || !Array.isArray(incomingTemplate) || incomingTemplate.length === 0) {
            return res.status(400).json({ message: 'Missing required field: incomingTemplate.' });
        }

        // 1. Identify the user via the biometric service
        const userId = await identifyUserFromFingerprint(incomingTemplate);

        if (!userId) {
            console.warn(`[ATTENDANCE] Check-in attempt failed: Unrecognized fingerprint.`);
            return res.status(404).json({ message: 'Fingerprint not recognized. Please try again.' });
        }

        // 2. Find the user's most recent attendance record to determine the next event type
        const lastRecord = await Attendance.findOne({ userId }).sort({ timestamp: -1 });

        const eventType = (!lastRecord || lastRecord.type === 'OUT') ? 'IN' : 'OUT';

        // 3. Create and save the new attendance record
        const newRecord = new Attendance({
            userId,
            type: eventType,
            device: req.ip
        });
        await newRecord.save();

        // Fetch student details for the response message
        const student = await User.findById(userId);
        const studentName = student ? student.name : 'Unknown Student';

        console.log(`[ATTENDANCE] Recorded ${eventType} for ${studentName} (${userId})`);

        res.status(200).json({
            message: `${studentName}, your attendance has been recorded successfully. You are Clocked ${eventType}.`,
            record: {
                timestamp: newRecord.timestamp,
                type: newRecord.type
            }
        });
    } catch (error) {
        console.error('[ERROR] /attendance/check_in_out:', error);
        res.status(500).json({ message: 'An internal server error occurred while recording attendance.' });
    }
});

/**
 * GET /api/v1/attendance/report/:userId?
 * Retrieves attendance records. Can filter by optional userId.
 */
router.get('/attendance/report', async (req, res) => {
    try {
        const { userId } = req.query;
        const query = {};

        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ message: `Invalid Student ID format.` });
            }
            query.userId = userId;
        }

        // Use Mongoose's `populate` to automatically fetch the related user's name.
        // This is far more efficient than mapping and finding in a separate array.
        const report = await Attendance.find(query)
            .populate('userId', 'name') // 'userId' is the field, 'name' is the property from the User model to include
            .sort({ timestamp: -1 });

        res.status(200).json({
            totalRecords: report.length,
            report
        });
    } catch (error) {
        console.error('[ERROR] /attendance/report:', error);
        res.status(500).json({ message: 'An internal server error occurred while fetching the report.' });
    }
});

// Attach the router to the main app instance
app.use('/api/v1', router);

// Health check endpoint (Does not require API key)
app.get('/health', (req, res) => {
    // In production, this could also check the database connection status.
    res.status(200).json({ status: 'ok', service: 'Fingerprint Biometric Backend', dbState: mongoose.connection.readyState });
});

// --- Server Startup ---
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Backend Server is running on port ${PORT}`);
    console.log(`- API Key: Loaded from .env file`);
    console.log(`- Endpoints secured under /api/v1/*`);
    console.log(`======================================================\n`);
});