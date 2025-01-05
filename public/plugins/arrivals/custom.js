window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error('Global error:', {
      message: msg,
      url: url,
      lineNo: lineNo,
      columnNo: columnNo,
      error: error
  });
  return false;
};

sf.plugins.arrivals = {
  dataType: 'json',

  url: function(options) {
    return 'api/arrivals';
  },

  formatData: function(response) {
    return response.data;
  }
};

var map;
// MAP
// Define shipMarkers outside the event handler
var shipMarkers = {};
var shipData = {};
// Add these at the global level with your other variables
var shipTrails = {};
var shipPositions = {}; // Store array of positions for each ship
const MAX_TRAIL_LENGTH = 20; // Maximum number of positions to keep
let loadingTimeout = null;
const LOADING_TIMEOUT_DURATION = 90000; // 90 seconds


let initialDataReceived = false; // for loading screen

function showNoDataMessage() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const loadingMessage = document.getElementById('loadingMessage');
    const noDataMessage = document.getElementById('noDataMessage');
    if (loadingSpinner && loadingMessage && noDataMessage) {
        loadingSpinner.style.display = 'none';
        loadingMessage.style.display = 'none';
        noDataMessage.style.display = 'flex';
    }
}

function resetLoadingMessage() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const loadingMessage = document.getElementById('loadingMessage');
    const noDataMessage = document.getElementById('noDataMessage');
    if (loadingSpinner && loadingMessage && noDataMessage) {
        loadingSpinner.style.display = 'block';
        loadingMessage.style.display = 'flex';
        noDataMessage.style.display = 'none';
    }
}

function startLoadingTimeout() {
    // Clear any existing timeout
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
    }
    
    // Set new timeout
    loadingTimeout = setTimeout(() => {
        if (!initialDataReceived) {
            showNoDataMessage();
        }
    }, LOADING_TIMEOUT_DURATION);
}

function clearLoadingTimeout() {
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
}

function clearAllMarkers() {
    for (let shipName in shipMarkers) {
        if (shipMarkers[shipName]) {
            map.removeLayer(shipMarkers[shipName]);
            delete shipMarkers[shipName];
        }
    }
}

