const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

// ============================================
// ENVIRONMENT VALIDATION
// ============================================
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// JWT Secret - REQUIRED in production
const JWT_SECRET = process.env.JWT_SECRET;
if (isProduction && !JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is required in production');
  console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-production-' + crypto.randomBytes(32).toString('hex');

// SSO Secret for HMAC signature verification - REQUIRED in production
const SSO_SECRET = process.env.SSO_SECRET;
if (isProduction && !SSO_SECRET) {
  console.error('❌ FATAL: SSO_SECRET environment variable is required in production');
  console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Stedi API Key - from environment
const STEDI_API_KEY = process.env.STEDI_API_KEY || '';

const JWT_EXPIRES_IN = '8h';

// Log configuration on startup
console.log(`\n🔐 Security Configuration:`);
console.log(`   Environment: ${NODE_ENV}`);
console.log(`   JWT_SECRET: ${JWT_SECRET ? '✅ Set from environment' : '⚠️ Using dev fallback'}`);
console.log(`   SSO_SECRET: ${SSO_SECRET ? '✅ Set from environment' : '⚠️ SSO signature verification disabled'}`);
console.log(`   STEDI_API_KEY: ${STEDI_API_KEY ? '✅ Set from environment' : '⚠️ Not configured'}`);

// ============================================
// RATE LIMITING (Simple in-memory)
// ============================================
const rateLimitStore = new Map();

const rateLimit = (options = {}) => {
  const { windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests' } = options;
  
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const record = rateLimitStore.get(key);
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }
    
    record.count++;
    
    if (record.count > max) {
      console.log(`🚫 Rate limit exceeded for ${key}`);
      return res.status(429).json({ success: false, error: message });
    }
    
    next();
  };
};

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// ALLOWED DOMAINS & LOCATIONS
// ============================================

// Allowed domains for iframe embedding (ONLY your white-label GHL domain)
const ALLOWED_GHL_DOMAINS = [
  'app.leaddash.io',
  'leaddash.io'
];

// Allowed locations (clients who can access the app)
const allowedLocationsPath = path.join(__dirname, 'allowed-locations.json');

const loadAllowedLocations = () => {
  try {
    if (fs.existsSync(allowedLocationsPath)) {
      return JSON.parse(fs.readFileSync(allowedLocationsPath, 'utf8'));
    }
    return {
      'puLPmzfdCvfQRANPM2WA': {
        locationId: 'puLPmzfdCvfQRANPM2WA',
        locationName: 'Legacy Family Services, Inc',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('❌ Error loading allowed locations:', error);
    return {};
  }
};

const saveAllowedLocations = (locations) => {
  try {
    fs.writeFileSync(allowedLocationsPath, JSON.stringify(locations, null, 2));
  } catch (error) {
    console.error('❌ Error saving allowed locations:', error);
  }
};

let ALLOWED_LOCATIONS = loadAllowedLocations();

const isLocationAllowed = (locationId) => {
  const location = ALLOWED_LOCATIONS[locationId];
  return location && location.status === 'active';
};

const addAllowedLocation = (locationId, locationName) => {
  ALLOWED_LOCATIONS[locationId] = {
    locationId,
    locationName,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  saveAllowedLocations(ALLOWED_LOCATIONS);
  return true;
};

// ============================================
// JWT HELPERS
// ============================================

const createSessionToken = (userData) => {
  return jwt.sign(
    {
      userId: userData.userId,
      userEmail: userData.userEmail,
      userName: userData.userName,
      userType: userData.userType,
      locationId: userData.locationId,
      isAdmin: userData.isAdmin || false,
      iat: Math.floor(Date.now() / 1000)
    },
    EFFECTIVE_JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const verifySessionToken = (token) => {
  try {
    return jwt.verify(token, EFFECTIVE_JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// ============================================
// SSO SIGNATURE HELPERS
// ============================================

const generateSsoSignature = (params) => {
  if (!SSO_SECRET) return null;
  
  const sortedKeys = Object.keys(params).sort();
  const signatureString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  
  return crypto
    .createHmac('sha256', SSO_SECRET)
    .update(signatureString)
    .digest('hex');
};

const verifySsoSignature = (params, providedSignature) => {
  if (!SSO_SECRET) {
    console.log('⚠️ SSO_SECRET not configured - skipping signature verification');
    return true; // Allow in dev mode without signature
  }
  
  const expectedSignature = generateSsoSignature(params);
  
  if (!expectedSignature || !providedSignature) {
    return false;
  }
  
  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch (e) {
    return false;
  }
};

// ============================================
// ADMIN TYPE HELPERS
// ============================================

const ADMIN_TYPES = ['account-admin', 'agency-admin', 'agency-owner'];

const checkIsAdmin = (userType) => {
  if (!userType) return false;
  const normalizedType = userType.toLowerCase();
  return ADMIN_TYPES.some(adminType => 
    normalizedType === adminType || normalizedType.includes(adminType)
  );
};

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

// Get user info from request (token or headers)
const getUserFromRequest = (req) => {
  // Try JWT token first
  const token = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const session = verifySessionToken(token);
    if (session) {
      return {
        userId: session.userId,
        userName: session.userName,
        userEmail: session.userEmail,
        userType: session.userType,
        locationId: session.locationId,
        isAdmin: session.isAdmin || checkIsAdmin(session.userType),
        authenticated: true
      };
    }
  }
  
  // Fallback to headers (for backward compatibility during transition)
  return {
    userId: req.headers['x-user-id'] || req.query.userId || req.body?.userId || null,
    userName: req.headers['x-user-name'] || req.body?.userName || 'Unknown User',
    userEmail: req.headers['x-user-email'] || req.body?.userEmail || '',
    userType: req.headers['x-user-type'] || req.body?.userType || '',
    locationId: req.headers['x-location-id'] || req.query.locationId || req.body?.locationId || '',
    isAdmin: false,
    authenticated: false
  };
};

// Require authentication middleware
const requireAuth = (req, res, next) => {
  const user = getUserFromRequest(req);
  
  if (!user.authenticated) {
    // Check for legacy header-based auth during transition
    if (user.userId && user.locationId) {
      // Allow legacy auth but log warning
      console.log(`⚠️ Legacy header auth used by ${user.userId}`);
      req.user = user;
      return next();
    }
    
    console.log('🚫 Authentication required - no valid session');
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Verify location is still allowed
  if (!isLocationAllowed(user.locationId)) {
    console.log(`🚫 Location ${user.locationId} is not allowed`);
    return res.status(403).json({ 
      success: false, 
      error: 'Location access denied',
      code: 'LOCATION_DENIED'
    });
  }
  
  req.user = user;
  next();
};

// Require admin middleware (must be used after requireAuth)
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  if (!req.user.isAdmin) {
    console.log(`🚫 Admin access denied for user ${req.user.userId}`);
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  
  next();
};

// Validate location matches user's location
const validateLocation = (req, res, next) => {
  const requestedLocationId = req.query.locationId || req.body?.locationId || req.headers['x-location-id'];
  
  if (req.user && requestedLocationId && req.user.locationId !== requestedLocationId) {
    // Admins might be able to access multiple locations in future
    // For now, enforce strict location matching
    console.log(`🚫 Location mismatch: user ${req.user.locationId}, requested ${requestedLocationId}`);
    return res.status(403).json({ 
      success: false, 
      error: 'Location access denied',
      code: 'LOCATION_MISMATCH'
    });
  }
  
  next();
};

// Helper to get IP address
const getIpAddress = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
};

// ============================================
// MULTER FILE UPLOAD CONFIG
// ============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Only images, PDFs, and documents are allowed'));
  }
});

// ============================================
// MIDDLEWARE
// ============================================

// Cookie parser
app.use(cookieParser());

// Apply general rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:4173', 
    'http://localhost:5173', 
    'http://localhost:3000', 
    'https://ehr.leaddash.io',
    'https://app.leaddash.io',
    'https://main.d5oydskpw296o.amplifyapp.com'
  ],
  credentials: true
}));

app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://app.leaddash.io https://*.leaddash.io"
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'ALLOW-FROM https://app.leaddash.io');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

// ============================================
// LOAD LOCATION CONFIGURATIONS
// ============================================
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

const getLocationConfig = (locationId) => {
  const location = LOCATIONS[locationId];
  if (!location) {
    throw new Error(`Location ${locationId} not found in configuration`);
  }
  return location;
};

// ============================================
// GHL API HELPER
// ============================================
const callGHL = async (endpoint, method = 'GET', data = null, params = {}, apiKey) => {
  try {
    const url = `https://services.leadconnectorhq.com${endpoint}`;
    
    const config = {
      method,
      url,
      headers: {
        'Accept': 'application/json',
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
// DATA STORAGE HELPERS
// ============================================

const loadJsonFile = (filePath, defaultValue = {}) => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return defaultValue;
  } catch (error) {
    console.error(`❌ Error loading ${filePath}:`, error);
    return defaultValue;
  }
};

const saveJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`❌ Error saving ${filePath}:`, error);
    throw error;
  }
};

// File paths
const notesPath = path.join(__dirname, 'clinical-notes.json');
const draftsPath = path.join(__dirname, 'note-drafts.json');
const patientFilesPath = path.join(__dirname, 'patient-files.json');
const adminNotesPath = path.join(__dirname, 'admin-notes.json');
const claimsPath = path.join(__dirname, 'insurance-claims.json');
const paymentsPath = path.join(__dirname, 'patient-payments.json');
const claimDraftsPath = path.join(__dirname, 'claim-drafts.json');
const feeSchedulePath = path.join(__dirname, 'fee-schedules.json');
const customPayersPath = path.join(__dirname, 'custom-payers.json');
const auditLogsPath = path.join(__dirname, 'audit-logs.json');

