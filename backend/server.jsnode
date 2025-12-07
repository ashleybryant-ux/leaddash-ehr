cd /Users/ashleybryant/Downloads/dreamsemr-v1.0.4/react/backend
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;

app.use(cors({
  origin: ['http://localhost:4173', 'http://localhost:5173', 'http://localhost:3000', 'https://ehr.leaddash.io'],
  credentials: true
}));
app.use(express.json());

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

app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🏥 LEADDASH EMR - MULTI-LOCATION BACKEND');
  console.log('========================================');
  console.log(`✅ Server: http://localhost:${PORT}`);
  console.log('========================================\n');
});