document.addEventListener("DOMContentLoaded", function() {
  console.log('DOM Content Loaded - Starting initialization');

    // Access the bounding box coordinates from the global `window.boundingBox`
    var boundingBox = window.boundingBox;
    var neLat = boundingBox ? parseFloat(boundingBox.neLat) : null;
    var neLng = boundingBox ? parseFloat(boundingBox.neLng) : null;
    var swLat = boundingBox ? parseFloat(boundingBox.swLat) : null;
    var swLng = boundingBox ? parseFloat(boundingBox.swLng) : null;

    // Calculate the center of the bounding box
    var centerLat = (neLat + swLat) / 2;
    var centerLng = (neLng + swLng) / 2;

  // Initialize the map
 map = L.map('map', {
    center: [centerLat, centerLng],  // Center the map using the midpoint
    zoom: 13,
    zoomControl: false,  // Disable the default zoom controls
    attributionControl: false  // Disable the attribution control

  });
  // Set up the dark mode map tiles

  const darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 40
    });

  // Add the dark mode tile layer to the map
  darkTileLayer.addTo(map);

      // Draw the yellow bounding box
   // const bounds = [[37.865543, -122.503163], [37.813665, -122.437426]];  // Upper left and lower right coordinates
   // const boundingBox = L.rectangle(bounds, { color: "#FFFF00", weight: 2 }).addTo(map);  // Yellow box with stroke weight of 2

   // boundingBox.bindPopup("Tracking Area");

      // Draw the blue bounding box
   // const blueBounds = [[37.856164, -122.591074], [37.748038, -122.403054]];  // Upper left and lower right coordinates for blue box
   // const blueBoundingBox = L.rectangle(blueBounds, { color: "#0000FF", weight: 2 }).addTo(map);  // Blue box
   // blueBoundingBox.bindPopup("Blue Tracking Area");

  // If bounding box coordinates are available, draw the bounding box on the map
  if (neLat && neLng && swLat && swLng) {
    initialDataReceived = false;
    try {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            resetLoadingMessage(); // Reset to initial loading message
            startLoadingTimeout(); // Start the timeout
        }
    } catch (error) {
        console.error('Error showing loading overlay:', error);
    }
    
    const bounds = [[swLat, swLng], [neLat, neLng]];
    boundingBoxLayer = L.rectangle(bounds, { color: "#FFFF00", weight: 2 }).addTo(map);
    boundingBoxLayer.bindPopup("Selected Tracking Area");
    map.fitBounds(bounds);
}

  // Debug map initialization
  console.log('Map container:', document.getElementById('map'));
  console.log('Initial map object:', map);

  // Function to update the map with ship data
  function updateMap(shipsData) {
    console.log('Starting map update with:', shipsData);
    if (!initialDataReceived && shipsData.length > 0) {
        initialDataReceived = true;
        clearLoadingTimeout(); // Clear the timeout since we got data
        try {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        } catch (error) {
            console.error('Error hiding loading overlay:', error);
        }
    }
    // Track which ships are still active
    const activeShips = new Set();
    
    shipsData.forEach(function(ship) {
        if (!ship.flight) {
            console.warn('Skipping ship with undefined name:', ship);
            return;
        }
        const latitude = parseFloat(ship.latitude);
        const longitude = parseFloat(ship.longitude);
        activeShips.add(ship.flight);
    
        if (!isNaN(latitude) && !isNaN(longitude)) {
            try {
                // Add trail tracking here
                if (ship.positionHistory && ship.positionHistory.length > 0) {
                    shipPositions[ship.flight] = ship.positionHistory.map(pos => [pos.lat, pos.lng]);
                }
                shipPositions[ship.flight].push([latitude, longitude]);
                if (shipPositions[ship.flight].length > MAX_TRAIL_LENGTH) {
                    shipPositions[ship.flight].shift();
                }
    
                // Create or update trail
                // Inside your updateMap function, where you create/update trails
                if (shipPositions[ship.flight].length > 1) {
                    if (!shipTrails[ship.flight]) {
                        // Create line trail
                        const trail = L.polyline(shipPositions[ship.flight], {
                            color: '#4BC0C0',
                            weight: 2,
                            opacity: 0.6
                        }).addTo(map);
        
                        // Add dots at each position
                        const dots = shipPositions[ship.flight].map(pos => 
                            L.circleMarker(pos, {
                                radius: 3,
                                fillColor:'#4BC0C0',
                                fillOpacity: 0.8,
                                stroke: false
                            }).addTo(map)
                        );
        
                        shipTrails[ship.flight] = {
                            line: trail,
                            dots: dots
                        };
                    } else {
                        // Update existing trail
                        shipTrails[ship.flight].line.setLatLngs(shipPositions[ship.flight]);
        
                        // Remove old dots
                        shipTrails[ship.flight].dots.forEach(dot => map.removeLayer(dot));
        
                        // Create new dots
                        shipTrails[ship.flight].dots = shipPositions[ship.flight].map(pos => 
                            L.circleMarker(pos, {
                                radius: 3,
                                fillColor: ship.length > 100 ? '#FF6B6B' : '#4BC0C0',
                                fillOpacity: 0.8,
                                stroke: false
                            }).addTo(map)
                        );
                    }
                }
    
                // Your existing marker code stays exactly the same
                let iconPath = 'img/boat_top.png';
                if (ship.length && parseFloat(ship.length) > 100) {
                    iconPath = 'img/big_cargo.png';
                }
                const shipIcon = L.icon({
                    iconUrl: iconPath,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                    popupAnchor: [0, -16]
                });
                if (!shipMarkers[ship.flight]) {
                    // Create new marker if it doesn't exist
                    console.log(`Creating new marker for ${ship.flight}`);
                    const marker = new L.Marker([latitude, longitude], {icon: shipIcon});
                    marker.bindPopup(createPopupContent(ship));
                    marker.on('mouseover', function() { this.openPopup(); });
                    marker.on('mouseout', function() { this.closePopup(); });
                    marker.addTo(map);
                    shipMarkers[ship.flight] = marker;
                } else {
                    // Update existing marker
                    const marker = shipMarkers[ship.flight];
                    marker.setIcon(shipIcon);
                    marker.setLatLng([latitude, longitude]);
                    marker.setPopupContent(createPopupContent(ship));
                }
                if (ship.cog) {
                    shipMarkers[ship.flight].setRotationAngle(parseFloat(ship.cog));
                }
            } catch (error) {
                console.error(`Error handling ship ${ship.flight}:`, error);
            }
        }
    });
    
// At the end of updateMap, replace the current cleanup with:
Object.keys(shipMarkers).forEach(shipName => {
    if (!activeShips.has(shipName)) {
        map.removeLayer(shipMarkers[shipName]);
        map.removeLayer(shipTrails[shipName]);
        shipTrails[shipName].dots.forEach(dot => map.removeLayer(dot));
        delete shipMarkers[shipName];
        delete shipTrails[shipName];
        // Don't delete position history - keep it for when ship returns
        // delete shipPositions[shipName];
    }
});
}

