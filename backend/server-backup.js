const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const Database = require('better-sqlite3');
const app = express();
const PORT = process.env.PORT || 4000;
// ADD THESE LINES:
const DB_PATH = path.join(__dirname, 'data', 'claims.db');
let db;

// Initialize database
async function initDatabase() {
  try {
    await ensureDataDir();
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    
    await initClaimsTable();
    await initClaimLineItemsTable();
    await initClaimStatusHistoryTable();
    await initLocationBillingSettingsTable();
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}
// Middleware
// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:4173',  // ADD THIS LINE
    'http://localhost:4174',
    'http://localhost:4175',
    'http://localhost:5173',
    'https://std-operate-caroline-tile.trycloudflare.com',
    'https://app.leaddash.io',
    'https://ehr.leaddash.io',
    'https://app.gohighlevel.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-location-id', 'x-user-id']
}));
app.use(express.json());
// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    console.log('🔐 Login attempt for:', email);

    // Read the entire location-keys.json file
    const data = await fs.readFile(LOCATION_DATA_FILE, 'utf8');
    const allLocations = JSON.parse(data);

    // Search through all locations to find the user
    let foundUser = null;
    let foundLocationId = null;

    for (const [locationId, locationData] of Object.entries(allLocations)) {
      if (locationData.users) {
        const user = locationData.users.find(u => 
          u.email.toLowerCase() === email.toLowerCase()
        );
        
        if (user) {
          foundUser = user;
          foundLocationId = locationId;
          break;
        }
      }
    }

    if (!foundUser) {
      console.log('❌ User not found');
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // For demo, accept any password
    console.log('✅ Login successful for:', foundUser.firstName, foundUser.lastName);
    console.log('   Location ID:', foundLocationId);

    res.json({
      success: true,
      user: {
        id: foundUser.id,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
        email: foundUser.email,
        role: foundUser.role,
        type: foundUser.type,
        locationId: foundLocationId  // Send location ID to frontend
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Check user role for Agency Owner/Admin detection
app.post('/api/auth/check-role', async (req, res) => {
  try {
    const { userId, locationId } = req.body;
    
    if (!userId || !locationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId or locationId'
      });
    }

    console.log(`🔐 Checking role for user: ${userId} at location: ${locationId}`);
    
    const locationData = await readLocationData(locationId);
    
    if (!locationData) {
      console.error(`❌ Location ${locationId} not found`);
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    // Find the user in the location's users array
    const user = locationData.users?.find(u => u.id === userId);

    if (!user) {
      console.error(`❌ User ${userId} not found in location`);
      return res.status(404).json({
        success: false,
        error: 'User not found in this location'
      });
    }
    
    // Check if user is Agency Owner or Agency Admin
    const isAdmin = user.role === 'agency owner' || 
                    user.role === 'agency admin' ||
                    user.type === 'agency';
    
    console.log(`✅ User role check: ${user.firstName} ${user.lastName}`);
    console.log(`   Role: "${user.role}"`);
    console.log(`   Type: "${user.type}"`);
    console.log(`   Is Admin: ${isAdmin ? '✅ YES (Agency Owner/Admin)' : '❌ NO (Account User)'}`);
    
    res.json({
      success: true,
      isAdmin,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      type: user.type,
      userId,
      locationId
    });

  } catch (error) {
    console.error('❌ Error checking user role:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to verify user role',
      details: error.message
    });
  }
});

// GHL iframe authentication - fetches user from GHL API dynamically
app.post('/api/auth/iframe', async (req, res) => {
  try {
    const { locationId, userId } = req.body;
    
    console.log('🔐 GHL iframe authentication request');
    console.log('   Location ID:', locationId);
    console.log('   User ID:', userId);
    
    if (!locationId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'locationId and userId are required'
      });
    }
    
    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      console.log('❌ Location not found or no API key');
      return res.status(404).json({
        success: false,
        error: 'Location not configured'
      });
    }
    
    console.log('🔑 Fetching user from GHL API...');
    
    const response = await axios.get(
      `https://services.leadconnectorhq.com/users/${userId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${locationData.apiKey}`,
          'Version': '2021-07-28'
        }
      }
    );
    
    const ghlUser = response.data;
    
    console.log('✅ GHL user verified:', ghlUser.email);
    
    const isAdmin = ghlUser.role === 'admin' || 
                    ghlUser.type === 'agency' ||
                    ghlUser.role === 'agency owner';
    
    res.json({
      success: true,
      user: {
        id: ghlUser.id,
        firstName: ghlUser.firstName,
        lastName: ghlUser.lastName,
        email: ghlUser.email,
        role: ghlUser.role || 'user',
        type: ghlUser.type,
        locationId: locationId,
        isAdmin: isAdmin
      }
    });
    
  } catch (error) {
    console.error('❌ GHL user authentication failed:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'User authentication failed',
      details: error.response?.data?.message || error.message
    });
  }
});

// Path to store location data
const DATA_DIR = path.join(__dirname, 'data');
const LOCATION_DATA_FILE = path.join(__dirname, 'location-keys.json');
const NOTES_DATA_FILE = path.join(__dirname, 'notes-data.json');

// ============================================
// HELPER FUNCTIONS
// ============================================

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Read location data
async function readLocationData(locationId) {
  try {
    await ensureDataDir();
    const data = await fs.readFile(LOCATION_DATA_FILE, 'utf8');
    const locations = JSON.parse(data);
    return locations[locationId] || null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// Write location data
async function writeLocationData(locationId, data) {
  try {
    await ensureDataDir();
    let locations = {};
    
    try {
      const existingData = await fs.readFile(LOCATION_DATA_FILE, 'utf8');
      locations = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist yet, start fresh
    }
    
    locations[locationId] = data;
    await fs.writeFile(LOCATION_DATA_FILE, JSON.stringify(locations, null, 2));
  } catch (error) {
    console.error('Error writing location data:', error);
    throw error;
  }
}
// Read notes data
async function readNotesData() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(NOTES_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {}; // Return empty object if file doesn't exist
    }
    throw error;
  }
}

