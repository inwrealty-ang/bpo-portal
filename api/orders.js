const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;

const photoNames = [
  'Street Sign', 'Address Verification', 'Front View', 'Left Side', 'Right Side',
  'Rear View', 'Up Street', 'Down Street', 'Across Street', 'Deferred Maintenance'
];

function encodePhotos(photos) {
  if (!photos) return '';
  return Object.entries(photos).map(([_, uploaded]) => uploaded ? 'Y' : 'N').join('|');
}

function decodePhotos(photoString, photoNames) {
  const photos = {};
  if (!photoString || !photoNames) return photos;
  const statuses = photoString.split('|');
  photoNames.forEach((name, idx) => { photos[name] = statuses[idx] === 'Y'; });
  return photos;
}

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: GOOGLE_PRIVATE_KEY,
      client_email: GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getOrders() {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'BPO_Orders!A:R',
  });
  const rows = response.data.values || [];
  const orders = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    orders.push({
      id: row[0], address: row[1] || '', city: row[2] || '', state: row[3] || '',
      county: row[4] || '', type: row[5] || '', client: row[6] || '',
      assignedTo: row[7] || 'Unassigned', status: row[8] || 'New', due: row[9] || '',
      fee: parseInt(row[10]) || 0, occupancy: row[11] || 'Unknown',
      condition: row[12] || 'Unknown', utilities: row[13] || 'Unknown',
      neighborhood: row[14] || 'Unknown', notes: row[15] || '', pcrNotes: row[16] || '',
      photos: decodePhotos(row[17], photoNames),
    });
  }
  return orders;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const orders = await getOrders();
      return { statusCode: 200, headers, body: JSON.stringify(orders) };
    }

    if (event.httpMethod === 'PATCH') {
      const orderId = event.path.split('/').pop();
      const updates = JSON.parse(event.body);
      const sheets = await getSheets();
      const orders = await getOrders();
      const order = { ...orders.find(o => o.id === orderId), ...updates };
      const idResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: 'BPO_Orders!A:A',
      });
      const ids = idResponse.data.values?.map(r => r[0]) || [];
      const rowIndex = ids.indexOf(orderId);
      if (rowIndex === -1) throw new Error('Order not found');
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `BPO_Orders!A${rowIndex + 1}:R${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[
          order.id, order.address, order.city, order.state, order.county,
          order.type, order.client, order.assignedTo, order.status, order.due,
          order.fee, order.occupancy, order.condition, order.utilities,
          order.neighborhood, order.notes, order.pcrNotes, encodePhotos(order.photos)
        ]] }
      });
      return { statusCode: 200, headers, body: JSON.stringify(order) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