// Storage loaders
const loadNotes = () => loadJsonFile(notesPath, {});
const saveNotes = (notes) => saveJsonFile(notesPath, notes);
const loadDrafts = () => loadJsonFile(draftsPath, {});
const saveDrafts = (drafts) => saveJsonFile(draftsPath, drafts);
const loadPatientFiles = () => loadJsonFile(patientFilesPath, {});
const savePatientFiles = (files) => saveJsonFile(patientFilesPath, files);
const loadAdminNotes = () => loadJsonFile(adminNotesPath, {});
const saveAdminNotesToFile = (notes) => saveJsonFile(adminNotesPath, notes);
const loadClaims = () => loadJsonFile(claimsPath, {});
const saveClaims = (claims) => saveJsonFile(claimsPath, claims);
const loadPayments = () => loadJsonFile(paymentsPath, {});
const savePayments = (payments) => saveJsonFile(paymentsPath, payments);
const loadClaimDrafts = () => loadJsonFile(claimDraftsPath, {});
const saveClaimDrafts = (drafts) => saveJsonFile(claimDraftsPath, drafts);
const loadFeeSchedules = () => loadJsonFile(feeSchedulePath, { default: { '90832': 95, '90834': 130, '90837': 175, '90847': 150, '90853': 50 } });
const saveFeeSchedules = (schedules) => saveJsonFile(feeSchedulePath, schedules);
const loadCustomPayers = () => loadJsonFile(customPayersPath, {});
const saveCustomPayers = (payers) => saveJsonFile(customPayersPath, payers);
const loadAuditLogs = () => loadJsonFile(auditLogsPath, { logs: [], lastId: 0 });
const saveAuditLogs = (data) => saveJsonFile(auditLogsPath, data);

// In-memory storage for patient diagnoses
const patientDiagnoses = {};

// ============================================
// AUDIT LOGGING
// ============================================

const createAuditLog = (params) => {
  try {
    const {
      action, resourceType, resourceId, patientId = null, patientName = null,
      userId, userName = 'Unknown User', userEmail = '', locationId,
      locationName = '', description, metadata = {}, ipAddress = ''
    } = params;

    const auditData = loadAuditLogs();
    
    const logEntry = {
      id: `AUDIT_${Date.now()}_${++auditData.lastId}`,
      timestamp: new Date().toISOString(),
      action, resourceType, resourceId, patientId, patientName,
      userId, userName, userEmail, locationId,
      locationName: locationName || LOCATIONS[locationId]?.name || '',
      description, metadata, ipAddress
    };

    auditData.logs.unshift(logEntry);

    // Keep only the last 10,000 entries
    if (auditData.logs.length > 10000) {
      auditData.logs = auditData.logs.slice(0, 10000);
    }

    saveAuditLogs(auditData);
    console.log(`📝 AUDIT: ${action} ${resourceType} by ${userName} - ${description}`);

    return logEntry;
  } catch (error) {
    console.error('❌ Error creating audit log:', error);
    return null;
  }
};

// ============================================
// SSO AUTHENTICATION ENDPOINTS
// ============================================

// SSO Entry Point - GHL redirects here with signed parameters
app.get('/auth/sso', (req, res) => {
  const { locationId, userId, userEmail, userName, userType, timestamp, signature } = req.query;
  
  console.log('🔐 SSO Request:', { locationId, userId, userEmail, userName, userType });
  
  // Validate required params
  if (!locationId || !userId) {
    console.log('❌ SSO Failed: Missing required parameters');
    return res.redirect('/access-denied?reason=missing_params');
  }
  
  // Verify signature if SSO_SECRET is configured
  if (SSO_SECRET) {
    // Check timestamp to prevent replay attacks (5 minute window)
    const requestTime = parseInt(timestamp);
    const now = Date.now();
    if (!requestTime || Math.abs(now - requestTime) > 5 * 60 * 1000) {
      console.log('❌ SSO Failed: Invalid or expired timestamp');
      return res.redirect('/access-denied?reason=expired');
    }
    
    // Verify signature
    const paramsToSign = { locationId, userId, userEmail: userEmail || '', userName: userName || '', userType: userType || '', timestamp };
    if (!verifySsoSignature(paramsToSign, signature)) {
      console.log('❌ SSO Failed: Invalid signature');
      return res.redirect('/access-denied?reason=invalid_signature');
    }
  }
  
  // Check if location is allowed
  if (!isLocationAllowed(locationId)) {
    console.log('❌ SSO Failed: Location not allowed:', locationId);
    return res.redirect('/access-denied?reason=not_authorized');
  }
  
  // Determine if user is admin
  const isAdmin = checkIsAdmin(userType);
  
  // Create session token
  const token = createSessionToken({
    userId,
    userEmail: userEmail || '',
    userName: userName || 'User',
    userType: userType || 'user',
    locationId,
    isAdmin
  });
  
  console.log(`✅ SSO Success: Session created for ${userName} (Admin: ${isAdmin})`);
  
  // Log the login
  createAuditLog({
    action: 'LOGIN',
    resourceType: 'auth',
    resourceId: userId,
    userId,
    userName: userName || 'User',
    userEmail: userEmail || '',
    locationId,
    description: `SSO login: ${userName || 'User'}`,
    ipAddress: getIpAddress(req)
  });
  
  // Set cookie and redirect to app
  res.cookie('session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'none',
    maxAge: 8 * 60 * 60 * 1000
  });
  
  res.redirect('/dashboard');
});

// Development-only login endpoint (returns 404 in production)
app.post('/api/auth/dev-login', (req, res) => {
  if (isProduction) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  const { email, locationId, userType } = req.body;
  
  if (!email || !locationId) {
    return res.status(400).json({ success: false, error: 'Email and locationId required' });
  }
  
  const location = LOCATIONS[locationId];
  if (!location) {
    return res.status(404).json({ success: false, error: 'Location not found' });
  }
  
  // Find user in location config
  const user = (location.users || []).find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found in location' });
  }
  
  const isAdmin = checkIsAdmin(user.type || userType);
  
  const token = createSessionToken({
    userId: user.id,
    userEmail: user.email,
    userName: `${user.firstName} ${user.lastName}`,
    userType: user.type || userType || 'ACCOUNT-USER',
    locationId,
    isAdmin
  });
  
  console.log(`🔧 DEV Login: ${user.firstName} ${user.lastName} (Admin: ${isAdmin})`);
  
  res.cookie('session', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });
  
  res.json({
    success: true,
    user: {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      userType: user.type,
      locationId,
      isAdmin
    },
    token
  });
});

