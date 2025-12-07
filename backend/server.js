const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors({
  origin: ['http://localhost:4173', 'http://localhost:5173', 'http://localhost:3000', 'https://ehr.leaddash.io'],
  credentials: true
}));
app.use(express.json());

// Load location configurations
const locationsPath = path.join(__dirname, 'location-keys.json');
let LOCATIONS = {};

try {
  const data = fs.readFileSync(locationsPath, 'utf8');
  LOCATIONS = JSON.parse(data);
  console.log(`✅ Loaded ${Object.keys(LOCATIONS).length} location(s)`);
} catch (error) {
  console.error('❌ Error loading location-keys.json:', error.message);
  process.exit(1);
}

// Helper function to get location config
const getLocationConfig = (locationId) => {
  const location = LOCATIONS[locationId];
  if (!location) {
    throw new Error(`Location ${locationId} not found in configuration`);
  }
  return location;
};

// Helper function to make GHL API calls
const callGHL = async (endpoint, method = 'GET', data = null, params = {}, apiKey) => {
  try {
    const url = `https://services.leadconnectorhq.com${endpoint}`;
    
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      params
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('GHL API Error:', error.response.data);
      throw new Error(`GHL API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    locations: Object.keys(LOCATIONS).length
  });
});

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

    // Search through all locations to find the user
    let foundUser = null;
    let foundLocationId = null;

    for (const [locationId, locationData] of Object.entries(LOCATIONS)) {
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
        locationId: foundLocationId
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

// Check user role
app.post('/api/auth/check-role', async (req, res) => {
  try {
    const { userId, locationId } = req.body;
    
    if (!userId || !locationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId or locationId'
      });
    }

    const location = getLocationConfig(locationId);
    
    console.log(`🔐 Checking role for user: ${userId} at location: ${location.name}`);
    
    const result = await callGHL(
      '/users/',
      'GET',
      null,
      { locationId },
      location.apiKey
    );

    console.log(`📋 Found ${result.users?.length || 0} users in location`);

    const user = result.users?.find(u => u.id === userId);

    if (!user) {
      console.error(`❌ User ${userId} not found in location`);
      return res.status(404).json({
        success: false,
        error: 'User not found in this location'
      });
    }
    
    const isAdmin = user.role === 'agency owner' || 
                    user.role === 'agency admin' ||
                    user.type === 'agency';
    
    console.log(`✅ User role check: ${user.firstName} ${user.lastName}`);
    console.log(`   Role: "${user.role}"`);
    console.log(`   Type: "${user.type}"`);
    console.log(`   Is Admin: ${isAdmin ? '✅ YES (Agency Owner/Admin)' : '❌ NO (Account User)'}`);
    
    await logUserAccess(userId, locationId, user, isAdmin);
    
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

// ============================================
// USER ACCESS LOGGING
// ============================================

async function logUserAccess(userId, locationId, user, isAdmin) {
  try {
    const accessLogsPath = path.join(__dirname, 'user-access-logs.json');
    
    let accessLogs = {};
    if (fs.existsSync(accessLogsPath)) {
      accessLogs = JSON.parse(fs.readFileSync(accessLogsPath, 'utf8'));
    }

    if (!accessLogs[locationId]) {
      accessLogs[locationId] = {
        locationName: LOCATIONS[locationId]?.name || locationId,
        users: {}
      };
    }

    if (!accessLogs[locationId].users[userId]) {
      accessLogs[locationId].users[userId] = {
        userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin,
        firstAccess: new Date().toISOString(),
        lastAccess: new Date().toISOString(),
        accessCount: 0,
        monthlyAccess: {}
      };
    }

    const userLog = accessLogs[locationId].users[userId];
    userLog.lastAccess = new Date().toISOString();
    userLog.accessCount += 1;
    userLog.isAdmin = isAdmin;

    const currentMonth = new Date().toISOString().substring(0, 7);
    if (!userLog.monthlyAccess[currentMonth]) {
      userLog.monthlyAccess[currentMonth] = 0;
    }
    userLog.monthlyAccess[currentMonth] += 1;

    fs.writeFileSync(accessLogsPath, JSON.stringify(accessLogs, null, 2));

    console.log(`📊 Logged access: ${user.firstName} ${user.lastName} (${isAdmin ? 'Admin' : 'User'})`);

  } catch (error) {
    console.error('❌ Error logging user access:', error.message);
  }
}

// ============================================
// PATIENTS ENDPOINTS
// ============================================

app.get('/api/patients', async (req, res) => {
  try {
    const { locationId, limit = 100 } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`📋 Fetching patients for location: ${location.name}`);
    
    const result = await callGHL(
      '/contacts/',
      'GET',
      null,
      { locationId, limit },
      location.apiKey
    );

    console.log(`✅ Found ${result.contacts?.length || 0} patients`);
    
    res.json({
      success: true,
      patients: result.contacts || [],
      total: result.total || 0
    });
  } catch (error) {
    console.error('❌ Error fetching patients:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`👤 Fetching patient: ${id}`);
    
    const result = await callGHL(
      `/contacts/${id}`,
      'GET',
      null,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      patient: result.contact
    });
  } catch (error) {
    console.error('❌ Error fetching patient:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`➕ Creating patient:`, req.body.firstName, req.body.lastName);
    
    const result = await callGHL(
      '/contacts/',
      'POST',
      { ...req.body, locationId },
      {},
      location.apiKey
    );

    res.json({
      success: true,
      patient: result.contact
    });
  } catch (error) {
    console.error('❌ Error creating patient:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`✏️ Updating patient: ${id}`);
    
    const result = await callGHL(
      `/contacts/${id}`,
      'PUT',
      req.body,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      patient: result.contact
    });
  } catch (error) {
    console.error('❌ Error updating patient:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`🗑️ Deleting patient: ${id}`);
    
    await callGHL(
      `/contacts/${id}`,
      'DELETE',
      null,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting patient:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/patients/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`📝 Fetching notes for patient: ${id}`);
    
    const result = await callGHL(
      `/contacts/${id}/notes`,
      'GET',
      null,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      notes: result.notes || []
    });
  } catch (error) {
    console.error('❌ Error fetching notes:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// APPOINTMENTS
// ============================================

app.get('/api/appointments', async (req, res) => {
  try {
    const { locationId, calendarId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`📅 Fetching appointments for location: ${location.name}`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);
    
    const params = {
      locationId,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString()
    };
    
    if (calendarId) {
      params.calendarId = calendarId;
    } else if (location.calendarId) {
      params.calendarId = location.calendarId;
    }
    
    console.log('📅 Appointment params:', params);
    
    const result = await callGHL(
      '/calendars/events',
      'GET',
      null,
      params,
      location.apiKey
    );

    console.log(`✅ Found ${result.events?.length || 0} appointments`);
    
    res.json({
      success: true,
      appointments: result.events || [],
      total: result.total || 0
    });
  } catch (error) {
    console.error('❌ Error fetching appointments:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      appointments: []
    });
  }
});

app.get('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`📅 Fetching appointment: ${id}`);
    
    const result = await callGHL(
      `/calendars/events/${id}`,
      'GET',
      null,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      appointment: result.event
    });
  } catch (error) {
    console.error('❌ Error fetching appointment:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`➕ Creating appointment`);
    
    const result = await callGHL(
      '/calendars/events',
      'POST',
      req.body,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      appointment: result.event
    });
  } catch (error) {
    console.error('❌ Error creating appointment:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`✏️ Updating appointment: ${id}`);
    
    const result = await callGHL(
      `/calendars/events/${id}`,
      'PUT',
      req.body,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      appointment: result.event
    });
  } catch (error) {
    console.error('❌ Error updating appointment:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`🗑️ Deleting appointment: ${id}`);
    
    await callGHL(
      `/calendars/events/${id}`,
      'DELETE',
      null,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting appointment:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// STAFF
// ============================================

app.get('/api/staff', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`👥 Fetching staff for location: ${location.name}`);
    
    const users = location.users || [];
    
    console.log(`✅ Found ${users.length} staff members from config`);
    
    res.json({
      success: true,
      staff: users,
      total: users.length
    });
  } catch (error) {
    console.error('❌ Error fetching staff:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      staff: []
    });
  }
});

app.get('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`👤 Fetching staff member: ${id}`);
    
    const user = (location.users || []).find(u => u.id === id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }
    
    res.json({
      success: true,
      staff: user
    });
  } catch (error) {
    console.error('❌ Error fetching staff member:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`➕ Adding staff member:`, req.body.firstName, req.body.lastName);
    
    const newUser = {
      id: `USER_${Date.now()}`,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone || '',
      role: req.body.role || 'Staff Member',
      type: req.body.type || 'ACCOUNT-USER'
    };
    
    if (!LOCATIONS[locationId].users) {
      LOCATIONS[locationId].users = [];
    }
    LOCATIONS[locationId].users.push(newUser);
    
    fs.writeFileSync(locationsPath, JSON.stringify(LOCATIONS, null, 2));
    
    console.log(`✅ Staff member added: ${newUser.id}`);
    
    res.json({
      success: true,
      staff: newUser
    });
  } catch (error) {
    console.error('❌ Error adding staff member:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`✏️ Updating staff member: ${id}`);
    
    const userIndex = (location.users || []).findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }
    
    LOCATIONS[locationId].users[userIndex] = {
      ...LOCATIONS[locationId].users[userIndex],
      ...req.body,
      id
    };
    
    fs.writeFileSync(locationsPath, JSON.stringify(LOCATIONS, null, 2));
    
    console.log(`✅ Staff member updated: ${id}`);
    
    res.json({
      success: true,
      staff: LOCATIONS[locationId].users[userIndex]
    });
  } catch (error) {
    console.error('❌ Error updating staff member:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`��️ Deleting staff member: ${id}`);
    
    const userIndex = (location.users || []).findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }
    
    LOCATIONS[locationId].users.splice(userIndex, 1);
    
    fs.writeFileSync(locationsPath, JSON.stringify(LOCATIONS, null, 2));
    
    console.log(`✅ Staff member deleted: ${id}`);
    
    res.json({
      success: true,
      message: 'Staff member deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting staff:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// TASKS
// ============================================

app.get('/api/tasks', async (req, res) => {
  try {
    const { locationId, limit = 100 } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`📋 Fetching tasks for location: ${location.name}`);
    
    const result = await callGHL(
      '/contacts/tasks',
      'GET',
      null,
      { locationId, limit },
      location.apiKey
    );

    console.log(`✅ Found ${result.tasks?.length || 0} tasks`);
    
    res.json({
      success: true,
      tasks: result.tasks || []
    });
  } catch (error) {
    console.error('❌ Error fetching tasks:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      tasks: []
    });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`➕ Creating task`);
    
    const result = await callGHL(
      '/contacts/tasks',
      'POST',
      req.body,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      task: result.task
    });
  } catch (error) {
    console.error('❌ Error creating task:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`🗑️ Deleting task: ${id}`);
    
    await callGHL(
      `/contacts/tasks/${id}`,
      'DELETE',
      null,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting task:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// INVOICES
// ============================================

app.get('/api/invoices/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const locationId = req.headers['x-location-id'];
    const location = getLocationConfig(locationId);
    
    console.log(`💰 Fetching invoices for contact: ${contactId}`);
    
    const result = await callGHL(
      `/invoices/`,
      'GET',
      null,
      { 
        altId: contactId,
        altType: 'contact',
        limit: 100
      },
      location.apiKey
    );

    console.log(`✅ Found ${result.invoices?.length || 0} invoices`);
    
    res.json({
      success: true,
      invoices: result.invoices || []
    });
  } catch (error) {
    console.error('❌ Error fetching invoices:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      invoices: []
    });
  }
});

app.get('/api/invoices/detail/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const locationId = req.headers['x-location-id'];
    const location = getLocationConfig(locationId);
    
    console.log(`💰 Fetching invoice: ${invoiceId}`);
    
    const result = await callGHL(
      `/invoices/${invoiceId}`,
      'GET',
      null,
      {},
      location.apiKey
    );

    res.json({
      success: true,
      invoice: result.invoice
    });
  } catch (error) {
    console.error('❌ Error fetching invoice:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/api/ghl/invoices/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const locationId = req.headers['x-location-id'];
    const location = getLocationConfig(locationId);
    
    console.log(`📝 Updating invoice in GHL: ${invoiceId}`);
    console.log('Update data:', req.body);
    
    const result = await callGHL(
      `/invoices/${invoiceId}`,
      'PUT',
      req.body,
      {},
      location.apiKey
    );

    console.log('✅ Invoice updated successfully in GHL');

    res.json({ 
      success: true, 
      invoice: result.invoice || result 
    });

  } catch (error) {
    console.error('❌ Error updating GHL invoice:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/invoices/:invoiceId/service-date', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { appointmentId, serviceDate } = req.body;
    const locationId = req.headers['x-location-id'];

    console.log(`📅 Saving service date for invoice: ${invoiceId}`);

    const serviceDatesPath = path.join(__dirname, 'invoice-service-dates.json');
    
    let serviceDates = {};
    if (fs.existsSync(serviceDatesPath)) {
      serviceDates = JSON.parse(fs.readFileSync(serviceDatesPath, 'utf8'));
    }

    serviceDates[invoiceId] = {
      invoiceId,
      appointmentId,
      serviceDate,
      locationId,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(serviceDatesPath, JSON.stringify(serviceDates, null, 2));

    console.log('✅ Service date saved');

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Error saving service date:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/invoices/:invoiceId/service-date', async (req, res) => {
  try {
    const { invoiceId } = req.params;

    console.log(`📅 Getting service date for invoice: ${invoiceId}`);

    const serviceDatesPath = path.join(__dirname, 'invoice-service-dates.json');
    
    if (!fs.existsSync(serviceDatesPath)) {
      return res.json({ success: true, serviceDate: null });
    }

    const serviceDates = JSON.parse(fs.readFileSync(serviceDatesPath, 'utf8'));
    const serviceDate = serviceDates[invoiceId] || null;

    res.json({ 
      success: true, 
      serviceDate 
    });

  } catch (error) {
    console.error('❌ Error getting service date:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// BILLING ENDPOINTS
// ============================================

app.get('/api/billing/active-users', async (req, res) => {
  try {
    const { locationId, month } = req.query;
    
    if (!locationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing locationId'
      });
    }

    const accessLogsPath = path.join(__dirname, 'user-access-logs.json');
    
    if (!fs.existsSync(accessLogsPath)) {
      return res.json({
        success: true,
        locationId,
        activeUsers: 0,
        users: []
      });
    }

    const accessLogs = JSON.parse(fs.readFileSync(accessLogsPath, 'utf8'));
    const locationLogs = accessLogs[locationId];

    if (!locationLogs) {
      return res.json({
        success: true,
        locationId,
        activeUsers: 0,
        users: []
      });
    }

    const targetMonth = month || new Date().toISOString().substring(0, 7);

    const activeUsers = Object.values(locationLogs.users).filter(user => 
      user.monthlyAccess && user.monthlyAccess[targetMonth] > 0
    );

    console.log(`💰 Billing query for ${locationId}: ${activeUsers.length} active users in ${targetMonth}`);

    res.json({
      success: true,
      locationId,
      locationName: locationLogs.locationName,
      month: targetMonth,
      activeUsers: activeUsers.length,
      users: activeUsers.map(user => ({
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin,
        accessCount: user.monthlyAccess[targetMonth]
      }))
    });

  } catch (error) {
    console.error('❌ Error getting active users:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/billing/all-locations', async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().substring(0, 7);

    const accessLogsPath = path.join(__dirname, 'user-access-logs.json');
    
    if (!fs.existsSync(accessLogsPath)) {
      return res.json({
        success: true,
        month: targetMonth,
        locations: []
      });
    }

    const accessLogs = JSON.parse(fs.readFileSync(accessLogsPath, 'utf8'));

    const locationSummaries = Object.entries(accessLogs).map(([locationId, data]) => {
      const activeUsers = Object.values(data.users).filter(user => 
        user.monthlyAccess && user.monthlyAccess[targetMonth] > 0
      );

      return {
        locationId,
        locationName: data.locationName,
        activeUsers: activeUsers.length,
        basePrice: 297,
        perUserPrice: 40,
        additionalUsers: Math.max(0, activeUsers.length - 1),
        totalCharge: 297 + (Math.max(0, activeUsers.length - 1) * 40)
      };
    });

    const totalRevenue = locationSummaries.reduce((sum, loc) => sum + loc.totalCharge, 0);

    console.log(`💰 Billing summary for ${targetMonth}: $${totalRevenue} from ${locationSummaries.length} locations`);

    res.json({
      success: true,
      month: targetMonth,
      totalLocations: locationSummaries.length,
      totalRevenue,
      locations: locationSummaries
    });

  } catch (error) {
    console.error('❌ Error getting billing summary:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🏥 LEADDASH EMR - MULTI-LOCATION BACKEND');
  console.log('========================================');
  console.log(`✅ Server: http://localhost:${PORT}`);
  console.log(`✅ Health: http://localhost:${PORT}/health`);
  console.log(`✅ Locations configured: ${Object.keys(LOCATIONS).length}`);
  
  Object.entries(LOCATIONS).forEach(([id, location]) => {
    console.log(`   📍 ${location.name} (${id})`);
    console.log(`      👥 ${location.users?.length || 0} staff members`);
  });
  
  console.log('✅ Ready for requests!');
  console.log('========================================\n');
});
