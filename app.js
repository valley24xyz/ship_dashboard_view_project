const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = process.env.PORT || 8080;

// Store ships currently in the bounding box
let shipsData = [];
let shipCache = {}; // Cache to store ship data

app.use('/', express.static('public'));

// WebSocket setup to connect to AISStream API
const socket = new WebSocket('wss://stream.aisstream.io/v0/stream');

function getShipType(typeCode) {
    if (typeCode >= 70 && typeCode <= 79) return 'Cargo';
    if (typeCode >= 80 && typeCode <= 89) return 'Tanker';
    if (typeCode >= 20 && typeCode <= 24) return 'WIG';
    if (typeCode === 30) return 'Fishing';
    if (typeCode >= 31 && typeCode <= 32) return 'Towing';
    if (typeCode === 33) return 'Dredging';
    if (typeCode === 34) return 'Diving';
    if (typeCode === 35) return 'Military';
    if (typeCode === 36) return 'Sailing';
    if (typeCode === 37) return 'Pleasure';
    if (typeCode >= 40 && typeCode <= 44) return 'HSC';
    if (typeCode === 50) return 'Pilot';
    if (typeCode === 51) return 'SAR';
    if (typeCode === 52) return 'Tug';
    if (typeCode === 55) return 'Police';
    if (typeCode === 58) return 'Medical';
    if (typeCode >= 60 && typeCode <= 64) return 'Passenger';
    return 'Other';
}

// Define yellow bounding box (top left and bottom right coordinates) (visible area)
const yellowBoxBounds = {
    nw: { lat: 37.865543, lng: -122.503163 }, // Northwest (top-left)
    se: { lat: 37.813665, lng: -122.437426 }  // Southeast (bottom-right)
};

// Helper function to check if a ship's position is within the yellow box
function isWithinYellowBox(lat, lng) {
    return (
        lat <= yellowBoxBounds.nw.lat &&
        lat >= yellowBoxBounds.se.lat &&
        lng >= yellowBoxBounds.nw.lng &&
        lng <= yellowBoxBounds.se.lng
    );
}



socket.onopen = () => {
    console.log('WebSocket connection opened.');

    // Subscribe to the AISStream with the relevant bounding box
    const subscriptionMessage = {
        APIKey: 'b90d644c4476899539d3477f001fe4ee016f5feb',  
        BoundingBoxes: [[[37.856164, -122.591074], [37.748038, -122.403054]]],  // upper left lower right bridge visible area
        FilterMessageTypes: ["PositionReport", "ShipStaticData"]
    };

    socket.send(JSON.stringify(subscriptionMessage));
};

socket.onmessage = (event) => {
    const aisMessage = JSON.parse(event.data);
    console.log('Received AIS Data:', aisMessage);

    if (aisMessage.MessageType === 'PositionReport') {
        const positionReport = aisMessage.Message.PositionReport;
        const shipName = aisMessage.MetaData.ShipName ? aisMessage.MetaData.ShipName.trim() : null;

    // Only proceed if the ship has a valid name
    if (!shipName) {
        console.log('Skipping ship with undefined name');
        return;  // Skip this entry if no name
    }

        const latitude = parseFloat(positionReport.Latitude.toFixed(4)); // Should be within -90 to 90
        const longitude = parseFloat(positionReport.Longitude.toFixed(4)); // Should be within -180 to 180  
        
        console.log('Extracted Latitude: ${latitude}, Longitude: ${longitude}');

        const cog = positionReport.Cog ? positionReport.Cog.toFixed(2) : 'N/A';  // Course over Ground
        const sog = positionReport.Sog ? positionReport.Sog.toFixed(2) : 'N/A';  // Speed over Ground

        // Log the extracted Cog and Sog for debugging
        console.log('Extracted Cog: ${cog}, Sog: ${sog}')
        

        // Determine if the ship is within the yellow box and set status
        const status = isWithinYellowBox(latitude, longitude) ? 'A' : 'B';

        // Cache or update ship data
        if (!shipCache[aisMessage.MetaData.MMSI]) {
            shipCache[aisMessage.MetaData.MMSI] = {
                flight: shipName,
                latitude: latitude,
                longitude: longitude,
                cog: cog,
                sog: sog,
                length: 'Loading...',
                width: 'Loading...',
                type: shipCache[aisMessage.MetaData.MMSI]?.type || 'Unknown',  // Keep existing type if already available
                status: status
            };
        } else {
            // Update location, cog, and sog
            shipCache[aisMessage.MetaData.MMSI].latitude = latitude;
            shipCache[aisMessage.MetaData.MMSI].longitude = longitude;
            shipCache[aisMessage.MetaData.MMSI].cog = cog;
            shipCache[aisMessage.MetaData.MMSI].sog = sog;
            shipCache[aisMessage.MetaData.MMSI].status = status;
        }


        // Find existing entry in shipsData or create a new one
        const existingShipIndex = shipsData.findIndex(ship => ship.flight === shipCache[aisMessage.MetaData.MMSI].flight);
        

        const shipInfo = {
            airline: "AIS", // Placeholder, not used
            flight: shipCache[aisMessage.MetaData.MMSI].flight,
            city: shipCache[aisMessage.MetaData.MMSI].type || "Unknown", // Use "city" for ship type,//SEP17CHANGE
            gate: shipCache[aisMessage.MetaData.MMSI].type || "Unknown", // Use "gate" for ship type //TYPE
            scheduled: "", // Placeholder, not used
            status: shipCache[aisMessage.MetaData.MMSI].status, // Use updated status
            remarks: "", // Placeholder, not used
            latitude: latitude,
            longitude: longitude, 
            length: shipCache[aisMessage.MetaData.MMSI].length,
            width: shipCache[aisMessage.MetaData.MMSI].width,
            cog: shipCache[aisMessage.MetaData.MMSI].cog,
            sog: shipCache[aisMessage.MetaData.MMSI].sog,
            type: shipCache[aisMessage.MetaData.MMSI].type // Include type in the shipInfo
        };

        // Update the existing entry or add a new one
        if (existingShipIndex !== -1) {
            shipsData[existingShipIndex] = shipInfo;
        } else {
            shipsData.push(shipInfo);
        }
        console.log('Ship ${shipInfo.flight} has Latitude: ${latitude}, Longitude: ${longitude}');


        // Optional: Limit the array size to avoid memory issues
        if (shipsData.length > 100) {
            shipsData.shift();  // Remove the oldest entry
        }
    }

    if (aisMessage.MessageType === 'ShipStaticData') {
        const mmsi = aisMessage.MetaData.MMSI;
        const dimension = aisMessage.Message.ShipStaticData.Dimension;
        const typeCode = aisMessage.Message.ShipStaticData.Type;
        const shipType = getShipType(typeCode);

        console.log(`Ship Type: ${shipType}`);



        if (dimension) {
            const length = dimension.A + dimension.B;
            const width = dimension.C + dimension.D;

            console.log('Ship Length: ${length}, Width: ${width}');

            // Cache or update ship length and width
            if (shipCache[mmsi]) {
                shipCache[mmsi].length = length;
                shipCache[mmsi].width = width;
                shipCache[mmsi].type = shipType;

            } else {
                shipCache[mmsi] = {
                    length: length,
                    width: width,
                    type: shipType,
                };
            }
            // Update shipsData array to reflect the new ship type in existing entries
            shipsData = shipsData.map((ship) => {
                if (ship.flight === shipCache[mmsi].flight) {
                    ship.type = shipType;
                    ship.length = length;
                    ship.width = width;
                }
                return ship;
            });
        }
    }
};

