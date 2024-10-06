const fs = require('fs');
const csvParser = require('csv-parser');

// Path to your CSV file
const csvFilePath = 'all_airline_codes.csv';

// Path to output the airlineMap.js file
const outputFilePath = 'airlineMap.js';

// Object to store airline mappings
const airlineMap = {};

// Read and parse the CSV file
fs.createReadStream(csvFilePath)
  .pipe(csvParser())
  .on('data', (row) => {
    const operatorCode = row['Operator Code'];
    const operatorName = row['Operator Name'];
    
    // Add to airlineMap only if both operatorCode and operatorName are present
    if (operatorCode && operatorName) {
      airlineMap[operatorCode.trim()] = operatorName.trim();
    }
  })
  .on('end', () => {
    // Write the airlineMap to a JS file as a module export
    const airlineMapJsContent = `const airlineMap = ${JSON.stringify(airlineMap, null, 2)};\nmodule.exports = airlineMap;`;

    fs.writeFile(outputFilePath, airlineMapJsContent, (err) => {
      if (err) {
        console.error('Error writing airlineMap.js:', err);
      } else {
        console.log('airlineMap.js has been created successfully.');
      }
    });
  });
