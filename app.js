const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = process.env.PORT || 8080;

// Store ships currently in the bounding box
let shipsData = [];
let shipCache = {}; // Cache to store ship data
let socket = null; // Initialize socket as null
let boundingBox = null; // Set initially to null

app.use('/', express.static('public'));

// Helper function to check if a ship's position is within the bounding box
function isWithinBoundingBox(lat, lng) {
    if (!boundingBox) {
        console.error('Bounding box not set!');
        return false;
    }

    const latCheck = (lat <= boundingBox.nw.lat && lat >= boundingBox.se.lat);
    const lngCheck = (lng >= boundingBox.nw.lng && lng <= boundingBox.se.lng);

    console.log('Coordinate checks:');
    console.log(`Latitude (${lat}): ${boundingBox.nw.lat} >= lat >= ${boundingBox.se.lat} : ${latCheck}`);
    console.log(`Longitude (${lng}): ${boundingBox.nw.lng} <= lng <= ${boundingBox.se.lng} : ${lngCheck}`);

    const withinBox = latCheck && lngCheck;
    console.log(`Final result - Within bounding box: ${withinBox}`);
    
    return withinBox;
}


// Function to subscribe to AISStream with the current bounding box
function subscribeToAIS(socket) {
    if (!boundingBox || !socket) {
        console.error("Cannot subscribe to AIS: Bounding box not set or socket not connected");
        return;
    }

    if (socket.readyState !== WebSocket.OPEN) {
        console.error("Cannot subscribe to AIS: WebSocket not open");
        return;
    }

    const subscriptionMessage = {
        APIKey: 'b90d644c4476899539d3477f001fe4ee016f5feb',
        BoundingBoxes: [[[boundingBox.nw.lat, boundingBox.nw.lng], [boundingBox.se.lat, boundingBox.se.lng]]],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"]
    };

    console.log("Subscribing to AIS with message:", JSON.stringify(subscriptionMessage, null, 2));
    try {
        socket.send(JSON.stringify(subscriptionMessage));
        console.log("Subscription message sent successfully");
    } catch (error) {
        console.error("Error sending subscription message:", error);
    }
}

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

// Function to handle AIS messages
function handleAISMessage(event) {
    try {
        const aisMessage = JSON.parse(event.data);
        console.log('Message Type:', aisMessage.MessageType);
        
        if (aisMessage.MessageType === 'PositionReport') {
            const positionReport = aisMessage.Message.PositionReport;
            console.log('Raw Position Report:', positionReport);
            
            console.log('MetaData:', aisMessage.MetaData);
            console.log('Position:', {
                latitude: positionReport.Latitude,
                longitude: positionReport.Longitude
            });

            const shipName = aisMessage.MetaData.ShipName?.trim();

            if (!shipName) {
                console.log('Skipping ship with undefined name');
                return;
            }

            const latitude = positionReport.Latitude;
            const longitude = positionReport.Longitude;

            console.log('About to check bounding box for:', {
                shipName,
                latitude,
                longitude,
                boundingBox
            });

            if (isWithinBoundingBox(latitude, longitude)) {
                console.log(`Ship ${shipName} is within the bounding box.`);

                const shipData = {
                    flight: shipName,
                    latitude,
                    longitude,
                    cog: positionReport.Cog || 'N/A',
                    sog: positionReport.Sog || 'N/A',
                    // Add these fields for the split-flap display
                    city: shipCache[aisMessage.MetaData.MMSI]?.type || 'Loading...',  // This is used for the Type column
                    gate: shipCache[aisMessage.MetaData.MMSI]?.type || 'Loading...',  // Backup field
                    airline: "AIS",  // Required by split-flap but not displayed
                    scheduled: "",   // Required by split-flap but not displayed
                    status: (positionReport.Sog && positionReport.Sog > 0) ? "A" : "B",
                    remarks: "",     // Required by split-flap but not displayed
                    // Keep the rest of your fields
                    length: shipCache[aisMessage.MetaData.MMSI]?.length || 'N/A',
                    width: shipCache[aisMessage.MetaData.MMSI]?.width || 'N/A',
                    type: shipCache[aisMessage.MetaData.MMSI]?.type || 'Loading...'
                };

                const existingIndex = shipsData.findIndex(ship => ship.flight === shipName);
                if (existingIndex !== -1) {
                    shipsData[existingIndex] = { 
                        ...shipsData[existingIndex], 
                        ...shipData 
                    }; // Update while preserving existing data
                } else {
                    shipsData.push(shipData);
                }

                console.log('Updated shipsData:', shipsData);
            } else {
                console.log(`Ship ${shipName} is outside the bounding box.`);
            }
        } else if (aisMessage.MessageType === 'ShipStaticData') {
            const staticData = aisMessage.Message.ShipStaticData;
            const shipName = aisMessage.MetaData.ShipName?.trim();
    
            if (shipName) {
                const typeCode = staticData.Type;
                const dimension = staticData.Dimension;
                const length = dimension ? (dimension.A + dimension.B) : 'N/A';
                const width = dimension ? (dimension.C + dimension.D) : 'N/A';
                
                // Update cache
                shipCache[aisMessage.MetaData.MMSI] = {
                    ...shipCache[aisMessage.MetaData.MMSI],
                    length: length,
                    width: width,
                    type: getShipType(typeCode)
                };
    
                // Update existing ship in shipsData if it exists
                const existingIndex = shipsData.findIndex(ship => ship.flight === shipName);
                if (existingIndex !== -1) {
                    shipsData[existingIndex] = {
                        ...shipsData[existingIndex],
                        length: length,
                        width: width,
                        type: getShipType(typeCode)
                    };
                }
                console.log(`Updated static data for ${shipName}: Type=${getShipType(typeCode)}, Length=${length}, Width=${width}`);
            }
        }
    } catch (error) {
        console.error('Error processing AIS message:', error);
    }
}

