/**
 * FINGERPRINT BIOMETRIC ATTENDANCE SYSTEM BACKEND (Node.js/Express)
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

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// NOTE: In a real-world scenario, we would use 'mongoose' or 'pg' here for persistence.
// import mongoose from 'mongoose';
// mongoose.connect('mongodb://localhost:27017/attendance_db');

const app = express();
const PORT = 3000;

// --- Data Layer (Mock Database Collections) ---
// Simulating collections for persistence. In production, this would be a MongoDB or PostgreSQL instance.
const users = []; // Stores { id, name, fingerprintTemplate, createdAt }
const attendanceRecords = []; // Stores { id, userId, timestamp, type: 'IN' | 'OUT' }

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
const REQUIRED_API_KEY = process.env.ATTENDANCE_API_KEY || crypto.randomBytes(32).toString('hex');

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
 */
const identifyUserFromFingerprint = (incomingTemplate) => {
    // 1. COMPLEX ALGORITHM PLACEHOLDER:
    // This is where the heavy lifting happens: comparing the incoming vector against
    // all stored fingerprintTemplate attributes in the 'users' collection.

    // --- MOCK LOGIC ---
    // Since we can't run a real matching algorithm, we'll simulate a match.
    // A real fingerprint template might be an object or a specific string format, not just an array.
    if (!incomingTemplate || !Array.isArray(incomingTemplate) || incomingTemplate.length < 50) {
        console.warn("[MATCHING] Incoming fingerprint template is malformed or too short. Denying attendance.");
        return null;
    }

    // In a real system, the template must match a stored template within a specific tolerance threshold.
    // For this mock, we'll just find the first user to simulate a successful match for testing.
    const mockUser = users[0];
    if (mockUser) {
        console.log(`[ML] Successful match simulated for user: ${mockUser.id}`);
        return mockUser.id;
    }

    // If no match is found above the confidence threshold.
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
router.post('/users/enroll', (req, res) => {
    const { name, fingerprintTemplate } = req.body;

    if (!name || !fingerprintTemplate || !Array.isArray(fingerprintTemplate) || fingerprintTemplate.length === 0) {
        return res.status(400).json({ message: 'Missing required fields: name and fingerprintTemplate must be provided.' });
    }

    // Generate a unique ID (simulating MongoDB object ID or similar)
    const newUserId = crypto.randomBytes(4).toString('hex');

    const newUser = {
        id: newUserId,
        name,
        // CRITICAL: In a real DB, this template data must be indexed for fast lookups.
        fingerprintTemplate: fingerprintTemplate,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);

    console.log(`[USER] New student enrolled: ${newUser.name} (${newUser.id})`);
    return res.status(201).json({
        message: 'Student successfully enrolled and fingerprint data stored.',
        user: { id: newUser.id, name: newUser.name, createdAt: newUser.createdAt } // Do not return the template
    });
});

/**
 * POST /api/v1/attendance/check_in_out
 * Records an attendance event by identifying the user from the incoming fingerprint scan.
 * @body {Array<number>} incomingTemplate - The fingerprint template captured by the attendance terminal.
 */
router.post('/attendance/check_in_out', (req, res) => {
    const { incomingTemplate } = req.body;

    if (!incomingTemplate || !Array.isArray(incomingTemplate) || incomingTemplate.length === 0) {
        return res.status(400).json({ message: 'Missing required field: incomingTemplate.' });
    }

    // 1. Call the ML Service (MOCK) to identify the user
    const userId = identifyUserFromFingerprint(incomingTemplate);

    if (!userId) {
        // If the identity cannot be confirmed (e.g., low confidence or unrecognized face)
        console.warn(`[ATTENDANCE] Check-in attempt failed: Unrecognized fingerprint.`);
        return res.status(404).json({ message: 'Fingerprint not recognized. Please try again.' });
    }

    // 2. Find the user's last attendance record to determine if it's IN or OUT
    const lastRecord = attendanceRecords
        .filter(record => record.userId === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

    // Determine event type: If no record, or last record was 'OUT', it's an 'IN'. Otherwise, it's an 'OUT'.
    const eventType = (!lastRecord || lastRecord.type === 'OUT') ? 'IN' : 'OUT';

    // 3. Create the new attendance record
    const newRecord = {
        id: crypto.randomBytes(4).toString('hex'),
        userId,
        timestamp: new Date().toISOString(),
        type: eventType,
        device: req.ip // Useful for auditing which terminal was used
    };

    attendanceRecords.push(newRecord);

    const studentName = users.find(u => u.id === userId)?.name || 'Unknown Student';
    console.log(`[ATTENDANCE] Recorded ${eventType} for ${studentName} (${userId})`);

    return res.status(200).json({
        message: `${studentName}, your attendance has been recorded successfully. You are Clocked ${eventType}.`,
        record: {
            timestamp: newRecord.timestamp,
            type: newRecord.type
        }
    });
});

/**
 * GET /api/v1/attendance/report/:userId?
 * Retrieves attendance records. Can filter by optional userId.
 */
router.get('/attendance/report', (req, res) => {
    const userId = req.query.userId || req.params.userId;

    let report = attendanceRecords;

    if (userId) {
        // Filter by specific user
        report = attendanceRecords.filter(record => record.userId === userId);
        const studentExists = users.some(u => u.id === userId);
        if (!studentExists) {
            return res.status(404).json({ message: `Student ID ${userId} not found.` });
        }
    }

    // Enhance the report by adding the user name
    const detailedReport = report.map(record => {
        const user = users.find(u => u.id === record.userId); // 'user' is fine here as a local variable
        return {
            ...record,
            userName: user ? user.name : 'N/A'
        };
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by newest first

    return res.status(200).json({
        totalRecords: detailedReport.length,
        report: detailedReport
    });
});

// Attach the router to the main app instance
app.use('/api/v1', router);

// Health check endpoint (Does not require API key)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'Fingerprint Biometric Backend', mockDbStudents: users.length });
});

// --- Server Startup ---
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Backend Server is running on port ${PORT}`);
    console.log(`- API Key: loaded from environment`);
    console.log(`- Endpoints secured under /api/v1/*`);
    console.log(`======================================================\n`);
});