// Helper function to create popup content
function createPopupContent(ship) {
    return `
    <div style="padding: 10px;">
        <h4 style="margin: 0 0 5px 0;">${ship.flight}</h4>
        <p style="margin: 5px 0;">Type: ${ship.type || 'Unknown'}</p>
        <p style="margin: 5px 0;">Length: ${ship.length || 'N/A'} m</p>
        <p style="margin: 5px 0;">Width: ${ship.width || 'N/A'} m</p>
        <p style="margin: 5px 0;">Speed: ${ship.sog !== 'N/A' ? `${ship.sog} knots` : 'N/A'}</p>
    </div>
    `;
}


  // Fetch and update ship data
  function fetchShipData() {
    console.log('Attempting to fetch ship data');
    $.getJSON('/api/arrivals', function(response) {
        console.log('Received API response:', response);
        if (response && response.data) {
            console.log('Found data in response:', response.data);
            const ships = Array.isArray(response.data) ? response.data : [response.data];
            console.log('About to process ships:', ships);
            updateMap(ships);
        } else {
            console.error('No data property in response:', response);
        }
    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.error('API request failed:', {
            status: jqXHR.status,
            textStatus: textStatus,
            error: errorThrown
        });
    });
}

  // Fetch the ship data initially
  fetchShipData();

  // Optionally set an interval to refresh the data periodically
  setInterval(fetchShipData, 5000); // Refresh every half second
});