// Write notes data
async function writeNotesData(notesData) {
  try {
    await ensureDataDir();
    await fs.writeFile(NOTES_DATA_FILE, JSON.stringify(notesData, null, 2));
  } catch (error) {
    console.error('Error writing notes data:', error);
    throw error;
  }
}

// Add note to local storage
async function addNoteToLocalStorage(contactId, noteData) {
  const notesData = await readNotesData();
  
  if (!notesData[contactId]) {
    notesData[contactId] = [];
  }
  
  const noteWithId = {
    id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...noteData,
    dateAdded: new Date().toISOString()
  };
  
  console.log('📝 Adding note to local storage for contact:', contactId);
  console.log('📋 Note ID:', noteWithId.id);
  console.log('📊 Note type:', noteWithId.noteData?.type);
  console.log('📊 Note status:', noteWithId.noteData?.status);
  
  notesData[contactId].push(noteWithId);
  await writeNotesData(notesData);
  
  console.log('✅ Total notes for this contact:', notesData[contactId].length);
  
  return noteWithId;
}

// Get notes from local storage
async function getLocalNotes(contactId) {
  const notesData = await readNotesData();
  const notes = notesData[contactId] || [];
  console.log(`📖 Retrieved ${notes.length} notes from local storage for contact: ${contactId}`);
  if (notes.length > 0) {
    console.log('📋 Note statuses:', notes.map(n => n.noteData?.status || 'unknown'));
  }
  return notes;
}

// ============================================
// API KEY MANAGEMENT
// ============================================

// Save API key for a location
app.post('/api/save-api-key', async (req, res) => {
  try {
    const { locationId, apiKey } = req.body;

    if (!locationId || !apiKey) {
      return res.status(400).json({
        success: false,
        error: 'locationId and apiKey are required'
      });
    }

    // Verify the API key works by making a test call
    try {
      await axios.get('https://services.leadconnectorhq.com/locations/' + locationId, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28'
        }
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid API key or location ID'
      });
    }

    // Save the API key
    await writeLocationData(locationId, { apiKey, savedAt: new Date().toISOString() });

    res.json({
      success: true,
      message: 'API key saved successfully'
    });
  } catch (error) {
    console.error('Error saving API key:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save API key'
    });
  }
});

// Check if API key exists for a location
app.get('/api/check-api-key', async (req, res) => {
  try {
    const { locationId } = req.query;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'locationId is required'
      });
    }

    const locationData = await readLocationData(locationId);

    res.json({
      success: true,
      hasApiKey: !!locationData?.apiKey
    });
  } catch (error) {
    console.error('Error checking API key:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check API key'
    });
  }
});

// ============================================
// GHL API ENDPOINTS
// ============================================

// Get contacts (patients)
// Get appointments (LIVE from LeadDash)
app.get('/api/appointments', async (req, res) => {
  try {
    const { locationId, userId, contactId } = req.query;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'locationId is required'
      });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key not configured'
      });
    }

    console.log('📅 GET /api/appointments - Fetching LIVE from LeadDash');
    console.log('   Location ID:', locationId);
    console.log('   User ID:', userId);
    console.log('   Contact ID:', contactId);

    // Get date range (30 days past to 90 days future)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    // Fetch appointments from LeadDash API
    const response = await axios.get('https://services.leadconnectorhq.com/calendars/events', {
      headers: {
        'Authorization': `Bearer ${locationData.apiKey}`,
        'Version': '2021-07-28'
      },
      params: {
        locationId: locationId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        ...(locationData.calendarId && { calendarId: locationData.calendarId })
      }
    });

    let appointments = response.data.events || [];
    console.log(`✅ Found ${appointments.length} total appointments from LeadDash`);

    // Filter by contact if specified
    if (contactId && appointments.length > 0) {
      appointments = appointments.filter(apt => apt.contactId === contactId);
      console.log(`✅ Filtered to ${appointments.length} appointments for contact ${contactId}`);
    }

    // Filter by assigned user if specified
    if (userId && appointments.length > 0) {
      appointments = appointments.filter(apt => {
        const assignedTo = apt.assignedTo || apt.userId;
        return assignedTo === userId;
      });
      console.log(`✅ Filtered to ${appointments.length} appointments for user ${userId}`);
    }

    res.json({
      success: true,
      appointments: appointments
    });
  } catch (error) {
    console.error('❌ Error fetching appointments from LeadDash:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      appointments: []
    });
  }
});
// Get patients (LIVE from LeadDash)
app.get('/api/patients', async (req, res) => {
  try {
    const { locationId, userId } = req.query;
    
    console.log('📋 GET /api/patients');
    console.log('   Location:', locationId);
    console.log('   User:', userId);

    if (!locationId) {
      return res.status(400).json({ success: false, error: 'locationId required' });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      return res.status(404).json({ success: false, error: 'API key not configured' });
    }

    console.log('🔑 Fetching patients LIVE from LeadDash API...');

    // Fetch contacts from LeadDash API
    const response = await axios.get('https://services.leadconnectorhq.com/contacts/', {
      headers: {
        'Authorization': `Bearer ${locationData.apiKey}`,
        'Version': '2021-07-28'
      },
      params: {
        locationId: locationId,
        limit: 1000
      }
    });

    const allPatients = response.data.contacts || [];
    console.log(`✅ Found ${allPatients.length} total patients in LeadDash`);

    // Filter by assigned user if userId is provided
    let patients = allPatients;
    if (userId) {
      patients = allPatients.filter(patient => {
        const assignedTo = patient.assignedTo || patient.customFields?.assignedTo;
        return assignedTo === userId;
      });
      console.log(`✅ Filtered to ${patients.length} patients assigned to user ${userId}`);
    }

    res.json({ success: true, patients });
  } catch (error) {
    console.error('❌ Error fetching from LeadDash:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message, patients: [] });
  }
});

// Get single patient
app.get('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;

    console.log('📋 GET /api/patients/:id called');
    console.log('   Patient ID:', id);
    console.log('   Location ID:', locationId);

    if (!locationId) {
      console.log('❌ Missing locationId');
      return res.status(400).json({
        success: false,
        error: 'locationId is required'
      });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      console.log('❌ No API key found for location');
      return res.status(400).json({
        success: false,
        error: 'API key not configured'
      });
    }

    console.log('🔑 API Key found, calling GHL API...');
    console.log('   URL:', `https://services.leadconnectorhq.com/contacts/${id}`);

    const response = await axios.get(`https://services.leadconnectorhq.com/contacts/${id}`, {
      headers: {
        'Authorization': `Bearer ${locationData.apiKey}`,
        'Version': '2021-07-28'
      }
    });

    console.log('✅ GHL API responded successfully');
    console.log('   Response status:', response.status);
    console.log('   Has contact data:', !!response.data.contact);

    res.json({
      success: true,
      patient: response.data.contact
    });
  } catch (error) {
    console.error('❌ Error fetching patient:');
    console.error('   Status:', error.response?.status);
    console.error('   Status Text:', error.response?.statusText);
    console.error('   Error Message:', error.message);
    console.error('   GHL Response:', error.response?.data);
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch patient',
      details: error.response?.data
    });
  }
});

