const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = process.env.PORT || 8080;

// Store ships currently in the bounding box
let shipsData = [];
let shipCache = {}; // Cache to store ship data

app.use('/', express.static('public'));

// WebSocket setup to connect to AISStream API
let socket = new WebSocket('wss://stream.aisstream.io/v0/stream');

// Default bounding box coordinates
let boundingBox = null; // Set initially to null

// Helper function to check if a ship's position is within the bounding box
function isWithinBoundingBox(lat, lng) {
    if (!boundingBox) {
        console.error('Bounding box not set!');
        return false;
    }

    const withinBox = (
        lat <= boundingBox.nw.lat &&
        lat >= boundingBox.se.lat &&
        lng >= boundingBox.nw.lng &&
        lng <= boundingBox.se.lng
    );
    console.log(`Checking position (${lat}, ${lng}) against bounding box.`);
    console.log(`Bounding Box NW: ${boundingBox.nw.lat}, ${boundingBox.nw.lng}`);
    console.log(`Bounding Box SE: ${boundingBox.se.lat}, ${boundingBox.se.lng}`);
    console.log(`Within bounding box: ${withinBox}`);
    return withinBox;
}

// Function to subscribe to AISStream with the current bounding box
function subscribeToAIS(socket) {
    if (!boundingBox) {
        console.error("Cannot subscribe to AIS: Bounding box is not set.");
        return;
    }

    const subscriptionMessage = {
        APIKey: 'b90d644c4476899539d3477f001fe4ee016f5feb',
        BoundingBoxes: [[[boundingBox.nw.lat, boundingBox.nw.lng], [boundingBox.se.lat, boundingBox.se.lng]]],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"]
    };

    console.log("Subscribing to AIS with message:", JSON.stringify(subscriptionMessage, null, 2));
    socket.send(JSON.stringify(subscriptionMessage));
}

// Function to handle AIS messages
function handleAISMessage(event) {
    try {
        const aisMessage = JSON.parse(event.data);
        console.log('Received AIS Message:', aisMessage);

        if (aisMessage.MessageType === 'PositionReport') {
            const positionReport = aisMessage.Message.PositionReport;
            const shipName = aisMessage.MetaData.ShipName?.trim();

            if (!shipName) {
                console.log('Skipping ship with undefined name');
                return;
            }

            const latitude = positionReport.Latitude;
            const longitude = positionReport.Longitude;

            console.log(`Ship: ${shipName}, Position: (${latitude}, ${longitude})`);

            if (isWithinBoundingBox(latitude, longitude)) {
                console.log(`Ship ${shipName} is within the bounding box.`);

                const shipData = {
                    flight: shipName,
                    latitude,
                    longitude,
                    cog: positionReport.Cog || 'N/A',
                    sog: positionReport.Sog || 'N/A',
                };

                // Update shipsData array
                const existingIndex = shipsData.findIndex(ship => ship.flight === shipName);
                if (existingIndex !== -1) {
                    shipsData[existingIndex] = shipData; // Update existing entry
                } else {
                    shipsData.push(shipData); // Add new entry
                }

                console.log('Updated shipsData:', shipsData);
            } else {
                console.log(`Ship ${shipName} is outside the bounding box.`);
            }
        }
    } catch (error) {
        console.error('Error processing AIS message:', error);
    }
}

// WebSocket event handlers
socket.onopen = () => {
    console.log('WebSocket connection opened.');
    subscribeToAIS(socket); // Subscribe when the WebSocket opens
};

socket.onmessage = (event) => {
    console.log("Raw AIS Message:", event.data); // Log raw message from the server
    handleAISMessage(event);
};

socket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);

    // Attempt to reconnect
    setTimeout(() => {
        console.log('Reconnecting WebSocket...');
        socket = new WebSocket('wss://stream.aisstream.io/v0/stream');
        socket.onopen = () => {
            console.log('WebSocket reconnected.');
            subscribeToAIS(socket); // Re-subscribe with the current bounding box
        };
        socket.onmessage = (event) => {
            console.log("Raw AIS Message (after reconnect):", event.data);
            handleAISMessage(event);
        };
    }, 5000); // Reconnect after 5 seconds
};

socket.onerror = (error) => {
    console.error("WebSocket error:", error);
};

// API route to serve AIS data directly
app.get('/api/arrivals', (req, res) => {
    console.log('Sending shipsData:', shipsData);
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