//=============================================================
// TOGGLE LOGIC
//=============================================================
/*
var showingPlanes = false; // Track whether planes or ships are being shown

function toggleDashboard() {
    const isShowingAir = document.getElementById('air').checked;

    // Update the data source URL and fetch the correct data
    const dataUrl = isShowingAir ? '/api/planes' : '/api/arrivals';
    fetchDashboardData(dataUrl);  // Fetch data from the correct endpoint

    // Update the split-flap plugin and reload it with new data
    sf.options.plugin = isShowingAir ? 'planes' : 'arrivals';  // Update the plugin based on the toggle
    sf.board.clear();  // Clear the current board content
    sf.items.load(sf.options);  // Load the new data into the board

    // Dynamically change the headings based on the toggle
    const headerContainer = document.getElementById('dashboardHeader');
    if (isShowingAir) {
        headerContainer.innerHTML = `
            <div class="header" style="width: 780px; text-align: left">Flight Number</div>
            <div class="header" style="width: 380px; text-align: left">Airline</div>
            <div class="header" style="width: 210px; text-align: left">Type</div>
            <div class="header" style="width: 210px; text-align: left">Country</div>
        `;
    } else {
        headerContainer.innerHTML = `
            <div class="header" style="width: 780px; text-align: left">Vessel Name</div>
            <div class="header" style="width: 380px; text-align: left">Type</div>
            <div class="header" style="width: 210px; text-align: left">Status</div> <!-- Red/Green light for ships -->
        `;
    }
}


// ===========================================================
// Plane Stuff
// ===========================================================
// Global object to track plane markers by flight
// Global object to track plane markers by flight// Global object to track plane markers by flight
// Global object to track plane markers by flight
/*
const planeMarkers = {};
function updateMapWithPlanes(planesData) {
  planesData.forEach(function(plane) {
      const latitude = parseFloat(plane.latitude);
      const longitude = parseFloat(plane.longitude);
      const cog = plane.cog ? parseFloat(plane.cog) : null;  // Course over Ground
      const altitude = plane.altitude || 'N/A';  // Fetch the altitude

      console.log(`Plane ${plane.flight} -> Latitude: ${latitude}, Longitude: ${longitude}, Cog: ${cog}, Altitude: ${altitude}`);

      // Check if latitude and longitude are valid numbers
      if (!isNaN(latitude) && !isNaN(longitude)) {
          // Check if the plane already has a marker
          if (planeMarkers[plane.flight]) {
              // Update the existing marker's position
              planeMarkers[plane.flight].setLatLng([latitude, longitude]);

              // If Cog is available, rotate the marker
              if (cog !== null) {
                  planeMarkers[plane.flight].setRotationAngle(cog);
              }
              console.log(`Updated marker for plane ${plane.flight}`);
          } else {
              // Create a new marker if one doesn't exist
              const planeIcon = L.icon({
                  iconUrl: 'img/plane_icon.png',  // Path to your plane icon
                  iconSize: [30, 30], // Adjust size as needed
                  iconAnchor: [15, 15],
                  popupAnchor: [0, -15]
              });

              // Create a new marker and add it to the map
              const marker = L.marker([latitude, longitude], { icon: planeIcon }).addTo(map);

              // If Cog is available, rotate the marker
              if (cog !== null) {
                  marker.setRotationAngle(cog);
              }

              console.log(`Marker created for plane ${plane.flight}`);

              const popupContent = `<b>${plane.flight}</b>
              <br>Airline: ${plane.airline}
              <br>Speed: ${plane.sog || 'N/A'} knots
              <br>Altitude (baro): ${altitude} m  <!-- Add altitude to popup -->
              <br>Type: ${plane.type || 'Unknown'}
              `;
              
              marker.bindPopup(popupContent);

              // Store the marker in the global object
              planeMarkers[plane.flight] = marker;

              // Optional hover behavior to show popup
              marker.on('mouseover', function () {
                  this.openPopup();
              });
              marker.on('mouseout', function () {
                  this.closePopup();
              });
          }
      } else {
          console.error(`Invalid coordinates for plane: ${plane.flight}`);
      }
  });
}


// Fetch and update plane data
function fetchPlaneData() {
  $.getJSON('/api/planes', function(response) {
    console.log('API Response:', response); // Log entire response
    if (response && response.data) {
        console.log('Fetched planesData:', response.data);
        updateMapWithPlanes(response.data);
    } else {
        console.error('No data received from planes API');
    }
 }).fail(function(jqXHR, textStatus, errorThrown) {
    console.error('Failed to load plane data from API:', textStatus, errorThrown);
 });
 
}


// Fetch the plane data periodically
setInterval(fetchPlaneData, 120000); // Refresh plane data every 10 seconds

// ===================================================
// PLANE DASHBOARD TOGGLE
// ===================================================

sf.plugins.planes = {
  dataType: 'json',

  url: function(options) {
    return '/api/planes';  // Fetch from the planes API
  },

  formatData: function(response) {
    // Extract only the flight numbers for now
    return response.data.map(plane => ({
      flight: plane.flight || 'Unknown Flight'  // Fallback if flight number is missing
    }));
  }
};
*/