// Get patient notes (from both local storage and GHL) - FIXED TO SHOW ALL SAVED NOTES
app.get('/api/patients/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId, status } = req.query;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'locationId is required'
      });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key not configured'
      });
    }

    console.log('📝 Fetching notes for patient:', id);
    console.log('📊 Status filter:', status || 'all');

    // Get local notes first
    const localNotes = await getLocalNotes(id);
    console.log(`✅ Found ${localNotes.length} local notes`);

    // Try to get GHL notes
    let ghlNotes = [];
    try {
      const response = await axios.get(`https://services.leadconnectorhq.com/contacts/${id}/notes`, {
        headers: {
          'Authorization': `Bearer ${locationData.apiKey}`,
          'Version': '2021-07-28'
        }
      });
      ghlNotes = response.data.notes || [];
      console.log(`✅ Found ${ghlNotes.length} GHL notes`);
    } catch (error) {
      console.error('⚠️ Failed to fetch GHL notes:', error.response?.data || error.message);
      // Continue with local notes even if GHL fails
    }

    // Combine local and GHL notes
    // Filter out local notes that have been synced to GHL to avoid duplicates
    const unsyncedLocalNotes = localNotes.filter(note => !note.ghlSynced);
    let allNotes = [...unsyncedLocalNotes, ...ghlNotes];

    // Apply status filter if provided
    if (status) {
      allNotes = allNotes.filter(note => {
        const noteStatus = note.noteData?.status || 'draft';
        if (status === 'locked') {
          return noteStatus === 'locked' || noteStatus === 'signed';
        }
        if (status === 'draft') {
          return noteStatus === 'draft' || noteStatus === 'saved';
        }
        return noteStatus === status;
      });
      console.log(`✅ Filtered to ${allNotes.length} notes with status: ${status}`);
    } else {
      console.log(`✅ Returning ALL saved notes (no filter applied)`);
    }

    console.log(`✅ Total notes returned: ${allNotes.length} (${unsyncedLocalNotes.length} local + ${ghlNotes.length} GHL)`);

    res.json({
      success: true,
      notes: allNotes,
      counts: {
        total: allNotes.length,
        local: unsyncedLocalNotes.length,
        ghl: ghlNotes.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching patient notes:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch patient notes',
      notes: []
    });
  }
});



// Get single appointment
app.get('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'locationId is required'
      });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key not configured'
      });
    }

    const response = await axios.get(`https://services.leadconnectorhq.com/appointments/${id}`, {
      headers: {
        'Authorization': `Bearer ${locationData.apiKey}`,
        'Version': '2021-07-28'
      }
    });

    res.json({
      success: true,
      appointment: response.data
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch appointment'
    });
  }
});

// Delete appointment
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'locationId is required'
      });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key not configured'
      });
    }

    await axios.delete(`https://services.leadconnectorhq.com/appointments/${id}`, {
      headers: {
        'Authorization': `Bearer ${locationData.apiKey}`,
        'Version': '2021-07-28'
      }
    });

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete appointment'
    });
  }
});

