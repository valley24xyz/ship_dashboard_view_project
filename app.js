const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = process.env.PORT || 8080;


// Store ships currently in the bounding box
let shipsData = [];
let shipCache = {}; 
let socket = null; 
let boundingBox = null; 
const SHIP_TIMEOUT = 60000; 

app.use('/', express.static('public'));

function updateShipTimestamp(shipName) {
    if (!shipCache[shipName]) {
        shipCache[shipName] = {};
    }
    shipCache[shipName].lastSeen = Date.now();
}

function cleanupStaleShips() {
    const now = Date.now();
    shipsData = shipsData.filter(ship => {
        const shipTimestamp = shipCache[ship.flight]?.lastSeen || 0;
        return (now - shipTimestamp) < SHIP_TIMEOUT;
    });
}

// check if a ship's position is within the bounding box
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


// subscribe to AISStream with the current bounding box
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

// handle AIS messages
function handleAISMessage(event) {
    try {
        const aisMessage = JSON.parse(event.data);
        console.log('Message Type:', aisMessage.MessageType);
        
        if (aisMessage.MessageType === 'PositionReport') {
            const positionReport = aisMessage.Message.PositionReport;
            console.log('Raw Position Report:', positionReport);

            console.log('New position for', aisMessage.MetaData.ShipName, ':', {
                latitude: positionReport.Latitude,
                longitude: positionReport.Longitude
            });
            
            console.log('MetaData:', aisMessage.MetaData);
            console.log('Position:', {
                latitude: positionReport.Latitude,
                longitude: positionReport.Longitude
            });

            const shipName = aisMessage.MetaData.ShipName?.trim();

            if (shipName) {
                const existingShip = shipsData.find(ship => ship.flight === shipName);
                if (existingShip) {
                    console.log(`Position update for ${shipName}:`);
                    console.log(`  Old position: [${existingShip.latitude}, ${existingShip.longitude}]`);
                    console.log(`  New position: [${positionReport.Latitude}, ${positionReport.Longitude}]`);
                    console.log(`  Speed: ${positionReport.Sog} knots`);
                }
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
                updateShipTimestamp(shipName);  // Add this line
                const shipData = {
                    flight: shipName,
                    latitude,
                    longitude,
                    cog: positionReport.Cog || 'N/A',
                    sog: positionReport.Sog || 'N/A',
                    city: shipCache[aisMessage.MetaData.MMSI]?.type || 'Loading...', 
                    gate: shipCache[aisMessage.MetaData.MMSI]?.type || 'Loading...', 
                    airline: "AIS", 
                    scheduled: "",  
                    status: (positionReport.Sog && positionReport.Sog > 0) ? "A" : "B",
                    remarks: "",     
                    length: shipCache[aisMessage.MetaData.MMSI]?.length || 'N/A',
                    width: shipCache[aisMessage.MetaData.MMSI]?.width || 'N/A',
                    type: shipCache[aisMessage.MetaData.MMSI]?.type || 'Loading...',
                    lastUpdate: Date.now()
                };

                const existingIndex = shipsData.findIndex(ship => ship.flight === shipName);
                if (existingIndex !== -1) {
                    shipsData[existingIndex] = { 
                        ...shipsData[existingIndex], 
                        ...shipData 
                    };
                } else {
                    shipsData.push(shipData);
                }
                console.log('Updated shipsData:', shipsData);
            } else {
                console.log(`Ship ${shipName} is outside the bounding box.`);
                const existingIndex = shipsData.findIndex(ship => ship.flight === shipName);
            }
        } else if (aisMessage.MessageType === 'ShipStaticData') {
            const staticData = aisMessage.Message.ShipStaticData;
            const shipName = aisMessage.MetaData.ShipName?.trim();
    
            if (shipName) {
                const typeCode = staticData.Type;
                const dimension = staticData.Dimension;
                const length = dimension ? (dimension.A + dimension.B) : 'N/A';
                const width = dimension ? (dimension.C + dimension.D) : 'N/A';
                
                shipCache[aisMessage.MetaData.MMSI] = {
                    ...shipCache[aisMessage.MetaData.MMSI],
                    length: length,
                    width: width,
                    type: getShipType(typeCode)
                };
    
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
setInterval(cleanupStaleShips, 10000); 

initializeWebSocket();
app.get('/api/arrivals', (req, res) => {
    cleanupStaleShips();
    res.json({ data: shipsData });
});

app.get('/api/setBoundingBox', (req, res) => {
    const { neLat, neLng, swLat, swLng } = req.query;
    boundingBox = {
        nw: { lat: parseFloat(neLat), lng: parseFloat(swLng) },
        se: { lat: parseFloat(swLat), lng: parseFloat(neLng) }
    };

    console.log('Updated bounding box:', boundingBox);
    subscribeToAIS(socket);
    res.json({ success: true, boundingBox });
});

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

app.listen(port, () => {
    console.log('split flap started on port ' + port);
});