function initializeWebSocket() {
    socket = new WebSocket('wss://stream.aisstream.io/v0/stream');

    socket.onopen = () => {
        console.log('WebSocket connection opened.');
        if (boundingBox) {
            subscribeToAIS(socket);
        }
    };

    socket.onmessage = (event) => {
        console.log("Raw AIS Message:", event.data);
        const message = JSON.parse(event.data);
        if (message.MessageType === 'SubscriptionSuccess') {
            console.log('Successfully subscribed to AIS feed');
        } else if (message.MessageType === 'SubscriptionFailed') {
            console.error('Failed to subscribe to AIS feed:', message);
        }
        handleAISMessage(event);
    };

    socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setTimeout(initializeWebSocket, 5000);
    };

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };
}

// Initialize the WebSocket when the server starts
initializeWebSocket();


// API route to serve AIS data directly
app.get('/api/arrivals', (req, res) => {
    console.log('Sending shipsData:', JSON.stringify(shipsData, null, 2));
    res.json({ data: shipsData });
});

// API route to update bounding box dynamically
app.get('/api/setBoundingBox', (req, res) => {
    const { neLat, neLng, swLat, swLng } = req.query;

    // Correct the bounding box interpretation
    boundingBox = {
        nw: { lat: parseFloat(neLat), lng: parseFloat(swLng) }, // Northwest (top-left) = neLat + swLng
        se: { lat: parseFloat(swLat), lng: parseFloat(neLng) }  // Southeast (bottom-right) = swLat + neLng
    };

    console.log('Updated bounding box:', boundingBox);

    // Re-subscribe to AIS with the corrected bounding box
    subscribeToAIS(socket);
    res.json({ success: true, boundingBox });
});

// Add this to your existing app.js routes
app.get('/api/resubscribe', (req, res) => {
    try {
        if (boundingBox) {
            subscribeToAIS(socket);
            res.json({ success: true, message: 'Resubscribed to AIS' });
        } else {
            res.status(400).json({ success: false, message: 'Bounding box not set' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.toString() });
    }
});

// Start the server
app.listen(port, () => {
    console.log('split flap started on port ' + port);
});


// =============================================================================
// Plane stuff
// =============================================================================
/*
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
*/