// Get IP address
app.get('/api/get-ip', (req, res) => {
  // Get the real IP address, handling proxy scenarios
  let ip = req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           'Unknown';
  
  // x-forwarded-for can contain multiple IPs, get the first one
  if (ip && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  
  // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  console.log('🌐 IP Address detected:', ip);
  
  res.json({ ip: ip });
});

// Save case note
// Save case note
app.post('/api/notes/save', async (req, res) => {
  try {
    const { locationId, contactId, noteData } = req.body;

    if (!locationId || !contactId) {
      return res.status(400).json({
        success: false,
        error: 'locationId and contactId are required'
      });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key not configured'
      });
    }

   // Get patient name from noteData
    const patientName = noteData.patientName || 'Unknown Patient';
    
    // Format note body - Professional Case Note Style
    const noteBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    .progress-note-container {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0;
      color: #000;
      background: white;
    }
    @media print {
      .progress-note-container {
        padding: 0.5in;
      }
    }
    .header {
      text-align: right;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      font-size: 22pt;
      color: #2c5aa0;
      font-weight: bold;
    }
    .info-grid {
  width: 100%;
  margin-bottom: 20px;
}
.info-row {
  display: flex;
  margin-bottom: 8px;
}
.info-cell {
  padding: 4px 12px 4px 0;
  vertical-align: top;
}
    .info-label {
      font-weight: 600;
      width: 35%;
    }
    .section-title {
      font-weight: bold;
      font-size: 11pt;
      margin: 20px 0 8px 0;
      padding: 6px 0;
      border-bottom: 1px solid #333;
    }
    .section-content {
      margin: 10px 0 20px 0;
      text-align: justify;
      white-space: pre-wrap;
    }
    .checkbox-group {
      margin: 10px 0;
    }
    .checkbox-item {
      display: inline-block;
      margin-right: 15px;
    }
    .risk-section {
  padding: 15px 0;
  margin: 15px 0;
}
.signature-section {
  margin-top: 40px;
  padding: 20px 0;
  border-top: 2px solid #333;
  border-bottom: 2px solid #333;
}
    .signature-line {
      margin: 30px 0 10px 0;
      border-bottom: 2px solid #000;
      width: 60%;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 9pt;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 15px;
    }
    @media print {
      body { padding: 0.5in; }
    }
  </style>
</head>
<body>

<div class="progress-note-container">

<!-- Header -->
<div class="header">
  <h1>Progress Note</h1>
</div>

<!-- Basic Information Grid -->
<div class="info-grid">
  <div class="info-row">
    <div class="info-cell info-label">Client Name:</div>
    <div class="info-cell">${patientName}</div>
    <div class="info-cell info-label">Date of Service:</div>
    <div class="info-cell">${new Date(noteData.sessionInfo.sessionDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}</div>
  </div>
  <div class="info-row">
    <div class="info-cell info-label">Length of Session:</div>
    <div class="info-cell">${noteData.sessionInfo.duration}min</div>
    <div class="info-cell info-label">Location of Service:</div>
    <div class="info-cell">${noteData.sessionInfo.sessionType ? noteData.sessionInfo.sessionType.charAt(0).toUpperCase() + noteData.sessionInfo.sessionType.slice(1) : 'Office'}</div>
  </div>
  <div class="info-row">
    <div class="info-cell info-label">CPT Code:</div>
    <div class="info-cell">${noteData.sessionInfo.cptCode}</div>
    <div class="info-cell info-label">Diagnosis/ICD Code:</div>
    <div class="info-cell">${noteData.formData.diagnosisAxis1 || 'Not specified'}</div>
  </div>
</div>

<!-- Present at Session -->
<div class="section-title">Present at Session</div>
<div class="checkbox-group">
  <div class="checkbox-item">☒ Client Present</div>
  <div class="checkbox-item">☐ Client No showed/cancelled</div>
  <div class="checkbox-item">☐ Others Present</div>
</div>

<!-- Significant Changes -->
<div class="section-title">Significant Changes in Client's Condition</div>
<div class="checkbox-group">
  <div class="checkbox-item">☐ No significant change from last visit</div>
  <div class="checkbox-item">${noteData.formData.mood ? '☒' : '☐'} Mood/Affect</div>
  <div class="checkbox-item">${noteData.formData.thoughtProcess?.length ? '☒' : '☐'} Thought Process/Orientation</div>
  <div class="checkbox-item">${noteData.formData.behavior?.length ? '☒' : '☐'} Behavior/Functioning</div>
</div>

<!-- Risk Assessment -->
<div class="section-title">Danger to:</div>
<div class="checkbox-group">
  <div class="checkbox-item">${noteData.formData.suicidalIdeation !== 'Denied' ? '☒' : '☐'}Self</div>
  <div class="checkbox-item">${noteData.formData.homicidalIdeation !== 'Denied' ? '☒' : '☐'}Others</div>
  <div class="checkbox-item">☐Property</div>
  <div class="checkbox-item">${noteData.formData.suicidalIdeation === 'Denied' && noteData.formData.homicidalIdeation === 'Denied' ? '☒' : '☐'}None</div>
</div>
<div class="checkbox-group">
  <div class="checkbox-item">${noteData.formData.suicidalIdeation === 'Passive' || noteData.formData.suicidalIdeation === 'Active' ? '☒' : '☐'}Ideation</div>
  <div class="checkbox-item">${noteData.formData.suicidalIdeation === 'Active' ? '☒' : '☐'}Plan</div>
  <div class="checkbox-item">${noteData.formData.suicidalIdeation === 'Intent' ? '☒' : '☐'}Intent</div>
  <div class="checkbox-item">☐Means</div>
  <div class="checkbox-item">☐Attempt</div>
</div>

<div class="section-title">Specifics Regarding Risk Assessment (Include safety planning, reports made, etc.):</div>
<div class="section-content">${noteData.formData.safetyPlan || 'Client denied current suicidal ideation, homicidal ideation, and self-harm behavior. No safety concerns identified at this time.'}</div>

<!-- Focus of Session -->
<div class="section-title">Focus of Session (Client's complaints, symptoms, new precipitators, etc.)</div>
<div class="section-content">${noteData.formData.chiefComplaint ? noteData.formData.chiefComplaint + '\n\n' : ''}${noteData.formData.presentingProblem || 'Not documented'}</div>

<!-- Mental Status Exam Summary -->
${noteData.formData.appearance?.length || noteData.formData.mood || noteData.formData.affect?.length ? `
<div class="section-title">Mental Status Examination</div>
<div class="section-content">Client presented with the following: 
${noteData.formData.appearance?.length ? '\nAppearance: ' + noteData.formData.appearance.join(', ') + '.' : ''}
${noteData.formData.behavior?.length ? '\nBehavior: ' + noteData.formData.behavior.join(', ') + '.' : ''}
${noteData.formData.speech?.length ? '\nSpeech: ' + noteData.formData.speech.join(', ') + '.' : ''}
${noteData.formData.mood ? '\nMood: ' + noteData.formData.mood + '.' : ''}
${noteData.formData.affect?.length ? '\nAffect: ' + noteData.formData.affect.join(', ') + '.' : ''}
${noteData.formData.thoughtProcess?.length ? '\nThought Process: ' + noteData.formData.thoughtProcess.join(', ') + '.' : ''}
${noteData.formData.thoughtContent?.length ? '\nThought Content: ' + noteData.formData.thoughtContent.join(', ') + '.' : ''}
${noteData.formData.orientation?.length ? '\nOrientation: ' + noteData.formData.orientation.join(', ') + '.' : ''}
${noteData.formData.memory?.length ? '\nMemory: ' + noteData.formData.memory.join(', ') + '.' : ''}
${noteData.formData.insight ? '\nInsight: ' + noteData.formData.insight + '.' : ''}
${noteData.formData.judgment ? '\nJudgment: ' + noteData.formData.judgment + '.' : ''}
</div>
` : ''}

<!-- Therapeutic Interventions -->
<div class="section-title">Therapeutic Intervention(s) and Response to Interventions (How did the service address the beneficiary's behavioral health needs; how did client respond to intervention):</div>
<div class="section-content">${noteData.formData.interventions || 'Not documented'}</div>

<!-- Treatment Goals and Progress -->
${noteData.formData.treatmentGoals || noteData.formData.progress ? `
<div class="section-title">Progress Toward Treatment Goals</div>
<div class="section-content">${noteData.formData.treatmentGoals ? 'Treatment Goals: ' + noteData.formData.treatmentGoals + '\n\n' : ''}${noteData.formData.progress || ''}</div>
` : ''}

<!-- Clinical Impression -->
${noteData.formData.clinicalImpression ? `
<div class="section-title">Clinical Impression</div>
<div class="section-content">${noteData.formData.clinicalImpression}
${noteData.formData.prognosis ? '\n\nPrognosis: ' + noteData.formData.prognosis : ''}</div>
` : ''}

<!-- Next Steps -->
<div class="section-title">Next Steps (Planned action steps by the provider or beneficiary, collaboration with the beneficiary, and/or collaboration with other provider(s)):</div>
<div class="section-content">${noteData.formData.homework || noteData.formData.recommendations || 'Continue current treatment plan.'}</div>

<!-- Follow-up -->
${noteData.formData.nextSession ? `
<div style="margin: 20px 0;">
  <strong>Follow-up Appointment:</strong> ${new Date(noteData.formData.nextSession).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
</div>
` : ''}

<!-- Signature Section -->
<div class="signature-section">
  ${noteData.signature ? `
  <div style="font-weight: bold; color: #2e7d32; margin-bottom: 15px;">✓ ELECTRONICALLY SIGNED</div>
  <div><strong>Clinician Signature:</strong> ${noteData.signature.therapistName}, ${noteData.signature.credentials}</div>
  <div style="margin-top: 10px;"><strong>Clinician Printed Name:</strong> ${noteData.signature.therapistName}, ${noteData.signature.credentials}</div>
  <div style="margin-top: 10px;"><strong>Date:</strong> ${new Date(noteData.signature.signedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}</div>
  <div style="margin-top: 10px; font-size: 9pt; color: #666;">Electronically signed on ${new Date(noteData.signature.signedAt).toLocaleString('en-US')} from IP ${noteData.signature.ipAddress}</div>
  ` : `
  <div style="font-weight: bold; color: #856404; margin-bottom: 15px;">⚠ DRAFT - NOT SIGNED</div>
  <div><strong>Clinician Name:</strong> ${noteData.therapist.name}, ${noteData.therapist.credentials}</div>
  <div style="margin-top: 10px; font-style: italic; color: #666;">This note is in draft status and requires electronic signature.</div>
  `}
</div>

<!-- Footer -->
<div class="footer">
  <p>Generated by LeadDash Clinical Documentation System</p>
  <p>Created: ${new Date(noteData.timestamps.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
</div>

</div><!-- end progress-note-container -->

</body>
</html>
   `.trim();

    console.log('💾 Saving note with status:', noteData.status);
    console.log('📋 Patient name:', patientName);
    console.log('🔑 Contact ID:', contactId);

   // Save to local storage first
    const localNote = await addNoteToLocalStorage(contactId, {
      body: noteBody,
      noteData: noteData,  // Include the full noteData structure
      ghlSynced: false
    });

    console.log('✅ Note saved locally with ID:', localNote.id);
    console.log('📊 Note data:', JSON.stringify(localNote.noteData, null, 2));

    console.log('✅ Note saved locally with ID:', localNote.id);

    // Try to save to GHL
    let ghlNote = null;
    try {
      // Get user ID from localStorage or use a default
      const userStr = req.body.userId || 'system';
      
      const ghlResponse = await axios.post(
        `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
        {
          userId: userStr,
          body: noteBody
        },
        {
          headers: {
            'Authorization': `Bearer ${locationData.apiKey}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          }
        }
      );

      ghlNote = ghlResponse.data;
      
      // Update local note to mark as synced
      const notesData = await readNotesData();
      const noteIndex = notesData[contactId].findIndex(n => n.id === localNote.id);
      if (noteIndex !== -1) {
        notesData[contactId][noteIndex].ghlSynced = true;
        notesData[contactId][noteIndex].ghlId = ghlNote.id;
        await writeNotesData(notesData);
      }

      console.log('✅ Note saved to GHL and synced');
    } catch (ghlError) {
      console.error('⚠️ Failed to save to GHL (saved locally):', ghlError.response?.data || ghlError.message);
      // Note is already saved locally, so we can continue
    }

    res.json({
      success: true,
      note: localNote,
      ghlNote: ghlNote,
      savedLocally: true,
      savedToGHL: !!ghlNote
    });
  } catch (error) {
    console.error('❌ Error saving note:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to save note'
    });
  }
});


// Get all custom fields and create mapping
app.get('/api/field-mapping', async (req, res) => {
  try {
    const { locationId } = req.query;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'locationId required' });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      return res.status(400).json({ success: false, error: 'API key not configured' });
    }

    console.log('📋 Fetching custom field mappings from GHL...');

    const response = await axios.get(
      'https://services.leadconnectorhq.com/custom-fields/',
      {
        headers: {
          'Authorization': `Bearer ${locationData.apiKey}`,
          'Version': '2021-07-28'
        },
        params: {
          locationId: locationId
        }
      }
    );

    const customFields = response.data.customFields || [];
    
    // Filter only contact fields
    const contactFields = customFields.filter(f => f.model === 'contact');

    // Create mapping: field_key -> field_id
    const fieldMapping = {};
    contactFields.forEach(field => {
      fieldMapping[field.key] = {
        id: field.id,
        name: field.name,
        dataType: field.dataType
      };
    });

    // Save mapping to location data for future use
    await writeLocationData(locationId, {
      ...locationData,
      fieldMapping: fieldMapping,
      lastFieldMappingUpdate: new Date().toISOString()
    });

    console.log(`✅ Mapped ${Object.keys(fieldMapping).length} custom fields`);

    res.json({
      success: true,
      totalFields: Object.keys(fieldMapping).length,
      mapping: fieldMapping
    });
  } catch (error) {
    console.error('❌ Error fetching field mapping:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// ============================================
// STAFF ENDPOINTS
// ============================================

// Get all staff from location-keys.json
app.get('/api/staff', async (req, res) => {
  try {
    const { locationId } = req.query;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'locationId is required'
      });
    }

    console.log('👥 Fetching staff from location-keys.json for location:', locationId);

    const locationData = await readLocationData(locationId);
    
    if (!locationData) {
      console.log('⚠️ Location not found');
      return res.json({
        success: true,
        staff: []
      });
    }

    const staff = locationData.users || [];
    console.log(`✅ Found ${staff.length} staff members`);

    res.json({
      success: true,
      staff: staff,
      count: staff.length
    });
  } catch (error) {
    console.error('❌ Error fetching staff:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch staff'
    });
  }
});

// Get single staff member
app.get('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'locationId is required'
      });
    }

    console.log('👤 Fetching staff member:', id);

    const locationData = await readLocationData(locationId);
    
    if (!locationData) {
      return res.status(404).json({
        success: false,
        error: 'Location not found'
      });
    }

    const staffMember = locationData.users?.find(u => u.id === id);

    if (!staffMember) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }

    console.log('✅ Staff member found:', staffMember.firstName, staffMember.lastName);

    res.json({
      success: true,
      staff: staffMember
    });
  } catch (error) {
    console.error('❌ Error fetching staff member:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch staff member'
    });
  }
});

// ============================================
// INSURANCE PAYMENT ENDPOINTS
// ============================================

// Get payers list
app.get('/api/payers', async (req, res) => {
  try {
    const { locationId } = req.query;

    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'locationId is required'
      });
    }

    console.log('📋 Fetching payers for location:', locationId);

    // For now, return mock data
    const mockPayers = [
      { id: 'payer1', name: 'Blue Cross Blue Shield' },
      { id: 'payer2', name: 'Aetna' },
      { id: 'payer3', name: 'United Healthcare' },
      { id: 'payer4', name: 'Cigna' },
      { id: 'payer5', name: 'Medicare' },
      { id: 'payer6', name: 'Medicaid' }
    ];

    res.json({
      success: true,
      payers: mockPayers
    });
  } catch (error) {
    console.error('❌ Error fetching payers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payers'
    });
  }
});

// Fetch invoices from GHL for a specific contact
app.get('/api/invoices/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const locationId = req.headers['x-location-id'];

    if (!locationId) {
      console.log('❌ No location ID provided');
      return res.status(400).json({ error: 'Location ID is required' });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      console.log('❌ Location configuration not found for:', locationId);
      return res.status(404).json({ error: 'Location configuration not found' });
    }

    console.log(`📄 Fetching GHL invoices for contact: ${contactId}`);

    // Fetch invoices from GHL
    const response = await axios.get(
      `https://services.leadconnectorhq.com/invoices/`, 
      {
        headers: {
          'Authorization': `Bearer ${locationData.apiKey}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        },
        params: {
          altId: locationId,
          altType: 'location',
          contactId: contactId,
          limit: 100,
          offset: '0'
        }
      }
    );

    console.log(`✅ Found ${response.data.invoices?.length || 0} invoices`);
    
    // ADD THIS: Log the first invoice to see its structure
    if (response.data.invoices && response.data.invoices.length > 0) {
      console.log('📋 Sample invoice structure:', JSON.stringify(response.data.invoices[0], null, 2));
    }
    
    res.json({ 
      success: true,
      invoices: response.data.invoices || [],
      total: response.data.total || 0
    });

  } catch (error) {
    console.error('❌ Error fetching GHL invoices:', error.response?.data || error.message);
    
    res.json({ 
      success: false,
      invoices: [], 
      total: 0,
      error: error.response?.data?.message || error.message 
    });
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, async () => {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 LeadDash Backend Server Running
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Port: ${PORT}
🌐 URL: http://localhost:${PORT}
📁 Data Dir: ${DATA_DIR}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
  
  await ensureDataDir();
  await initDatabase();  // ADD THIS LINE
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});
// ============================================
// CLAIMS TABLES INITIALIZATION (GHL-Native)
// ============================================

const initClaimsTable = async () => {
  const claimsTable = `
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      claimNumber TEXT UNIQUE NOT NULL,
      
      -- GHL References (pull fresh data on demand)
      ghlInvoiceId TEXT NOT NULL,
      ghlContactId TEXT NOT NULL,
      ghlLocationId TEXT NOT NULL,
      
      -- Dates
      serviceDate TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      submittedAt TEXT,
      
      -- Financial (calculated from invoice)
      totalAmount REAL NOT NULL,
      paidAmount REAL DEFAULT 0,
      
      -- Claim Status
      status TEXT DEFAULT 'draft',
      clearinghouseReferenceNumber TEXT,
      payerClaimNumber TEXT,
      
      -- Validation
      validationErrors TEXT,
      lastValidatedAt TEXT,
      
      -- Clearinghouse Info (for when API is connected)
      clearinghouseProvider TEXT,
      clearinghouseSubmissionId TEXT,
      ediFileName TEXT,
      
      -- Overrides (only if user manually changes data)
      overriddenData TEXT,
      
      -- Notes
      notes TEXT,
      
      -- Tracking
      updatedAt TEXT
    )
  `;

  await db.exec(claimsTable);
  console.log('✅ Claims table initialized (GHL-native)');
};

const initClaimLineItemsTable = async () => {
  const claimLineItemsTable = `
    CREATE TABLE IF NOT EXISTS claim_line_items (
      id TEXT PRIMARY KEY,
      claimId TEXT NOT NULL,
      
      -- GHL Reference
      ghlInvoiceItemId TEXT,
      
      -- Service Info
      procedureCode TEXT NOT NULL,
      modifiers TEXT,
      description TEXT,
      
      -- Dates
      serviceDateFrom TEXT NOT NULL,
      serviceDateTo TEXT,
      
      -- Financial
      chargeAmount REAL NOT NULL,
      units INTEGER DEFAULT 1,
      
      -- Diagnosis pointer (links to claim diagnosis codes)
      diagnosisPointer TEXT DEFAULT '1',
      
      -- Place of service code
      placeOfService TEXT DEFAULT '11',
      
      -- Emergency indicator
      emergencyIndicator TEXT,
      
      createdAt TEXT NOT NULL,
      
      FOREIGN KEY (claimId) REFERENCES claims(id) ON DELETE CASCADE
    )
  `;

  await db.exec(claimLineItemsTable);
  console.log('✅ Claim line items table initialized');
};

const initClaimStatusHistoryTable = async () => {
  const claimStatusHistoryTable = `
    CREATE TABLE IF NOT EXISTS claim_status_history (
      id TEXT PRIMARY KEY,
      claimId TEXT NOT NULL,
      
      -- Status info
      status TEXT NOT NULL,
      statusDate TEXT NOT NULL,
      
      -- Details
      statusCode TEXT,
      statusDescription TEXT,
      payerResponse TEXT,
      
      -- Tracking
      notes TEXT,
      changedBy TEXT,
      isAutomated INTEGER DEFAULT 0,
      
      FOREIGN KEY (claimId) REFERENCES claims(id) ON DELETE CASCADE
    )
  `;

  await db.exec(claimStatusHistoryTable);
  console.log('✅ Claim status history table initialized');
};

// Location settings for billing (NPI, Tax ID, etc.)
const initLocationBillingSettingsTable = async () => {
  const locationBillingTable = `
    CREATE TABLE IF NOT EXISTS location_billing_settings (
      id TEXT PRIMARY KEY,
      locationId TEXT UNIQUE NOT NULL,
      
      -- Provider Info
      providerNPI TEXT,
      providerName TEXT,
      providerTaxId TEXT,
      providerTaxonomy TEXT,
      
      -- Practice Info
      practiceName TEXT,
      practiceAddress1 TEXT,
      practiceAddress2 TEXT,
      practiceCity TEXT,
      practiceState TEXT,
      practiceZip TEXT,
      practicePhone TEXT,
      
      -- Billing Contact
      billingContactName TEXT,
      billingContactPhone TEXT,
      billingContactEmail TEXT,
      
      -- Clearinghouse Settings
      clearinghouseProvider TEXT,
      clearinghouseUsername TEXT,
      clearinghousePassword TEXT,
      clearinghouseApiKey TEXT,
      
      -- Default Settings
      defaultPlaceOfService TEXT DEFAULT '11',
      
      -- Timestamps
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `;

  await db.exec(locationBillingTable);
  console.log('✅ Location billing settings table initialized');
};
// ============================================
// CLAIMS ENDPOINTS (GHL-NATIVE)
// ============================================

// Helper: Get fresh claim data from GHL
const getClaimDataFromGHL = async (ghlInvoiceId, ghlContactId, ghlLocationId, apiKey) => {
  try {
    // Fetch invoice from GHL
    const invoiceResponse = await axios.get(
      `https://services.leadconnectorhq.com/invoices/${ghlInvoiceId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28'
        }
      }
    );
    
    // Fetch contact from GHL
    const contactResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${ghlContactId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28'
        }
      }
    );
    
    const invoice = invoiceResponse.data.invoice;
    const contact = contactResponse.data.contact;
    
    // Map GHL data to claim format
    return {
      // Patient Info (from contact)
      patient: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        dateOfBirth: contact.customFields?.dateOfBirth || contact.dateOfBirth,
        gender: contact.customFields?.gender || contact.gender,
        address1: contact.address1,
        city: contact.city,
        state: contact.state,
        postalCode: contact.postalCode,
        phone: contact.phone,
        email: contact.email
      },
      
      // Insurance Info (from contact custom fields)
      insurance: {
        payerName: contact.customFields?.insurancePrimaryCarrier,
        memberId: contact.customFields?.insurancePrimaryMemberId,
        groupNumber: contact.customFields?.insurancePrimaryGroupNumber,
        policyHolderName: contact.customFields?.insurancePolicyHolderName,
        policyHolderDOB: contact.customFields?.insurancePolicyHolderDob,
        relationshipToPatient: contact.customFields?.insuranceRelationshipToPatient
      },
      
      // Diagnosis (from contact)
      diagnosis: {
        code1: contact.customFields?.primaryDiagnosisCode,
        description1: contact.customFields?.primaryDiagnosisDescription,
        code2: contact.customFields?.secondaryDiagnosisCode,
        description2: contact.customFields?.secondaryDiagnosisDescription
      },
      
      // Referring Provider (from contact)
      referringProvider: {
        name: contact.customFields?.referringProviderName,
        npi: contact.customFields?.referringProviderNpi
      },
      
      // Invoice/Service Info
      service: {
        serviceDate: invoice.createdAt,
        totalAmount: invoice.total,
        items: invoice.items || []
      }
    };
    
  } catch (error) {
    console.error('❌ Error fetching claim data from GHL:', error.response?.data || error.message);
    throw error;
  }
};

// Create claim from invoice
app.post('/api/claims/from-invoice/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const locationId = req.headers['x-location-id'];
    const { contactId, invoiceData } = req.body; // Get invoice data from frontend

    if (!locationId || !contactId || !invoiceData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Location ID, Contact ID, and Invoice Data required' 
      });
    }

    const locationData = await readLocationData(locationId);
    
    if (!locationData || !locationData.apiKey) {
      return res.status(404).json({ 
        success: false, 
        error: 'Location configuration not found' 
      });
    }

    console.log(`📋 Creating claim from invoice: ${invoiceId}`);

    // Generate claim number
    const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const claimId = `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use invoice data directly from frontend
    const serviceDate = invoiceData.issueDate || invoiceData.createdAt || new Date().toISOString();
    const totalAmount = invoiceData.total || invoiceData.invoiceTotal || 0;

    // Create claim record
    const claim = {
      id: claimId,
      claimNumber: claimNumber,
      ghlInvoiceId: invoiceId,
      ghlContactId: contactId,
      ghlLocationId: locationId,
      serviceDate: serviceDate,
      totalAmount: totalAmount,
      paidAmount: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Insert claim
    const insertClaimStmt = db.prepare(`
      INSERT INTO claims (
        id, claimNumber, ghlInvoiceId, ghlContactId, ghlLocationId,
        serviceDate, totalAmount, paidAmount, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertClaimStmt.run(
      claim.id,
      claim.claimNumber,
      claim.ghlInvoiceId,
      claim.ghlContactId,
      claim.ghlLocationId,
      claim.serviceDate,
      claim.totalAmount,
      claim.paidAmount,
      claim.status,
      claim.createdAt,
      claim.updatedAt
    );

    // Create line items from invoice items
    const insertLineItemStmt = db.prepare(`
      INSERT INTO claim_line_items (
        id, claimId, ghlInvoiceItemId, procedureCode, description,
        serviceDateFrom, chargeAmount, units, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const items = invoiceData.items || invoiceData.invoiceItems || invoiceData.lineItems || [];
    for (const item of items) {
      const lineItemId = `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      insertLineItemStmt.run(
        lineItemId,
        claimId,
        item._id || item.id || null,
        item.cptCode || item.procedureCode || 'MISSING',
        item.name || item.description || 'Service',
        claim.serviceDate,
        item.amount || item.price || 0,
        item.qty || item.quantity || 1,
        new Date().toISOString()
      );
    }

    // Add initial status history
    const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const insertHistoryStmt = db.prepare(`
      INSERT INTO claim_status_history (
        id, claimId, status, statusDate, notes, isAutomated
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertHistoryStmt.run(
      historyId,
      claimId,
      'draft',
      new Date().toISOString(),
      'Claim created from invoice',
      1
    );

    console.log(`✅ Claim created: ${claimNumber}`);

    res.json({
      success: true,
      claim: claim
    });

  } catch (error) {
    console.error('❌ Error creating claim:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get claim details
app.get('/api/claims/:claimId', async (req, res) => {
  console.log('\n📋 ============ GET CLAIM ENDPOINT HIT ============');
  
  try {
    const { claimId } = req.params;
    const locationId = req.headers['x-location-id'];

    console.log('   Claim ID from params:', claimId);
    console.log('   Location ID from headers:', locationId);

    // Get claim from database
    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId);
    
    console.log('   Database query result:', claim ? 'FOUND' : 'NOT FOUND');
    
    if (!claim) {
      console.log('❌ Claim not found in database with ID:', claimId);
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    console.log('✅ Claim found:', claim.claimNumber);

    // Get line items
    const lineItems = db.prepare('SELECT * FROM claim_line_items WHERE claimId = ?').all(claimId);
    console.log('   Found', lineItems.length, 'line items');

    // Get status history
    const statusHistory = db.prepare(
      'SELECT * FROM claim_status_history WHERE claimId = ? ORDER BY statusDate DESC'
    ).all(claimId);
    console.log('   Found', statusHistory.length, 'status history records');

    console.log('✅ Returning claim data to frontend');

    res.json({
      success: true,
      claim: {
        ...claim,
        lineItems: lineItems,
        statusHistory: statusHistory
      }
    });

  } catch (error) {
    console.error('❌ Error fetching claim:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all claims for a location
app.get('/api/claims', async (req, res) => {
  try {
    const locationId = req.headers['x-location-id'];

    if (!locationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Location ID required' 
      });
    }

    const claims = db.prepare(`
      SELECT * FROM claims 
      WHERE ghlLocationId = ? 
      ORDER BY createdAt DESC
    `).all(locationId);

    res.json({
      success: true,
      claims: claims
    });

  } catch (error) {
    console.error('❌ Error fetching claims:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// Update claim
app.put('/api/claims/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;
    const updates = req.body;

    console.log('📝 Updating claim:', claimId);

    // Update claim in database
    const updateFields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'lineItems' && key !== 'statusHistory') {
        updateFields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });
    
    values.push(claimId);

    const sql = `UPDATE claims SET ${updateFields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    console.log('✅ Claim updated successfully');

    res.json({
      success: true,
      message: 'Claim updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating claim:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-location-id']
}));

app.use(express.json());

// ✅ ADD THIS: Allow iframe embedding
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  next();
});

