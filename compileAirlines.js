const axios = require('axios');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Your new API key
const API_KEY = '9e1dec98-97b7-4ac5-ba27-ae8f9b8c80fb';  // Replace with your new API key

// List of country codes
const countryCodes = [
  "ATG", "BLZ", "VGB", "CPV", "DJI", "GIB", "LBR", "SMR", "SYC", "SLB", "LCA",
  "GMB", "GNB", "VUT", "GRD", "SXM", "KNA", "VCT", "MNP", "WSM", "COM", "MAF",
  "DMA", "TON", "ASM", "FSM", "STP", "PLW", "SPM", "MHL", "COK", "AIA", "KIR",
  "FLK", "TUV", "NIU"  // Add more country codes here up to 70
];

// Define the CSV file where the airline codes will be appended
const csvFilePath = 'all_airline_codes.csv';

// Define a CSV writer with append mode
const csvWriterInstance = createCsvWriter({
  path: csvFilePath,
  header: [
    { id: 'operatorCode', title: 'Operator Code' },
    { id: 'operatorName', title: 'Operator Name' },
    { id: 'telephonyName', title: 'Telephony Name' },
    { id: 'countryName', title: 'Country Name' },
    { id: 'countryCode', title: 'Country Code' },
    { id: 'Last Modified', title: 'Last Modified' },
    { id: 'AIRAC', title: 'AIRAC' }
  ],
  append: true // Ensures appending to the existing file
});

// Fetch airline data for each country code and append it to the CSV
async function fetchAirlineDataForCountry(countryCode) {
  const url = `https://applications.icao.int/dataservices/api/code-list?api_key=${API_KEY}&format=json&states=${countryCode}`;

  try {
    const response = await axios.get(url);
    const airlineData = response.data;

    // If there is data, append it to the CSV file
    if (airlineData && airlineData.length > 0) {
      console.log(`Fetched data for ${countryCode}, appending to CSV...`);
      await csvWriterInstance.writeRecords(airlineData);
    } else {
      console.log(`No data for ${countryCode}`);
    }
  } catch (error) {
    console.error(`Error fetching data for ${countryCode}:`, error);
  }
}

// Function to run through all the country codes and fetch airline data
async function compileAirlineCodes() {
  for (const countryCode of countryCodes) {
    await fetchAirlineDataForCountry(countryCode);
  }
  console.log('Finished appending new airline codes to the CSV.');
}

// Run the script
compileAirlineCodes();
