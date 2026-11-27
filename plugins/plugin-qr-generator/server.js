// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
const express = require('express');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    plugin: 'plugin-qr-generator',
    version: '1.0.0',
    type: 'open-core-extension',
    timestamp: new Date().toISOString()
  });
});

app.get('/generate', async (req, res) => {
  const text = req.query.text || 'https://noduscore.org';
  try {
    const svg = await QRCode.toString(text, { type: 'svg', margin: 2 });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code', details: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Plugin-QR] Microservice running on port ${PORT}`);
});
