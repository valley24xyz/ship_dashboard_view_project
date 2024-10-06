const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// List of country codes (you can expand or adjust this list)
const countryCodes = [
    "USA",
"CHN",
"JPN",
"DEU",
"BRA",
"FRA",
"ITA",
"RUS",
"GBR",
"AUS",
"CAN",
"IND",
"MEX",
"KOR",
"ESP",
"IDN",
"TUR",
"NLD",
"SAU",
"CHE",
"SWE",
"NOR",
"POL",
"BEL",
"NGA",
"ARG",
"TWN",
"AUT",
"IRN",
"THA",
"ARE",
"COL",
"VEN",
"ZAF",
"DNK",
"MYS",
"SGP",
"CHL",
"HKG",
"ISR",
"PHL",
"EGY",
"FIN",
"GRC",
"PAK",
"KAZ",
"IRQ",
"IRL",
"PRT",
"DZA",
"QAT",
"PER",
"CZE",
"ROU",
"NZL",
"KWT",
"UKR",
"VNM",
"BGD",
"HUN",
"AGO",
"MAR",
"SVK",
"PRI",
"ECU",
"OMN",
"AZE",
"CUB",
"LBY",
"BLR",
"LKA",
"SYR",
"LUX",
"MMR",
"HRV",
"DOM",
"URY",
"UZB",
"BGR",
"GTM",
"SDN",
"MAC",
"CRI",
"TUN",
"ETH"    // Add more country codes here up to 70
];

// Set up the CSV writer
const csvWriter = createCsvWriter({
    path: 'all_airline_codes.csv',
    header: [
        { id: 'operatorCode', title: 'Operator Code' },
        { id: 'operatorName', title: 'Operator Name' },
        { id: 'telephonyName', title: 'Telephony Name' },
        { id: 'countryName', title: 'Country Name' },
        { id: 'countryCode', title: 'Country Code' },
        { id: 'lastModified', title: 'Last Modified' },
        { id: 'AIRAC', title: 'AIRAC' }
    ]
});

// Function to fetch airline codes for a specific country
async function fetchAirlineCodesForCountry(countryCode) {
    const url = `https://applications.icao.int/dataservices/api/code-list?api_key=d487d606-65ea-4598-aa99-bd2ea6aa7f8b&format=json&states=${countryCode}`;
    
    try {
        const response = await axios.get(url);
        return response.data;  // Return the airline data for this country
    } catch (error) {
        console.error(`Error fetching airline codes for ${countryCode}:`, error);
        return [];
    }
}

// Function to compile all the airline data into a CSV
async function compileAirlineCodes() {
    let allAirlineData = [];

    // Loop through the country codes and fetch the airline codes
    for (const countryCode of countryCodes) {
        console.log(`Fetching airline codes for ${countryCode}...`);
        const airlineData = await fetchAirlineCodesForCountry(countryCode);
        
        // Map the data into the format required for the CSV
        const formattedData = airlineData.map(airline => ({
            operatorCode: airline.operatorCode,
            operatorName: airline.operatorName,
            telephonyName: airline.telephonyName,
            countryName: airline.countryName,
            countryCode: airline.countryCode,
            lastModified: airline["Last Modified"],
            AIRAC: airline.AIRAC
        }));

        // Add this country's airline data to the combined list
        allAirlineData = allAirlineData.concat(formattedData);
    }

    // Write all the combined airline data to a single CSV
    await csvWriter.writeRecords(allAirlineData);
    console.log('All airline codes successfully saved to all_airline_codes.csv');
}

// Compile the airline codes
compileAirlineCodes();