socket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};

// API route to serve AIS data directly
app.get('/api/arrivals', (req, res) => {
    console.log('Sending shipsData:', shipsData); // Log the data before responding
    res.json({ data: shipsData });
});


app.listen(port, () => {
    console.log('split flap started on port ' + port);
});

app.get('/api/shipcache', (req, res) => {
    res.json(shipCache);
});

// =============================================================================
// Plane stuff
// =============================================================================

const axios = require('axios');

// OpenSky Bounding Box
const openskyBoundingBox = {

    nw: { lat: 37.900682, lng: -122.872432 }, // Northwest (top-left)
    se: { lat: 37.578706, lng: -122.240619 }  // Southeast (bottom-right)
};

// Function to fetch plane data from OpenSky API
async function fetchPlaneData() {
    const url = `https://opensky-network.org/api/states/all?lamin=${openskyBoundingBox.se.lat}&lomin=${openskyBoundingBox.nw.lng}&lamax=${openskyBoundingBox.nw.lat}&lomax=${openskyBoundingBox.se.lng}&extended=1`;
    try {
        const response = await axios.get(url, {
            auth: {
                username: 'catx123x',
                password: 'sednyk-0hamtu-jyvbYv'
            }
        });
        console.log('OpenSky API raw response:', response.data);
        return response.data.states;
    } catch (error) {
        console.error('Error fetching plane data:', error);
        return [];
    }
}


const aircraftCategoryMap = {
    0: "Unknown",
    1: "Unknown",
    2: "Light",
    3: "Small",
    4: "Large",
    5: "High Vortex Large",
    6: "Heavy",
    7: "High Performance",
    8: "Rotorcraft",
    9: "Glider",
    10: "Lighter-than-air",
    11: "Skydiver",
    12: "Ultralight",
    13: "Unknown",
    14: "UAV",
    15: "Spacecraft",
    16: "Emergency",
    17: "Surface",
    18: "Obstacle",
    19: "Obstacle",
    20: "Obstacle"
};

const airlineMap = require('./cleanedAirlineMap');  // Use the cleaned airline map

// API route to serve plane data
// API route to serve plane data
app.get('/api/planes', async (req, res) => {
    const planesData = await fetchPlaneData();
    const formattedPlanes = planesData.map((plane) => {
        const flightCode = plane[1] || "Unknown";
        const airlinePrefix = flightCode.trim().slice(0, 3); // Extract the first three characters
        const airline = airlineMap[airlinePrefix] || "Unknown Airline"; // Lookup in airlineMap

        // Barometric altitude
        const altitude = plane[7] ? plane[7].toFixed(2) : 'N/A';  // Barometric altitude in meters

        return {
            flight: flightCode,
            latitude: plane[6],
            longitude: plane[5],
            cog: plane[10] ? plane[10].toFixed(2) : 'N/A',
            sog: plane[9] ? (plane[9] * 1.94384).toFixed(2) : 'N/A',
            type: aircraftCategoryMap[plane[8]] || "Unknown",
            airline: airline,  // Use airline from the airlineMap
            altitude: altitude // Include altitude in the response
        };
    });
    res.json({ data: formattedPlanes });
});

