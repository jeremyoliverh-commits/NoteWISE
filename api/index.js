// Vercel serverless entry point
// This file adapts the Express app for Vercel's serverless environment
const app = require('../backend/server');

// On Vercel, the uploads directory is not writable in production,
// so we need to handle file uploads differently
// For now, file uploads will use memory storage on Vercel

module.exports = app;
