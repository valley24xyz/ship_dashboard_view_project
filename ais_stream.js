const WebSocket = require('ws');
const fs = require('fs'); //filesystem to generate json in split flap folder
const path = require('path'); // path to generate json in split flap folder

const apiKey = 'b90d644c4476899539d3477f001fe4ee016f5feb'; 

// Absolute path to save the JSON file in the "split-flap-v4/Split-Flap" folder
const jsonFilePath = path.join('/Users/catherineorman/split_flap_v4/Split-Flap/data.json');

// Store ships currently in the bounding box
let shipsData = [];

const socket = new WebSocket('wss://stream.aisstream.io/v0/stream');

socket.onopen = () => {
    console.log('WebSocket connection opened.');

    // Create a subscription message
    const subscriptionMessage = {
        APIKey: apiKey,
        BoundingBoxes: [[[37.829167, -122.591556], [37.746429, -122.341326]]],  // upper left lower right bridge visible area
        FilterMessageTypes: ["PositionReport"]  // Optional: Filter by message type
    };

    // Send the subscription message
    socket.send(JSON.stringify(subscriptionMessage));
    console.log('Subscription message sent.');
};

socket.onmessage = (event) => {
    const aisMessage = JSON.parse(event.data);
    console.log('Received AIS Data:', aisMessage);
    
    if (aisMessage.MessageType === 'PositionReport') {
        const positionReport = aisMessage.Message.PositionReport;
        const shipMMSI = aisMessage.MetaData.MMSI;
        const shipName = aisMessage.MetaData.ShipName.trim();
        const latitude = positionReport.Latitude.toFixed(4); // Format to 4 decimal places
        const longitude = positionReport.Longitude.toFixed(4); // Format to 4 decimal places

        // Find the ship in the current data or create a new entry
        const shipIndex = shipsData.findIndex(ship => ship.mmsi === shipMMSI);

        const shipInfo = {
            airline: "AIS", // Placeholder, not used
            flight: shipName,
            city: latitude,
            gate: longitude,
            scheduled: "", // Placeholder, not used
            status: "", // Placeholder, not used
            remarks: "" // Placeholder, not used
        };

        if (shipIndex >= 0) {
            // Update existing ship data
            shipsData[shipIndex] = shipInfo;
        } else {
            // Add new ship data
            shipsData.push(shipInfo);
        }

        // Write updated shipsData to the JSON file
        fs.writeFileSync(jsonFilePath, JSON.stringify(shipsData, null, 2));
        console.log(`Updated JSON with: ${shipName}, Lat: ${latitude}, Lon: ${longitude}`);
    }
};

socket.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};