// Get current session
app.get('/api/auth/me', (req, res) => {
  const user = getUserFromRequest(req);
  
  if (!user.authenticated) {
    return res.status(401).json({ authenticated: false });
  }
  
  if (!isLocationAllowed(user.locationId)) {
    return res.status(403).json({ authenticated: false, reason: 'location_suspended' });
  }
  
  res.json({
    authenticated: true,
    user: {
      userId: user.userId,
      userEmail: user.userEmail,
      userName: user.userName,
      userType: user.userType,
      locationId: user.locationId,
      isAdmin: user.isAdmin
    }
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const user = getUserFromRequest(req);
  
  if (user.authenticated) {
    createAuditLog({
      action: 'LOGOUT',
      resourceType: 'auth',
      resourceId: user.userId,
      userId: user.userId,
      userName: user.userName,
      locationId: user.locationId,
      description: `User logged out: ${user.userName}`,
      ipAddress: getIpAddress(req)
    });
  }
  
  res.clearCookie('session');
  res.json({ success: true });
});

// Check user role (legacy endpoint - also updates req.user)
app.post('/api/auth/check-role', async (req, res) => {
  try {
    const { userId, locationId } = req.body;
    
    if (!userId || !locationId) {
      return res.status(400).json({ success: false, error: 'Missing userId or locationId' });
    }

    const location = getLocationConfig(locationId);
    
    console.log(`🔐 Checking role for user: ${userId} at location: ${location.name}`);
    
    // Check local config first
    const localUser = (location.users || []).find(u => u.id === userId);
    
    if (localUser) {
      const isAdmin = checkIsAdmin(localUser.type);
      
      console.log(`✅ User found: ${localUser.firstName} ${localUser.lastName}`);
      console.log(`   Type: "${localUser.type}", Is Admin: ${isAdmin ? '✅ YES' : '❌ NO'}`);
      
      await logUserAccess(userId, locationId, localUser, isAdmin);
      
      return res.json({
        success: true,
        isAdmin,
        userName: `${localUser.firstName || ''} ${localUser.lastName || ''}`.trim() || localUser.email,
        firstName: localUser.firstName,
        lastName: localUser.lastName,
        email: localUser.email,
        role: localUser.role,
        type: localUser.type,
        userId,
        locationId
      });
    }
    
    // Fallback to GHL API
    const result = await callGHL('/users/', 'GET', null, { locationId }, location.apiKey);
    const user = result.users?.find(u => u.id === userId);

    if (!user) {
      console.error(`❌ User ${userId} not found`);
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const isAdmin = checkIsAdmin(user.type);
    
    console.log(`✅ User from GHL: ${user.firstName} ${user.lastName}, Admin: ${isAdmin}`);
    
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
    res.status(500).json({ success: false, error: 'Failed to verify user role', details: error.message });
  }
});

// ============================================
// USER ACCESS LOGGING
// ============================================

async function logUserAccess(userId, locationId, user, isAdmin) {
  try {
    const accessLogsPath = path.join(__dirname, 'user-access-logs.json');
    let accessLogs = loadJsonFile(accessLogsPath, {});

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

    saveJsonFile(accessLogsPath, accessLogs);

  } catch (error) {
    console.error('❌ Error logging user access:', error.message);
  }
}

// ============================================
// LEGACY LOGIN ENDPOINT (for backward compatibility)
// ============================================

// Apply stricter rate limiting to login
const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts' });

app.post('/api/auth/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    console.log('🔐 Login attempt for:', email);

    // Search through all locations to find the user
    let foundUser = null;
    let foundLocationId = null;

    for (const [locationId, locationData] of Object.entries(LOCATIONS)) {
      if (locationData.users) {
        const user = locationData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user) {
          foundUser = user;
          foundLocationId = locationId;
          break;
        }
      }
    }

    if (!foundUser) {
      console.log('❌ User not found');
      
      createAuditLog({
        action: 'LOGIN_FAILED',
        resourceType: 'auth',
        resourceId: email,
        userId: 'unknown',
        userName: email,
        locationId: 'unknown',
        description: `Failed login attempt: ${email}`,
        ipAddress: getIpAddress(req)
      });
      
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // TODO: Add proper password verification
    // For now, we're transitioning to SSO-only authentication
    // This endpoint should verify password hash when passwords are implemented
    
    const isAdmin = checkIsAdmin(foundUser.type);
    
    console.log('✅ Login successful for:', foundUser.firstName, foundUser.lastName);

    // Create session token
    const token = createSessionToken({
      userId: foundUser.id,
      userEmail: foundUser.email,
      userName: `${foundUser.firstName} ${foundUser.lastName}`,
      userType: foundUser.type,
      locationId: foundLocationId,
      isAdmin
    });
    
    createAuditLog({
      action: 'LOGIN',
      resourceType: 'auth',
      resourceId: foundUser.id,
      userId: foundUser.id,
      userName: `${foundUser.firstName} ${foundUser.lastName}`,
      userEmail: foundUser.email,
      locationId: foundLocationId,
      description: `User logged in: ${foundUser.firstName} ${foundUser.lastName}`,
      ipAddress: getIpAddress(req)
    });
    
    res.cookie('session', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: {
        id: foundUser.id,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
        email: foundUser.email,
        role: foundUser.role,
        type: foundUser.type,
        locationId: foundLocationId,
        isAdmin
      },
      token,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ============================================
// ADMIN LOCATION MANAGEMENT
// ============================================

app.get('/api/admin/locations', requireAuth, requireAdmin, (req, res) => {
  res.json({ locations: Object.values(ALLOWED_LOCATIONS) });
});

app.post('/api/admin/locations', requireAuth, requireAdmin, (req, res) => {
  const { locationId, locationName } = req.body;
  
  if (!locationId) {
    return res.status(400).json({ error: 'locationId required' });
  }
  
  addAllowedLocation(locationId, locationName || 'Unknown');
  
  createAuditLog({
    action: 'CREATE',
    resourceType: 'location',
    resourceId: locationId,
    userId: req.user.userId,
    userName: req.user.userName,
    locationId: req.user.locationId,
    description: `Added location: ${locationName || locationId}`,
    ipAddress: getIpAddress(req)
  });
  
  res.json({ success: true, message: `Location ${locationId} added` });
});

app.delete('/api/admin/locations/:locationId', requireAuth, requireAdmin, (req, res) => {
  const { locationId } = req.params;
  
  if (ALLOWED_LOCATIONS[locationId]) {
    ALLOWED_LOCATIONS[locationId].status = 'suspended';
    saveAllowedLocations(ALLOWED_LOCATIONS);
    
    createAuditLog({
      action: 'SUSPEND',
      resourceType: 'location',
      resourceId: locationId,
      userId: req.user.userId,
      userName: req.user.userName,
      locationId: req.user.locationId,
      description: `Suspended location: ${locationId}`,
      ipAddress: getIpAddress(req)
    });
  }
  res.json({ success: true, message: `Location ${locationId} suspended` });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    locations: Object.keys(LOCATIONS).length,
    environment: NODE_ENV
  });
});

// ============================================
// ADMIN NOTES ENDPOINTS
// ============================================

app.get('/api/patients/:patientId/admin-notes', async (req, res) => {
  try {
    const { patientId } = req.params;
    const locationId = req.query.locationId || req.headers['x-location-id'];
    
    const patientKey = `${locationId}_${patientId}`;
    const allNotes = loadAdminNotes();
    const note = allNotes[patientKey] || '';
    
    res.json({ success: true, note: note });
  } catch (error) {
    console.error('Error fetching admin note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/patients/:patientId/admin-notes', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { note } = req.body;
    const locationId = req.body.locationId || req.query.locationId || req.headers['x-location-id'];
    
    const patientKey = `${locationId}_${patientId}`;
    const allNotes = loadAdminNotes();
    
    allNotes[patientKey] = note || '';
    saveAdminNotesToFile(allNotes);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving admin note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GHL USERS ENDPOINT
// ============================================

app.get('/api/users', async (req, res) => {
  try {
    const { locationId } = req.query;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Location ID required' });
    }
    
    const location = getLocationConfig(locationId);
    
    // Return users from local config
    if (location.users && location.users.length > 0) {
      return res.json({ success: true, users: location.users });
    }
    
    // Fallback to GHL API
    const result = await callGHL('/users/', 'GET', null, { locationId }, location.apiKey);
    
    res.json({ success: true, users: result.users || [] });
    
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    res.status(500).json({ success: false, error: error.message, users: [] });
  }
});

// ============================================
// PATIENTS ENDPOINTS
// ============================================

app.get('/api/patients', async (req, res) => {
  try {
    const { locationId, userId, limit: requestedLimit = 100 } = req.query;
    const limit = Math.min(Number(requestedLimit) || 100, 100);
    const location = getLocationConfig(locationId);
    
    const user = getUserFromRequest(req);
    
    console.log(`📋 Fetching patients for location: ${location.name}`);
    
    const result = await callGHL('/contacts/', 'GET', null, { locationId, limit }, location.apiKey);

    let patients = result.contacts || [];
    
    // Filter for non-admin users - only show assigned patients
    if (user.authenticated && !user.isAdmin && user.userId) {
      patients = patients.filter(patient => patient.assignedTo === user.userId);
      console.log(`🔍 Filtered to ${patients.length} patients assigned to user ${user.userId}`);
    } else if (userId) {
      // Legacy header-based filtering
      patients = patients.filter(patient => patient.assignedTo === userId);
    }
    
    res.json({ success: true, patients: patients, total: patients.length });
  } catch (error) {
    console.error('❌ Error fetching patients:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/patients/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const locationId = req.query.locationId || req.headers['x-location-id'];

    if (!locationId) {
      return res.status(400).json({ success: false, message: 'Location ID is required' });
    }

    const locationConfig = LOCATIONS[locationId];
    if (!locationConfig) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    const apiKey = locationConfig.apiKey;
    const user = getUserFromRequest(req);

    // Fetch patient from GHL
    const patientResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${patientId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    const patient = patientResponse.data.contact || patientResponse.data;

    // Check access for non-admin users
    if (user.authenticated && !user.isAdmin && user.userId) {
      if (patient.assignedTo && patient.assignedTo !== user.userId) {
        console.log(`🚫 Access denied: Patient ${patientId} not assigned to user ${user.userId}`);
        return res.status(403).json({ success: false, error: 'Access denied to this patient' });
      }
    }

    // Fetch custom field definitions
    let customFieldDefs = [];
    try {
      const defsResponse = await axios.get(
        `https://services.leadconnectorhq.com/locations/${locationId}/customFields`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Version': '2021-07-28',
            'Accept': 'application/json'
          }
        }
      );
      customFieldDefs = defsResponse.data.customFields || [];
    } catch (err) {
      console.log('⚠️ Could not fetch custom field definitions:', err.message);
    }

    // Map ID -> fieldKey
    const idToKeyMap = {};
    customFieldDefs.forEach(def => {
      idToKeyMap[def.id] = def.fieldKey;
    });

    // Resolve custom field values
    if (patient.customFields && Array.isArray(patient.customFields)) {
      patient.customFields = patient.customFields.map(cf => {
        const fieldKey = idToKeyMap[cf.id] || cf.id;
        return { ...cf, key: fieldKey, fieldKey: fieldKey };
      });
    }

    // Log patient view
    if (user.authenticated) {
      createAuditLog({
        action: 'VIEW',
        resourceType: 'patient',
        resourceId: patientId,
        patientId: patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        userId: user.userId,
        userName: user.userName,
        locationId: locationId,
        description: `Viewed patient: ${patient.firstName} ${patient.lastName}`,
        ipAddress: getIpAddress(req)
      });
    }

    res.json({ success: true, patient: patient });

  } catch (error) {
    console.error('❌ Error fetching patient:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`➕ Creating patient:`, req.body.firstName, req.body.lastName);
    
    const result = await callGHL('/contacts/', 'POST', { ...req.body, locationId }, {}, location.apiKey);

    const user = getUserFromRequest(req);
    if (user.authenticated) {
      createAuditLog({
        action: 'CREATE',
        resourceType: 'patient',
        resourceId: result.contact?.id,
        patientId: result.contact?.id,
        patientName: `${req.body.firstName} ${req.body.lastName}`,
        userId: user.userId,
        userName: user.userName,
        locationId: locationId,
        description: `Created patient: ${req.body.firstName} ${req.body.lastName}`,
        ipAddress: getIpAddress(req)
      });
    }

    res.json({ success: true, patient: result.contact });
  } catch (error) {
    console.error('❌ Error creating patient:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`✏️ Updating patient: ${id}`);
    
    const result = await callGHL(`/contacts/${id}`, 'PUT', req.body, {}, location.apiKey);

    res.json({ success: true, patient: result.contact });
  } catch (error) {
    console.error('❌ Error updating patient:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/patients/:patientId/update', async (req, res) => {
  try {
    const { patientId } = req.params;
    const locationId = req.body.locationId || req.headers['x-location-id'];
    
    if (!locationId) {
      return res.status(400).json({ success: false, message: 'Location ID is required' });
    }

    const locationConfig = LOCATIONS[locationId];
    if (!locationConfig) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    const apiKey = locationConfig.apiKey;

    // Build update payload
    const updatePayload = {};

    if (req.body.phone !== undefined) updatePayload.phone = req.body.phone;
    if (req.body.email !== undefined) updatePayload.email = req.body.email;
    if (req.body.address1 !== undefined) updatePayload.address1 = req.body.address1;
    if (req.body.city !== undefined) updatePayload.city = req.body.city;
    if (req.body.state !== undefined) updatePayload.state = req.body.state;
    if (req.body.postalCode !== undefined) updatePayload.postalCode = req.body.postalCode;
    if (req.body.dateOfBirth !== undefined) updatePayload.dateOfBirth = req.body.dateOfBirth;
    if (req.body.firstName !== undefined) updatePayload.firstName = req.body.firstName;
    if (req.body.lastName !== undefined) updatePayload.lastName = req.body.lastName;

    // Custom fields
    if (req.body.customFields && Array.isArray(req.body.customFields) && req.body.customFields.length > 0) {
      let customFieldDefs = [];
      try {
        const defsResponse = await axios.get(
          `https://services.leadconnectorhq.com/locations/${locationId}/customFields`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Version': '2021-07-28',
              'Accept': 'application/json'
            }
          }
        );
        customFieldDefs = defsResponse.data.customFields || [];
      } catch (err) {
        console.log('⚠️ Could not fetch field definitions:', err.message);
      }

      const customFieldsPayload = [];
      for (const cf of req.body.customFields) {
        if (cf.field_value === undefined) continue;

        const normalizedKey = cf.key.replace(/^contact\./, '');
        const fieldDef = customFieldDefs.find(def => {
          const defKey = (def.fieldKey || '').replace(/^contact\./, '');
          return defKey === normalizedKey;
        });

        if (fieldDef) {
          customFieldsPayload.push({ id: fieldDef.id, field_value: cf.field_value });
        }
      }

      if (customFieldsPayload.length > 0) {
        updatePayload.customFields = customFieldsPayload;
      }
    }

    const response = await axios.put(
      `https://services.leadconnectorhq.com/contacts/${patientId}`,
      updatePayload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    res.json({ success: true, message: 'Patient updated successfully', contact: response.data.contact || response.data });

  } catch (error) {
    console.error('❌ Error updating patient:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
});

app.delete('/api/patients/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    console.log(`🗑️ Deleting patient: ${id}`);
    
    await callGHL(`/contacts/${id}`, 'DELETE', null, {}, location.apiKey);

    createAuditLog({
      action: 'DELETE',
      resourceType: 'patient',
      resourceId: id,
      patientId: id,
      userId: req.user.userId,
      userName: req.user.userName,
      locationId: locationId,
      description: `Deleted patient: ${id}`,
      ipAddress: getIpAddress(req)
    });

    res.json({ success: true, message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting patient:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PATIENT DIAGNOSIS ENDPOINTS
// ============================================

app.get('/api/patients/:patientId/diagnosis', (req, res) => {
  try {
    const { patientId } = req.params;
    const { locationId } = req.query;
    
    const patientKey = `${locationId}_${patientId}`;
    const data = patientDiagnoses[patientKey];
    
    res.json({
      success: true,
      diagnosis: data?.diagnosis || '',
      treatmentPlan: data?.treatmentPlan || null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/patients/:patientId/diagnosis', (req, res) => {
  try {
    const { patientId } = req.params;
    const { locationId } = req.query;
    const { diagnosis, treatmentPlan } = req.body;
    
    const patientKey = `${locationId}_${patientId}`;
    
    patientDiagnoses[patientKey] = {
      diagnosis: diagnosis || '',
      treatmentPlan: treatmentPlan || null,
      updatedAt: new Date().toISOString()
    };
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GHL CONTACT NOTES ENDPOINTS
// ============================================

app.get('/api/patients/:patientId/ghl-notes', async (req, res) => {
  try {
    const { patientId } = req.params;
    const locationId = req.headers['x-location-id'] || req.query.locationId;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Location ID required' });
    }
    
    const location = getLocationConfig(locationId);

    const response = await axios.get(
      `https://services.leadconnectorhq.com/contacts/${patientId}/notes`,
      {
        headers: {
          'Authorization': `Bearer ${location.apiKey}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    res.json({ success: true, notes: response.data.notes || [] });
  } catch (error) {
    console.error('❌ Error fetching GHL notes:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch notes', notes: [] });
  }
});

app.post('/api/patients/:patientId/ghl-notes', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { body, userId } = req.body;
    const locationId = req.headers['x-location-id'] || req.query.locationId;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Location ID required' });
    }
    
    const location = getLocationConfig(locationId);

    const response = await axios.post(
      `https://services.leadconnectorhq.com/contacts/${patientId}/notes`,
      { body, userId },
      {
        headers: {
          'Authorization': `Bearer ${location.apiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    res.json({ success: true, note: response.data.note || response.data });
  } catch (error) {
    console.error('❌ Error creating GHL note:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to create note' });
  }
});

app.put('/api/patients/:patientId/ghl-notes/:noteId', async (req, res) => {
  try {
    const { patientId, noteId } = req.params;
    const { body, userId } = req.body;
    const locationId = req.headers['x-location-id'] || req.query.locationId;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Location ID required' });
    }
    
    const location = getLocationConfig(locationId);

    const response = await axios.put(
      `https://services.leadconnectorhq.com/contacts/${patientId}/notes/${noteId}`,
      { body, userId },
      {
        headers: {
          'Authorization': `Bearer ${location.apiKey}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    res.json({ success: true, note: response.data.note || response.data });
  } catch (error) {
    console.error('❌ Error updating GHL note:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
});

app.delete('/api/patients/:patientId/ghl-notes/:noteId', async (req, res) => {
  try {
    const { patientId, noteId } = req.params;
    const locationId = req.headers['x-location-id'] || req.query.locationId;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Location ID required' });
    }
    
    const location = getLocationConfig(locationId);

    await axios.delete(
      `https://services.leadconnectorhq.com/contacts/${patientId}/notes/${noteId}`,
      {
        headers: {
          'Authorization': `Bearer ${location.apiKey}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting GHL note:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
});

// ============================================
// CLINICAL NOTES ENDPOINTS
// ============================================

app.get('/api/patients/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUserFromRequest(req);
    
    const allNotes = loadNotes();
    let patientNotes = allNotes[id] || [];
    
    // Filter notes for non-admin users
    if (user.authenticated && !user.isAdmin && user.userId) {
      patientNotes = patientNotes.filter(note => note.createdBy === user.userId);
    }
    
    patientNotes.sort((a, b) => new Date(b.dateOfService) - new Date(a.dateOfService));
    
    res.json({ success: true, notes: patientNotes });
  } catch (error) {
    console.error('❌ Error fetching notes:', error.message);
    res.status(500).json({ success: false, error: error.message, notes: [] });
  }
});

app.get('/api/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const user = getUserFromRequest(req);
    
    const allNotes = loadNotes();
    
    let foundNote = null;
    for (const patientNotes of Object.values(allNotes)) {
      const note = patientNotes.find(n => n.id === noteId);
      if (note) {
        foundNote = note;
        break;
      }
    }
    
    if (!foundNote) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    // Check access for non-admin users
    if (user.authenticated && !user.isAdmin && user.userId) {
      if (foundNote.createdBy && foundNote.createdBy !== user.userId) {
        return res.status(403).json({ success: false, error: 'Access denied to this note' });
      }
    }
    
    res.json({ success: true, note: foundNote });
  } catch (error) {
    console.error('❌ Error fetching note:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/patients/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const noteData = req.body;
    const user = getUserFromRequest(req);
    
    const allNotes = loadNotes();
    
    if (!allNotes[id]) {
      allNotes[id] = [];
    }
    
    const newNote = {
      id: `NOTE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId: id,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.userId || noteData.createdBy,
      createdByName: user.userName || noteData.createdByName,
      ...noteData
    };
    
    allNotes[id].push(newNote);
    saveNotes(allNotes);
    
    if (user.authenticated) {
      createAuditLog({
        action: noteData.status === 'signed' ? 'SIGN' : 'CREATE',
        resourceType: 'progress_note',
        resourceId: newNote.id,
        patientId: id,
        patientName: noteData.patientName,
        userId: user.userId,
        userName: user.userName,
        locationId: noteData.locationId,
        description: noteData.status === 'signed' 
          ? `Signed progress note for ${noteData.patientName}`
          : `Created progress note for ${noteData.patientName}`,
        metadata: { noteType: noteData.noteType, sessionDate: noteData.sessionDate },
        ipAddress: getIpAddress(req)
      });
    }
    
    res.json({ success: true, note: newNote });
  } catch (error) {
    console.error('❌ Error creating note:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const updateData = req.body;
    const user = getUserFromRequest(req);
    
    const allNotes = loadNotes();
    
    let updated = false;
    let updatedNote = null;
    let patientId = null;
    
    for (const [pId, patientNotes] of Object.entries(allNotes)) {
      const noteIndex = patientNotes.findIndex(n => n.id === noteId);
      if (noteIndex !== -1) {
        const existingNote = allNotes[pId][noteIndex];
        
        // Check access for non-admin users
        if (user.authenticated && !user.isAdmin && user.userId) {
          if (existingNote.createdBy && existingNote.createdBy !== user.userId) {
            return res.status(403).json({ success: false, error: 'Access denied to this note' });
          }
        }
        
        allNotes[pId][noteIndex] = {
          ...existingNote,
          ...updateData,
          updatedAt: new Date().toISOString()
        };
        updatedNote = allNotes[pId][noteIndex];
        patientId = pId;
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    saveNotes(allNotes);
    
    if (user.authenticated) {
      createAuditLog({
        action: updateData.status === 'signed' ? 'SIGN' : 'UPDATE',
        resourceType: 'progress_note',
        resourceId: noteId,
        patientId: patientId,
        patientName: updatedNote.patientName,
        userId: user.userId,
        userName: user.userName,
        locationId: updatedNote.locationId,
        description: updateData.status === 'signed'
          ? `Signed progress note for ${updatedNote.patientName}`
          : `Updated progress note for ${updatedNote.patientName}`,
        ipAddress: getIpAddress(req)
      });
    }
    
    res.json({ success: true, message: 'Note updated successfully' });
  } catch (error) {
    console.error('❌ Error updating note:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const user = getUserFromRequest(req);
    
    const allNotes = loadNotes();
    
    let deleted = false;
    let deletedNote = null;
    
    for (const [patientId, patientNotes] of Object.entries(allNotes)) {
      const noteIndex = patientNotes.findIndex(n => n.id === noteId);
      if (noteIndex !== -1) {
        deletedNote = allNotes[patientId][noteIndex];
        
        // Check access for non-admin users
        if (user.authenticated && !user.isAdmin && user.userId) {
          if (deletedNote.createdBy && deletedNote.createdBy !== user.userId) {
            return res.status(403).json({ success: false, error: 'Access denied to this note' });
          }
        }
        
        allNotes[patientId].splice(noteIndex, 1);
        deleted = true;
        break;
      }
    }
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    saveNotes(allNotes);
    
    if (user.authenticated && deletedNote) {
      createAuditLog({
        action: 'DELETE',
        resourceType: 'progress_note',
        resourceId: noteId,
        patientId: deletedNote.patientId,
        patientName: deletedNote.patientName,
        userId: user.userId,
        userName: user.userName,
        locationId: deletedNote.locationId,
        description: `Deleted progress note for ${deletedNote.patientName}`,
        ipAddress: getIpAddress(req)
      });
    }
    
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting note:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/patients/:patientId/notes/:noteId', async (req, res) => {
  try {
    const { patientId, noteId } = req.params;
    const user = getUserFromRequest(req);
    
    const allNotes = loadNotes();
    
    if (!allNotes[patientId]) {
      return res.status(404).json({ success: false, error: 'Patient notes not found' });
    }
    
    const noteIndex = allNotes[patientId].findIndex(n => n.id === noteId);
    
    if (noteIndex === -1) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    const deletedNote = allNotes[patientId][noteIndex];
    
    // Check access for non-admin users
    if (user.authenticated && !user.isAdmin && user.userId) {
      if (deletedNote.createdBy && deletedNote.createdBy !== user.userId) {
        return res.status(403).json({ success: false, error: 'Access denied to this note' });
      }
    }
    
    allNotes[patientId].splice(noteIndex, 1);
    saveNotes(allNotes);
    
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting note:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PATIENT FILES ENDPOINTS
// ============================================

app.post('/api/patients/:patientId/files', upload.single('file'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const locationId = req.headers['x-location-id'] || req.body.locationId;
    const { fileName, fileType, uploadedBy } = req.body;
    const user = getUserFromRequest(req);
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const allFiles = loadPatientFiles();
    
    if (!allFiles[patientId]) {
      allFiles[patientId] = [];
    }
    
    const fileDoc = {
      id: `FILE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId,
      locationId,
      fileName: fileName || req.file.originalname,
      originalName: req.file.originalname,
      fileType: fileType || req.file.mimetype,
      filePath: req.file.path,
      fileSize: req.file.size,
      uploadedBy: user.userName || uploadedBy || 'Staff',
      uploadedById: user.userId,
      createdAt: new Date().toISOString()
    };
    
    allFiles[patientId].push(fileDoc);
    savePatientFiles(allFiles);
    
    if (user.authenticated) {
      createAuditLog({
        action: 'UPLOAD',
        resourceType: 'file',
        resourceId: fileDoc.id,
        patientId: patientId,
        userId: user.userId,
        userName: user.userName,
        locationId: locationId,
        description: `Uploaded file: ${fileDoc.fileName}`,
        metadata: { fileName: fileDoc.fileName, fileType: fileDoc.fileType, fileSize: fileDoc.fileSize },
        ipAddress: getIpAddress(req)
      });
    }
    
    res.json({ success: true, file: fileDoc });
  } catch (error) {
    console.error('❌ Error uploading file:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/patients/:patientId/files', async (req, res) => {
  try {
    const { patientId } = req.params;
    const locationId = req.headers['x-location-id'];
    const user = getUserFromRequest(req);
    
    const allFiles = loadPatientFiles();
    let patientFiles = allFiles[patientId] || [];
    
    // Filter by location
    if (locationId) {
      patientFiles = patientFiles.filter(f => !f.locationId || f.locationId === locationId);
    }
    
    // Filter for non-admin users
    if (user.authenticated && !user.isAdmin && user.userId) {
      patientFiles = patientFiles.filter(f => f.uploadedById === user.userId);
    }
    
    patientFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ success: true, files: patientFiles });
  } catch (error) {
    console.error('❌ Error fetching files:', error.message);
    res.status(500).json({ success: false, message: error.message, files: [] });
  }
});

app.get('/api/patients/:patientId/files/:fileId/download', async (req, res) => {
  try {
    const { patientId, fileId } = req.params;
    const user = getUserFromRequest(req);
    
    const allFiles = loadPatientFiles();
    const patientFiles = allFiles[patientId] || [];
    const file = patientFiles.find(f => f.id === fileId);
    
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    // Check access for non-admin users
    if (user.authenticated && !user.isAdmin && user.userId) {
      if (file.uploadedById && file.uploadedById !== user.userId) {
        return res.status(403).json({ success: false, error: 'Access denied to this file' });
      }
    }
    
    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on disk' });
    }
    
    if (user.authenticated) {
      createAuditLog({
        action: 'DOWNLOAD',
        resourceType: 'file',
        resourceId: fileId,
        patientId: patientId,
        userId: user.userId,
        userName: user.userName,
        locationId: file.locationId,
        description: `Downloaded file: ${file.fileName}`,
        ipAddress: getIpAddress(req)
      });
    }
    
    res.download(file.filePath, file.originalName || file.fileName);
  } catch (error) {
    console.error('❌ Error downloading file:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/patients/:patientId/files/:fileId', async (req, res) => {
  try {
    const { patientId, fileId } = req.params;
    const user = getUserFromRequest(req);
    
    const allFiles = loadPatientFiles();
    
    if (!allFiles[patientId]) {
      return res.status(404).json({ success: false, message: 'Patient files not found' });
    }
    
    const fileIndex = allFiles[patientId].findIndex(f => f.id === fileId);
    
    if (fileIndex === -1) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    const file = allFiles[patientId][fileIndex];
    
    // Check access for non-admin users
    if (user.authenticated && !user.isAdmin && user.userId) {
      if (file.uploadedById && file.uploadedById !== user.userId) {
        return res.status(403).json({ success: false, error: 'Access denied to this file' });
      }
    }
    
    // Delete from disk
    if (file.filePath && fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }
    
    allFiles[patientId].splice(fileIndex, 1);
    savePatientFiles(allFiles);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting file:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DRAFT NOTES ENDPOINTS
// ============================================

app.get('/api/patients/:id/draft', async (req, res) => {
  try {
    const { id } = req.params;
    
    const allDrafts = loadDrafts();
    const draft = allDrafts[id] || null;
    
    res.json({ success: true, draft: draft });
  } catch (error) {
    console.error('❌ Error fetching draft:', error.message);
    res.status(500).json({ success: false, error: error.message, draft: null });
  }
});

app.post('/api/patients/:id/draft', async (req, res) => {
  try {
    const { id } = req.params;
    const draftData = req.body;
    
    const allDrafts = loadDrafts();
    
    allDrafts[id] = {
      id: allDrafts[id]?.id || `DRAFT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId: id,
      status: 'draft',
      createdAt: allDrafts[id]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draftData
    };
    
    saveDrafts(allDrafts);
    
    res.json({ success: true, draft: allDrafts[id] });
  } catch (error) {
    console.error('❌ Error saving draft:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/patients/:id/draft', async (req, res) => {
  try {
    const { id } = req.params;
    
    const allDrafts = loadDrafts();
    
    if (allDrafts[id]) {
      delete allDrafts[id];
      saveDrafts(allDrafts);
    }
    
    res.json({ success: true, message: 'Draft deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting draft:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// APPOINTMENTS
// ============================================

app.get('/api/appointments', async (req, res) => {
  try {
    const { locationId, userId } = req.query;
    const location = getLocationConfig(locationId);
    const user = getUserFromRequest(req);
    
    const now = new Date();
    const startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 1);
    const endDate = new Date(now);
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    const params = {
      locationId,
      startTime: startDate.getTime(),
      endTime: endDate.getTime(),
      calendarId: location.calendarId
    };
    
    const result = await callGHL('/calendars/events', 'GET', null, params, location.apiKey);

    let appointments = result.events || [];
    
    // For non-admin users, filter to only appointments with assigned patients
    // This would require cross-referencing with patient data
    // For now, we return all appointments but this should be enhanced
    
    res.json({ success: true, appointments: appointments, total: appointments.length });
  } catch (error) {
    console.error('❌ Error fetching appointments:', error.message);
    res.status(500).json({ success: false, error: error.message, appointments: [] });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    const result = await callGHL('/calendars/events', 'POST', req.body, {}, location.apiKey);

    res.json({ success: true, appointment: result.event });
  } catch (error) {
    console.error('❌ Error creating appointment:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    const result = await callGHL(`/calendars/events/${id}`, 'PUT', req.body, {}, location.apiKey);

    res.json({ success: true, appointment: result.event });
  } catch (error) {
    console.error('❌ Error updating appointment:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    await callGHL(`/calendars/events/${id}`, 'DELETE', null, {}, location.apiKey);

    res.json({ success: true, message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting appointment:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/test-calendars', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 365);
    
    const calendarsResult = await callGHL('/calendars/', 'GET', null, { locationId }, location.apiKey);

    const calendars = calendarsResult.calendars || [];
    const results = [];
    
    for (const calendar of calendars) {
      try {
        const apptResult = await callGHL(
          '/calendars/events', 'GET', null,
          { locationId, calendarId: calendar.id, startTime: startDate.toISOString(), endTime: endDate.toISOString() },
          location.apiKey
        );
        
        results.push({
          calendarId: calendar.id,
          name: calendar.name,
          appointmentCount: apptResult.events?.length || 0
        });
      } catch (error) {
        console.log(`❌ ${calendar.name}: ${error.message}`);
      }
    }
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// STAFF ENDPOINTS
// ============================================

app.get('/api/staff', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    const users = location.users || [];
    
    res.json({ success: true, staff: users, total: users.length });
  } catch (error) {
    console.error('❌ Error fetching staff:', error.message);
    res.status(500).json({ success: false, error: error.message, staff: [] });
  }
});

app.get('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    const user = (location.users || []).find(u => u.id === id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }
    
    res.json({ success: true, staff: user });
  } catch (error) {
    console.error('❌ Error fetching staff member:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/staff', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
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
    
    createAuditLog({
      action: 'CREATE',
      resourceType: 'staff',
      resourceId: newUser.id,
      userId: req.user.userId,
      userName: req.user.userName,
      locationId: locationId,
      description: `Created staff member: ${newUser.firstName} ${newUser.lastName}`,
      ipAddress: getIpAddress(req)
    });
    
    res.json({ success: true, staff: newUser });
  } catch (error) {
    console.error('❌ Error adding staff member:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/staff/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    const userIndex = (location.users || []).findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }
    
    LOCATIONS[locationId].users[userIndex] = {
      ...LOCATIONS[locationId].users[userIndex],
      ...req.body,
      id
    };
    
    fs.writeFileSync(locationsPath, JSON.stringify(LOCATIONS, null, 2));
    
    res.json({ success: true, staff: LOCATIONS[locationId].users[userIndex] });
  } catch (error) {
    console.error('❌ Error updating staff member:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/staff/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    const userIndex = (location.users || []).findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }
    
    const deletedUser = LOCATIONS[locationId].users[userIndex];
    LOCATIONS[locationId].users.splice(userIndex, 1);
    
    fs.writeFileSync(locationsPath, JSON.stringify(LOCATIONS, null, 2));
    
    createAuditLog({
      action: 'DELETE',
      resourceType: 'staff',
      resourceId: id,
      userId: req.user.userId,
      userName: req.user.userName,
      locationId: locationId,
      description: `Deleted staff member: ${deletedUser.firstName} ${deletedUser.lastName}`,
      ipAddress: getIpAddress(req)
    });
    
    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting staff:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TASKS
// ============================================

app.get('/api/tasks', async (req, res) => {
  try {
    const { locationId, limit = 100 } = req.query;
    const location = getLocationConfig(locationId);
    
    const result = await callGHL('/contacts/tasks', 'GET', null, { locationId, limit }, location.apiKey);
    
    res.json({ success: true, tasks: result.tasks || [] });
  } catch (error) {
    console.error('❌ Error fetching tasks:', error.message);
    res.status(500).json({ success: false, error: error.message, tasks: [] });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    const result = await callGHL('/contacts/tasks', 'POST', req.body, {}, location.apiKey);

    res.json({ success: true, task: result.task });
  } catch (error) {
    console.error('❌ Error creating task:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    await callGHL(`/contacts/tasks/${id}`, 'DELETE', null, {}, location.apiKey);

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting task:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GHL INVOICES - ADMIN ONLY
// ============================================

app.get('/api/ghl/invoices', requireAuth, requireAdmin, async (req, res) => {
  try {
    const locationId = req.query.locationId || req.headers['x-location-id'];
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Location ID required' });
    }
    
    const location = getLocationConfig(locationId);
    
    console.log(`💰 Fetching ALL invoices for location: ${location.name}`);
    
    const result = await callGHL(
      `/invoices/`, 'GET', null,
      { altId: locationId, altType: 'location', limit: 1000, offset: '0' },
      location.apiKey
    );

    res.json({ success: true, invoices: result.invoices || [] });
  } catch (error) {
    console.error('❌ Error fetching all invoices:', error.message);
    
    if (error.message.includes('403') || error.message.includes('422')) {
      return res.json({ success: true, invoices: [], warning: 'Invoice API permission error' });
    }
    
    res.status(500).json({ success: false, error: error.message, invoices: [] });
  }
});

app.put('/api/ghl/invoices/:invoiceId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const locationId = req.headers['x-location-id'];
    const location = getLocationConfig(locationId);
    
    const result = await callGHL(`/invoices/${invoiceId}`, 'PUT', req.body, {}, location.apiKey);

    createAuditLog({
      action: 'UPDATE',
      resourceType: 'invoice',
      resourceId: invoiceId,
      userId: req.user.userId,
      userName: req.user.userName,
      locationId: locationId,
      description: `Updated invoice: ${invoiceId}`,
      ipAddress: getIpAddress(req)
    });

    res.json({ success: true, invoice: result.invoice || result });

  } catch (error) {
    console.error('❌ Error updating GHL invoice:', error.message);
    
    if (error.message.includes('403')) {
      return res.status(403).json({ success: false, error: 'Invoice feature not available' });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// INVOICES - FOR SPECIFIC CONTACT
// ============================================

app.get('/api/invoices/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const locationId = req.headers['x-location-id'];
    const location = getLocationConfig(locationId);
    
    const result = await callGHL(
      `/invoices/`, 'GET', null,
      { altId: locationId, altType: 'location', limit: 1000, offset: '0' },
      location.apiKey
    );
    
    const contactInvoices = (result.invoices || []).filter(invoice => 
      invoice.contactDetails?.id === contactId || invoice.contactId === contactId
    );
    
    res.json({ success: true, invoices: contactInvoices });
  } catch (error) {
    console.error('❌ Error fetching invoices:', error.message);
    
    if (error.message.includes('403') || error.message.includes('422')) {
      return res.json({ success: true, invoices: [] });
    }
    
    res.status(500).json({ success: false, error: error.message, invoices: [] });
  }
});

app.get('/api/invoices/detail/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const locationId = req.headers['x-location-id'];
    const location = getLocationConfig(locationId);
    
    const result = await callGHL(`/invoices/${invoiceId}`, 'GET', null, {}, location.apiKey);

    res.json({ success: true, invoice: result.invoice });
  } catch (error) {
    console.error('❌ Error fetching invoice:', error.message);
    
    if (error.message.includes('403')) {
      return res.status(403).json({ success: false, error: 'Invoice feature not available' });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/invoices/:invoiceId/service-date', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { appointmentId, serviceDate } = req.body;
    const locationId = req.headers['x-location-id'];

    const serviceDatesPath = path.join(__dirname, 'invoice-service-dates.json');
    let serviceDates = loadJsonFile(serviceDatesPath, {});

    serviceDates[invoiceId] = {
      invoiceId, appointmentId, serviceDate, locationId,
      updatedAt: new Date().toISOString()
    };

    saveJsonFile(serviceDatesPath, serviceDates);

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Error saving service date:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/invoices/:invoiceId/service-date', async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const serviceDatesPath = path.join(__dirname, 'invoice-service-dates.json');
    const serviceDates = loadJsonFile(serviceDatesPath, {});
    const serviceDate = serviceDates[invoiceId] || null;

    res.json({ success: true, serviceDate });

  } catch (error) {
    console.error('❌ Error getting service date:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BILLING ENDPOINTS
// ============================================

app.get('/api/billing/active-users', async (req, res) => {
  try {
    const { locationId, month } = req.query;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Missing locationId' });
    }

    const accessLogsPath = path.join(__dirname, 'user-access-logs.json');
    const accessLogs = loadJsonFile(accessLogsPath, {});
    const locationLogs = accessLogs[locationId];

    if (!locationLogs) {
      return res.json({ success: true, locationId, activeUsers: 0, users: [] });
    }

    const targetMonth = month || new Date().toISOString().substring(0, 7);

    const activeUsers = Object.values(locationLogs.users).filter(user => 
      user.monthlyAccess && user.monthlyAccess[targetMonth] > 0
    );

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
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/billing/all-locations', async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().substring(0, 7);

    const accessLogsPath = path.join(__dirname, 'user-access-logs.json');
    const accessLogs = loadJsonFile(accessLogsPath, {});

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

    res.json({
      success: true,
      month: targetMonth,
      totalLocations: locationSummaries.length,
      totalRevenue,
      locations: locationSummaries
    });

  } catch (error) {
    console.error('❌ Error getting billing summary:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/location/:locationId', (req, res) => {
  try {
    const { locationId } = req.params;
    const location = LOCATIONS[locationId];
    
    if (location) {
      res.json({ success: true, location: { id: locationId, name: location.name } });
    } else {
      res.status(404).json({ success: false, error: 'Location not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// STEDI CLAIMS INTEGRATION
// ============================================

app.get('/api/practice-info', async (req, res) => {
  try {
    const { locationId } = req.query;
    const location = getLocationConfig(locationId);
    
    const result = await callGHL('/locations/custom-values', 'GET', null, { locationId }, location.apiKey);
    
    const customValues = result.customValues || [];
    
    const getValue = (key) => {
      const field = customValues.find(cv => 
        cv.key === key || cv.fieldKey === key ||
        cv.key?.includes(key) || cv.fieldKey?.includes(key)
      );
      return field?.value || '';
    };
    
    const practiceInfo = {
      name: getValue('group_practice_name') || location.name,
      npi: getValue('group_npi_type_2_organ'),
      taxId: getValue('tax_id_number'),
      address: getValue('credentialing_contact_a'),
      city: getValue('credentialing_contact_cit'),
      state: getValue('clinician_primary_practic'),
      zip: getValue('credentialing_contact_zi'),
      fax: getValue('clinician_secure_fax'),
      contactName: getValue('credentialing_contact_na'),
      phone: getValue('clinician_secure_fax'),
      medicaidNumber: getValue('medicaid_number')
    };
    
    res.json({ success: true, practiceInfo });
  } catch (error) {
    console.error('❌ Error fetching practice info:', error.message);
    
    try {
      const location = getLocationConfig(req.query.locationId);
      res.json({
        success: true,
        practiceInfo: {
          name: location.name, npi: '', taxId: '', address: '',
          city: '', state: '', zip: '', fax: '', contactName: '', phone: ''
        },
        warning: 'Using fallback data'
      });
    } catch (e) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// Submit claim
app.post('/api/claims/submit', async (req, res) => {
  try {
    const { locationId } = req.query;
    const requestBody = req.body;
    const user = getUserFromRequest(req);
    
    const isCMS1500Format = requestBody.payer && requestBody.patient && requestBody.billingProvider;
    
    let patientId, noteId, payerId, payerName, chargeAmount, patientControlNumber;
    let patientInfo, serviceInfo;
    
    if (isCMS1500Format) {
      patientId = requestBody.patientId;
      noteId = requestBody.appointmentId;
      payerId = requestBody.payer.payerId;
      payerName = requestBody.payer.payerName;
      chargeAmount = requestBody.totalCharge;
      patientControlNumber = requestBody.patientControlNumber;
      
      patientInfo = {
        firstName: requestBody.patient.firstName,
        lastName: requestBody.patient.lastName,
        memberId: requestBody.payer.memberId,
        groupNumber: requestBody.insured.policyGroupId
      };
      
      const firstLine = requestBody.serviceLines?.[0] || {};
      serviceInfo = {
        sessionDate: firstLine.dateFrom,
        cptCode: firstLine.cptCode,
        clinicianName: firstLine.renderingProviderName,
        diagnosisCodes: requestBody.diagnosisCodes || [],
        placeOfService: firstLine.placeOfService
      };
    } else {
      const { 
        patientId: pid, noteId: nid, payerId: pId, payerName: pName,
        patientInfo: pInfo, serviceInfo: sInfo, chargeAmount: cAmount
      } = requestBody;
      
      patientId = pid;
      noteId = nid;
      payerId = pId;
      payerName = pName;
      chargeAmount = cAmount;
      patientInfo = pInfo;
      serviceInfo = sInfo;
      patientControlNumber = `${patientId.substring(0, 10)}_${Date.now()}`;
    }
    
    const allClaims = loadClaims();
    if (!allClaims[patientId]) {
      allClaims[patientId] = [];
    }
    
    const editingClaimId = requestBody.editingClaimId;
    let claimRecord;
    
    if (editingClaimId) {
      let foundClaim = null;
      
      for (const pid of Object.keys(allClaims)) {
        const claimIndex = allClaims[pid].findIndex(c => c.id === editingClaimId);
        if (claimIndex !== -1) {
          foundClaim = allClaims[pid][claimIndex];
          
          allClaims[pid][claimIndex] = {
            ...foundClaim,
            patientControlNumber, payerId, payerName,
            cptCode: serviceInfo.cptCode,
            diagnosisCodes: serviceInfo.diagnosisCodes,
            chargeAmount: parseFloat(chargeAmount),
            sessionDate: serviceInfo.sessionDate,
            clinicianName: serviceInfo.clinicianName,
            status: 'ready',
            updatedAt: new Date().toISOString(),
            patientInfo: {
              firstName: patientInfo.firstName,
              lastName: patientInfo.lastName,
              name: `${patientInfo.firstName} ${patientInfo.lastName}`,
              memberId: patientInfo.memberId,
              groupNumber: patientInfo.groupNumber
            },
            cms1500Data: requestBody
          };
          
          claimRecord = allClaims[pid][claimIndex];
          break;
        }
      }
      
      if (!foundClaim) {
        return res.status(404).json({ success: false, error: 'Original claim not found' });
      }
    } else {
      claimRecord = {
        id: `CLAIM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patientControlNumber, patientId, noteId, locationId,
        payerId, payerName,
        cptCode: serviceInfo.cptCode,
        diagnosisCodes: serviceInfo.diagnosisCodes,
        chargeAmount: parseFloat(chargeAmount),
        sessionDate: serviceInfo.sessionDate,
        clinicianName: serviceInfo.clinicianName,
        status: 'ready',
        submittedVia: 'manual',
        createdAt: new Date().toISOString(),
        submittedAt: null,
        paidAt: null,
        paidAmount: null,
        notes: '',
        patientInfo: {
          firstName: patientInfo.firstName,
          lastName: patientInfo.lastName,
          name: `${patientInfo.firstName} ${patientInfo.lastName}`,
          memberId: patientInfo.memberId,
          groupNumber: patientInfo.groupNumber
        },
        cms1500Data: requestBody
      };
      
      allClaims[patientId].push(claimRecord);
    }
    
    saveClaims(allClaims);
    
    if (user.authenticated) {
      createAuditLog({
        action: editingClaimId ? 'UPDATE' : 'SUBMIT',
        resourceType: 'claim',
        resourceId: claimRecord.id,
        patientId: patientId,
        patientName: `${patientInfo.firstName} ${patientInfo.lastName}`,
        userId: user.userId,
        userName: user.userName,
        locationId: locationId,
        description: editingClaimId 
          ? `Updated claim for ${patientInfo.firstName} ${patientInfo.lastName}`
          : `Submitted claim for ${patientInfo.firstName} ${patientInfo.lastName} - $${chargeAmount}`,
        metadata: { payerId, payerName, chargeAmount },
        ipAddress: getIpAddress(req)
      });
    }
    
    res.json({
      success: true,
      claim: claimRecord,
      message: editingClaimId ? 'Claim updated' : 'Claim saved and ready for manual submission'
    });
    
  } catch (error) {
    console.error('❌ Error saving claim:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update claim status - ADMIN ONLY
app.patch('/api/claims/:claimId/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, notes, submittedAt, paidAt, paidAmount } = req.body;
    
    const allClaims = loadClaims();
    
    for (const patientId of Object.keys(allClaims)) {
      const claimIndex = allClaims[patientId].findIndex(c => c.id === claimId);
      if (claimIndex !== -1) {
        if (status) allClaims[patientId][claimIndex].status = status;
        if (notes !== undefined) allClaims[patientId][claimIndex].notes = notes;
        if (submittedAt) allClaims[patientId][claimIndex].submittedAt = submittedAt;
        if (paidAt) allClaims[patientId][claimIndex].paidAt = paidAt;
        if (paidAmount !== undefined) allClaims[patientId][claimIndex].paidAmount = paidAmount;
        allClaims[patientId][claimIndex].updatedAt = new Date().toISOString();
        
        saveClaims(allClaims);
        
        createAuditLog({
          action: 'UPDATE',
          resourceType: 'claim',
          resourceId: claimId,
          patientId: patientId,
          userId: req.user.userId,
          userName: req.user.userName,
          locationId: allClaims[patientId][claimIndex].locationId,
          description: `Updated claim status to: ${status}`,
          ipAddress: getIpAddress(req)
        });
        
        return res.json({ success: true, claim: allClaims[patientId][claimIndex] });
      }
    }
    
    res.status(404).json({ success: false, error: 'Claim not found' });
    
  } catch (error) {
    console.error('❌ Error updating claim:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLAIM DRAFTS
// ============================================

app.post('/api/claims/draft', async (req, res) => {
  try {
    const { locationId, appointmentId, patientId, claimData, status } = req.body;
    
    const allDrafts = loadClaimDrafts();
    const draftKey = `${locationId}_${appointmentId}`;
    
    allDrafts[draftKey] = {
      id: draftKey, locationId, appointmentId, patientId, claimData,
      status: status || 'draft',
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    saveClaimDrafts(allDrafts);
    
    res.json({ success: true, draft: allDrafts[draftKey] });
    
  } catch (error) {
    console.error('❌ Error saving draft:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/claims/drafts', async (req, res) => {
  try {
    const { locationId } = req.query;
    
    const allDrafts = loadClaimDrafts();
    const locationDrafts = Object.values(allDrafts).filter(draft => draft.locationId === locationId);
    locationDrafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    res.json({ success: true, drafts: locationDrafts });
    
  } catch (error) {
    console.error('❌ Error fetching drafts:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/claims/draft/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { locationId } = req.query;
    
    const allDrafts = loadClaimDrafts();
    const draftKey = `${locationId}_${appointmentId}`;
    const draft = allDrafts[draftKey];
    
    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }
    
    res.json({ success: true, draft });
    
  } catch (error) {
    console.error('❌ Error fetching draft:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/claims/draft/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { locationId } = req.query;
    
    const allDrafts = loadClaimDrafts();
    const draftKey = `${locationId}_${appointmentId}`;
    
    if (allDrafts[draftKey]) {
      delete allDrafts[draftKey];
      saveClaimDrafts(allDrafts);
    }
    
    res.json({ success: true, message: 'Draft deleted' });
    
  } catch (error) {
    console.error('❌ Error deleting draft:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get claims for a patient
app.get('/api/patients/:patientId/claims', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const allClaims = loadClaims();
    const patientClaims = allClaims[patientId] || [];
    
    patientClaims.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    
    res.json({ success: true, claims: patientClaims });
  } catch (error) {
    console.error('❌ Error fetching claims:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ERA Webhook
app.post('/api/webhooks/stedi/era', async (req, res) => {
  try {
    console.log('📥 Received ERA webhook from Stedi');
    
    const eraData = req.body;
    const payments = eraData.claim_payments || eraData.claimPayments || eraData.transactions || [];
    
    for (const payment of payments) {
      const patientControlNumber = payment.patient_control_number || payment.patientControlNumber || payment.claimId || '';
      const paymentAmount = parseFloat(payment.payment_amount || payment.paymentAmount || payment.paidAmount || 0);
      const adjustments = payment.adjustments || payment.adjustment_details || [];
      
      const [patientId] = patientControlNumber.split('_');
      
      if (!patientId) continue;
      
      let contractualAdjustment = 0;
      let patientResponsibility = 0;
      let denialAmount = 0;
      
      for (const adj of adjustments) {
        const amount = parseFloat(adj.amount || adj.adjustmentAmount || 0);
        const groupCode = adj.group_code || adj.groupCode || adj.adjustmentGroupCode || '';
        
        if (groupCode === 'CO') contractualAdjustment += amount;
        else if (groupCode === 'PR') patientResponsibility += amount;
        else if (groupCode === 'OA' || groupCode === 'CR') denialAmount += amount;
      }
      
      const allClaims = loadClaims();
      const patientClaims = allClaims[patientId] || [];
      
      const claimIndex = patientClaims.findIndex(c => c.patientControlNumber === patientControlNumber);
      
      if (claimIndex !== -1) {
        allClaims[patientId][claimIndex] = {
          ...allClaims[patientId][claimIndex],
          status: paymentAmount > 0 ? 'paid' : (denialAmount > 0 ? 'denied' : 'adjusted'),
          paymentInfo: {
            paymentAmount, contractualAdjustment, patientResponsibility, denialAmount,
            checkNumber: payment.check_number || payment.checkNumber || payment.traceNumber || '',
            paymentDate: payment.payment_date || payment.paymentDate || new Date().toISOString(),
            eraReceived: new Date().toISOString(),
            rawEraData: payment
          }
        };
        
        saveClaims(allClaims);
      }
    }
    
    res.json({ success: true, message: 'ERA processed successfully' });
    
  } catch (error) {
    console.error('❌ Error processing ERA webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get patient billing summary
app.get('/api/patients/:patientId/billing', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const allClaims = loadClaims();
    const allPayments = loadPayments();
    
    const patientClaims = allClaims[patientId] || [];
    const patientPayments = allPayments[patientId] || [];
    
    let totalBilled = 0;
    let totalInsurancePaid = 0;
    let totalAdjustments = 0;
    let totalPatientResponsibility = 0;
    
    for (const claim of patientClaims) {
      totalBilled += claim.chargeAmount || 0;
      
      if (claim.paymentInfo) {
        totalInsurancePaid += claim.paymentInfo.paymentAmount || 0;
        totalAdjustments += claim.paymentInfo.contractualAdjustment || 0;
        totalPatientResponsibility += claim.paymentInfo.patientResponsibility || 0;
      }
    }
    
    const totalPatientPaid = patientPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const patientBalance = totalPatientResponsibility - totalPatientPaid;
    
    res.json({
      success: true,
      billing: {
        claims: patientClaims,
        payments: patientPayments,
        summary: {
          totalBilled, totalInsurancePaid, totalAdjustments,
          totalPatientResponsibility, totalPatientPaid, patientBalance
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching billing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record patient payment
app.post('/api/patients/:patientId/payments', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { amount, method, reference, note } = req.body;
    const user = getUserFromRequest(req);
    
    const allPayments = loadPayments();
    
    if (!allPayments[patientId]) {
      allPayments[patientId] = [];
    }
    
    const payment = {
      id: `PMT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: parseFloat(amount),
      method: method || 'card',
      reference: reference || '',
      note: note || '',
      date: new Date().toISOString(),
      postedBy: user.userName || req.body.postedBy || 'Staff'
    };
    
    allPayments[patientId].push(payment);
    savePayments(allPayments);
    
    res.json({ success: true, payment });
    
  } catch (error) {
    console.error('❌ Error recording payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/patients/:patientId/payments', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const allPayments = loadPayments();
    const patientPayments = allPayments[patientId] || [];
    
    res.json({ success: true, payments: patientPayments });
    
  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test Stedi connection
app.get('/api/stedi/test', async (req, res) => {
  try {
    if (!STEDI_API_KEY) {
      return res.status(400).json({ success: false, error: 'STEDI_API_KEY not configured' });
    }
    
    const response = await axios.get(
      'https://healthcare.us.stedi.com/2024-04-01/payers',
      {
        headers: {
          'Authorization': `Key ${STEDI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({ success: true, message: 'Stedi connection successful', payers: response.data });
  } catch (error) {
    console.error('❌ Stedi connection error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

// Simulate ERA for testing (remove in production)
app.post('/api/test/simulate-era', async (req, res) => {
  if (isProduction) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  try {
    const { patientId, claimId, paymentAmount, patientResponsibility } = req.body;
    
    const allClaims = loadClaims();
    const patientClaims = allClaims[patientId] || [];
    
    const claimIndex = patientClaims.findIndex(c => c.id === claimId);
    
    if (claimIndex === -1) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }
    
    const claim = patientClaims[claimIndex];
    const contractualAdjustment = claim.chargeAmount - paymentAmount - patientResponsibility;
    
    allClaims[patientId][claimIndex] = {
      ...claim,
      status: 'paid',
      paymentInfo: {
        paymentAmount: parseFloat(paymentAmount),
        contractualAdjustment: contractualAdjustment > 0 ? contractualAdjustment : 0,
        patientResponsibility: parseFloat(patientResponsibility),
        denialAmount: 0,
        checkNumber: `TEST_${Date.now()}`,
        paymentDate: new Date().toISOString(),
        eraReceived: new Date().toISOString()
      }
    };
    
    saveClaims(allClaims);
    
    res.json({ success: true, claim: allClaims[patientId][claimIndex] });
    
  } catch (error) {
    console.error('❌ Error simulating ERA:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FEE SCHEDULES - ADMIN ONLY
// ============================================

app.get('/api/fee-schedule', async (req, res) => {
  try {
    const { locationId } = req.query;
    const schedules = loadFeeSchedules();
    
    const schedule = schedules[locationId] || schedules.default || {
      '90832': 95, '90834': 130, '90837': 175, '90847': 150, '90853': 50
    };
    
    res.json({
      success: true,
      feeSchedule: schedule,
      locationId: locationId,
      isDefault: !schedules[locationId]
    });
  } catch (error) {
    console.error('❌ Error fetching fee schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/fee-schedule', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { locationId } = req.query;
    const { feeSchedule } = req.body;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Location ID required' });
    }
    
    const schedules = loadFeeSchedules();
    schedules[locationId] = feeSchedule;
    saveFeeSchedules(schedules);
    
    res.json({ success: true, message: 'Fee schedule updated', feeSchedule: feeSchedule });
  } catch (error) {
    console.error('❌ Error updating fee schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CUSTOM PAYERS - ADMIN ONLY
// ============================================

app.get('/api/custom-payers', async (req, res) => {
  try {
    const { locationId } = req.query;
    const allPayers = loadCustomPayers();
    const locationPayers = allPayers[locationId] || [];
    
    res.json({ success: true, payers: locationPayers });
  } catch (error) {
    console.error('❌ Error fetching custom payers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/custom-payers', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { locationId } = req.query;
    const { id, name } = req.body;
    
    if (!locationId || !id || !name) {
      return res.status(400).json({ success: false, error: 'Location ID, Payer ID, and Name required' });
    }
    
    const allPayers = loadCustomPayers();
    if (!allPayers[locationId]) {
      allPayers[locationId] = [];
    }
    
    const exists = allPayers[locationId].some(p => p.id === id);
    if (exists) {
      return res.status(400).json({ success: false, error: 'Payer ID already exists' });
    }
    
    allPayers[locationId].push({ id, name, custom: true });
    saveCustomPayers(allPayers);
    
    res.json({ success: true, payer: { id, name, custom: true } });
  } catch (error) {
    console.error('❌ Error adding custom payer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/custom-payers/:payerId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { locationId } = req.query;
    const { payerId } = req.params;
    
    const allPayers = loadCustomPayers();
    if (allPayers[locationId]) {
      allPayers[locationId] = allPayers[locationId].filter(p => p.id !== payerId);
      saveCustomPayers(allPayers);
    }
    
    res.json({ success: true, message: 'Payer deleted' });
  } catch (error) {
    console.error('❌ Error deleting custom payer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET ALL CLAIMS FOR LOCATION - ADMIN ONLY
// ============================================

app.get('/api/claims/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { locationId } = req.query;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Location ID required' });
    }
    
    const allClaims = loadClaims();
    const locationClaims = [];
    
    for (const [patientId, patientClaims] of Object.entries(allClaims)) {
      for (const claim of patientClaims) {
        if (claim.locationId === locationId || !claim.locationId) {
          locationClaims.push(claim);
        }
      }
    }
    
    locationClaims.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    
    res.json({ success: true, claims: locationClaims });
  } catch (error) {
    console.error('❌ Error fetching all claims:', error.message);
    res.status(500).json({ success: false, error: error.message, claims: [] });
  }
});

// Get all payments for a location - ADMIN ONLY
app.get('/api/payments/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { locationId } = req.query;
    
    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Location ID required' });
    }
    
    const allPayments = loadPayments();
    const locationPayments = [];
    
    for (const [patientId, patientPayments] of Object.entries(allPayments)) {
      for (const payment of patientPayments) {
        locationPayments.push({ ...payment, patientId });
      }
    }
    
    locationPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({ success: true, payments: locationPayments });
  } catch (error) {
    console.error('❌ Error fetching all payments:', error.message);
    res.status(500).json({ success: false, error: error.message, payments: [] });
  }
});

// ============================================
// AUDIT LOG ENDPOINTS - ADMIN ONLY
// ============================================

app.post('/api/audit-logs', async (req, res) => {
  try {
    const { action, resourceType, resourceId, patientId, patientName, description, metadata } = req.body;
    const user = getUserFromRequest(req);
    const locationId = req.body.locationId || user.locationId;

    const log = createAuditLog({
      action, resourceType, resourceId, patientId, patientName,
      userId: user.userId,
      userName: user.userName || req.body.userName,
      userEmail: user.userEmail || req.body.userEmail,
      locationId,
      description,
      metadata,
      ipAddress: getIpAddress(req)
    });

    res.json({ success: true, log });
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/audit-logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { locationId, userId: filterUserId, patientId, resourceType, action, startDate, endDate, search, page = 1, limit = 50 } = req.query;
    
    const auditData = loadAuditLogs();
    let logs = auditData.logs || [];

    if (locationId) logs = logs.filter(log => log.locationId === locationId);
    if (filterUserId) logs = logs.filter(log => log.userId === filterUserId);
    if (patientId) logs = logs.filter(log => log.patientId === patientId);
    if (resourceType) logs = logs.filter(log => log.resourceType === resourceType);
    if (action) logs = logs.filter(log => log.action === action);
    if (startDate) logs = logs.filter(log => new Date(log.timestamp) >= new Date(startDate));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      logs = logs.filter(log => new Date(log.timestamp) <= end);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      logs = logs.filter(log => 
        log.description?.toLowerCase().includes(searchLower) ||
        log.userName?.toLowerCase().includes(searchLower) ||
        log.patientName?.toLowerCase().includes(searchLower)
      );
    }

    const totalLogs = logs.length;
    const totalPages = Math.ceil(totalLogs / limit);
    const startIndex = (page - 1) * limit;
    const paginatedLogs = logs.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      success: true,
      logs: paginatedLogs,
      pagination: { page: parseInt(page), limit: parseInt(limit), totalLogs, totalPages, hasMore: page < totalPages }
    });
  } catch (error) {
    console.error('❌ Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/audit-logs/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { locationId } = req.query;
    const auditData = loadAuditLogs();
    let logs = auditData.logs || [];

    if (locationId) logs = logs.filter(log => log.locationId === locationId);

    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const logs24h = logs.filter(log => new Date(log.timestamp) >= last24h);
    const logs7d = logs.filter(log => new Date(log.timestamp) >= last7d);
    const logs30d = logs.filter(log => new Date(log.timestamp) >= last30d);

    const actionCounts = {};
    const resourceCounts = {};
    logs30d.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      resourceCounts[log.resourceType] = (resourceCounts[log.resourceType] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        total: logs.length,
        last24h: logs24h.length,
        last7d: logs7d.length,
        last30d: logs30d.length,
        uniqueUsers24h: [...new Set(logs24h.map(log => log.userId))].length,
        uniqueUsers7d: [...new Set(logs7d.map(log => log.userId))].length,
        actionCounts,
        resourceCounts,
        recentLogins: logs.filter(log => log.action === 'LOGIN').slice(0, 10),
        recentPatientViews: logs.filter(log => log.action === 'VIEW' && log.resourceType === 'patient').slice(0, 10)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/audit-logs/export', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { locationId, startDate, endDate } = req.query;
    const auditData = loadAuditLogs();
    let logs = auditData.logs || [];

    if (locationId) logs = logs.filter(log => log.locationId === locationId);
    if (startDate) logs = logs.filter(log => new Date(log.timestamp) >= new Date(startDate));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      logs = logs.filter(log => new Date(log.timestamp) <= end);
    }

    const headers = ['Timestamp', 'Action', 'Resource Type', 'Patient Name', 'User Name', 'Description', 'IP Address'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      csvRows.push([
        log.timestamp,
        log.action,
        log.resourceType,
        `"${(log.patientName || '').replace(/"/g, '""')}"`,
        `"${(log.userName || '').replace(/"/g, '""')}"`,
        `"${(log.description || '').replace(/"/g, '""')}"`,
        log.ipAddress || ''
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvRows.join('\n'));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/patients/:patientId/audit-logs', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const auditData = loadAuditLogs();
    let logs = (auditData.logs || []).filter(log => log.patientId === patientId);

    const totalLogs = logs.length;
    const totalPages = Math.ceil(totalLogs / limit);
    const paginatedLogs = logs.slice((page - 1) * limit, page * limit);

    res.json({ success: true, logs: paginatedLogs, pagination: { page: parseInt(page), totalLogs, totalPages } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🏥 LEADDASH HEALTH EHR - SECURED');
  console.log('========================================');
  console.log(`✅ Environment: ${NODE_ENV}`);
  console.log(`✅ Server: http://localhost:${PORT}`);
  console.log(`✅ Health: http://localhost:${PORT}/health`);
  console.log(`✅ SSO: http://localhost:${PORT}/auth/sso`);
  console.log(`✅ Locations configured: ${Object.keys(LOCATIONS).length}`);
  console.log(`✅ Allowed locations: ${Object.keys(ALLOWED_LOCATIONS).length}`);
  
  Object.entries(LOCATIONS).forEach(([id, location]) => {
    console.log(`   📍 ${location.name} (${id})`);
    console.log(`      👥 ${location.users?.length || 0} staff members`);
  });
  
  console.log('\n🔐 Security Features:');
  console.log(`   ✅ JWT Authentication`);
  console.log(`   ✅ Rate Limiting (100 req/15min, 10 login/15min)`);
  console.log(`   ✅ Role-based Access Control`);
  console.log(`   ✅ Location-scoped Data`);
  console.log(`   ✅ Audit Logging`);
  console.log(`   ${SSO_SECRET ? '✅' : '⚠️'} SSO Signature Verification`);
  
  console.log('\n✅ Ready for requests!');
  console.log('========================================\n');
});