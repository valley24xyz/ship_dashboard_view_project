const fs = require('fs');
const airlineMap = require('./airlineMap'); // Path to your airlineMap.js

const cleanedAirlineMap = {};

// Remove parentheses, "D/B/A" and everything after it, and "," and everything after it
Object.keys(airlineMap).forEach((key) => {
  let cleanedName = airlineMap[key]
    .replace(/\s*\(.*?\)\s*/g, '')  // Remove parentheses and content inside
    .replace(/\s*D\/B\/A.*$/g, '')  // Remove "D/B/A" and everything after
    .replace(/\s*,.*$/g, '')    // Remove "," and everything after
    .replace(/\s*\/.*$/g, '');

  cleanedAirlineMap[key] = cleanedName.trim();  // Ensure no leading or trailing spaces
});

// Write cleaned airlineMap to cleanedAirlineMap.js
fs.writeFile('cleanedAirlineMap.js', `module.exports = ${JSON.stringify(cleanedAirlineMap, null, 2)};`, (err) => {
  if (err) {
    console.error('Error writing cleanedAirlineMap.js:', err);
  } else {
    console.log('cleanedAirlineMap.js has been successfully created!');
  }
});
