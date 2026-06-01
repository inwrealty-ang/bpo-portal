import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;

let sheetsClient = null;

async function getSheets() {
  if (!sheetsClient) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: GOOGLE_PRIVATE_KEY,
        client_email: GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

// Map photo status (true/false) to Y/N for spreadsheet
function encodePhotos(photos) {
  if (!photos) return '';
  const statuses = Object.entries(photos).map(([_, uploaded]) => uploaded ? 'Y' : 'N');
  return statuses.join('|');
}

function decodePhotos(photoString, photoNames) {
  const photos = {};
  if (!photoString || !photoNames) return photos;
  const statuses = photoString.split('|');
  photoNames.forEach((name, idx) => {
    photos[name] = statuses[idx] === 'Y';
  });
  return photos;
}

const photoNames = [
  'Street Sign', 'Address Verification', 'Front View', 'Left Side', 'Right Side',
  'Rear View', 'Up Street', 'Down Street', 'Across Street', 'Deferred Maintenance'
];

async function getOrders() {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'BPO_Orders!A:Q',
  });

  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const orders = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue; // Skip empty rows
    orders.push({
      id: row[0],
      address: row[1] || '',
      city: row[2] || '',
      state: row[3] || '',
      county: row[4] || '',
      type: row[5] || '',
      client: row[6] || '',
      assignedTo: row[7] || 'Unassigned',
      status: row[8] || 'New',
      due: row[9] || '',
      fee: parseInt(row[10]) || 0,
      occupancy: row[11] || 'Unknown',
      condition: row[12] || 'Unknown',
      utilities: row[13] || 'Unknown',
      neighborhood: row[14] || 'Unknown',
      notes: row[15] || '',
      pcrNotes: row[16] || '',
      photos: decodePhotos(row[17], photoNames),
    });
  }

  return orders;
}

async function updateOrder(orderId, updates) {
  const sheets = await getSheets();
  const orders = await getOrders();
  const orderIdx = orders.findIndex(o => o.id === orderId);
  if (orderIdx === -1) throw new Error('Order not found');

  const order = { ...orders[orderIdx], ...updates };

  // Find the row index in the sheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'BPO_Orders!A:A',
  });

  const ids = response.data.values?.map(r => r[0]) || [];
  const rowIndex = ids.indexOf(orderId);
  if (rowIndex === -1) throw new Error('Order not found in sheet');

  const updateRow = [
    order.id,
    order.address,
    order.city,
    order.state,
    order.county,
    order.type,
    order.client,
    order.assignedTo,
    order.status,
    order.due,
    order.fee,
    order.occupancy,
    order.condition,
    order.utilities,
    order.neighborhood,
    order.notes,
    order.pcrNotes,
    encodePhotos(order.photos),
  ];

  const range = `BPO_Orders!A${rowIndex + 1}:Q${rowIndex + 1}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [updateRow],
    },
  });

  return order;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET' && req.url === '/api/orders') {
      const orders = await getOrders();
      return res.status(200).json(orders);
    }

    if (req.method === 'PATCH' && req.url.startsWith('/api/orders/')) {
      const orderId = req.url.split('/').pop();
      const updated = await updateOrder(orderId, req.body);
      return res.status(200).json(updated);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
