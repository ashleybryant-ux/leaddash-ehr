const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
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
// PATIENTS ENDPOINTS
// ============================================

// Get all patients
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

// Get single patient
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

// Create patient
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

// Update patient
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

// Delete patient
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

// Get patient notes
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
// APPOINTMENTS/CALENDAR ENDPOINTS
// ============================================

// Get appointments
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

// Get single appointment
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

// Create appointment
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

// Update appointment
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

// Delete appointment
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
// STAFF/USERS ENDPOINTS (Real GHL Users API)
// ============================================

// Get all staff members (users from location)
app.get('/api/staff', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`👥 Fetching staff (users) for location: ${location.name}`);
    
    try {
      // Try the users endpoint
      const result = await callGHL(
        '/users/',
        'GET',
        null,
        { 
          locationId,
          limit: 100
        },
        location.apiKey
      );

      console.log(`✅ Found ${result.users?.length || 0} staff members`);
      
      res.json({
        success: true,
        staff: result.users || [],
        total: result.users?.length || 0
      });
    } catch (apiError) {
      console.log('⚠️ Users API not accessible, trying location endpoint...');
      
      // Fallback: Try to get location info which may include users
      try {
        const locationResult = await callGHL(
          `/locations/${locationId}`,
          'GET',
          null,
          {},
          location.apiKey
        );

        const users = locationResult.location?.users || [];
        console.log(`✅ Found ${users.length} staff members from location endpoint`);
        
        res.json({
          success: true,
          staff: users,
          total: users.length
        });
      } catch (fallbackError) {
        console.error('❌ Both users endpoints failed');
        res.json({
          success: true,
          staff: [],
          total: 0,
          message: 'Users API requires specific permissions. Please check your API key has access to users endpoint.'
        });
      }
    }
  } catch (error) {
    console.error('❌ Error fetching staff:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      staff: []
    });
  }
});

// Get single user
app.get('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`👤 Fetching user: ${id}`);
    
    const result = await callGHL(
      `/users/${id}`,
      'GET',
      null,
      { locationId },
      location.apiKey
    );

    res.json({
      success: true,
      staff: result.user
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete staff member
app.delete('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`🗑️ Deleting staff member: ${id}`);
    
    await callGHL(
      `/users/${id}`,
      'DELETE',
      null,
      { locationId },
      location.apiKey
    );

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
// TASKS ENDPOINTS
// ============================================

// Get tasks
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

// Create task
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

// Delete task
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
// INVOICES ENDPOINTS
// ============================================

// Get invoices (placeholder)
app.get('/api/invoices', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`💰 Fetching invoices for location: ${location.name}`);
    
    res.json({
      success: true,
      invoices: [],
      message: 'Invoice endpoint is a placeholder - implement based on your GHL setup'
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
  });
  
  console.log('✅ Ready for requests!');
  console.log('✅ Fetching USERS (not contacts) for staff');
  console.log('========================================\n');
});