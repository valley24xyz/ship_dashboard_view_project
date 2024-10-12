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
document.addEventListener("DOMContentLoaded", function() {
  // Initialize the map
 map = L.map('map', {
    center: [37.8199, -122.4783],  // Coordinates for Golden Gate Bridge
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

    // Add the HQ icon at the specified coordinates
    const hqIcon = L.icon({
      iconUrl: 'img/hq_icon.png', // Path to your HQ icon
      iconSize: [40, 40], // Size of the icon
      iconAnchor: [20, 20], // Point of the icon which will correspond to the marker's location
      popupAnchor: [0, -20] // Point from which the popup should open relative to the iconAnchor
    });
  
    const hqMarker = L.marker([37.799003, -122.420737], { icon: hqIcon }).addTo(map);
  
    // Optionally, add a popup to the HQ marker
    hqMarker.bindPopup("<b>Headquarters</b><br>This is our HQ location.");
  
      // Draw the yellow bounding box
   // const bounds = [[37.865543, -122.503163], [37.813665, -122.437426]];  // Upper left and lower right coordinates
   // const boundingBox = L.rectangle(bounds, { color: "#FFFF00", weight: 2 }).addTo(map);  // Yellow box with stroke weight of 2

   // boundingBox.bindPopup("Tracking Area");

      // Draw the blue bounding box
   // const blueBounds = [[37.856164, -122.591074], [37.748038, -122.403054]];  // Upper left and lower right coordinates for blue box
   // const blueBoundingBox = L.rectangle(blueBounds, { color: "#0000FF", weight: 2 }).addTo(map);  // Blue box
   // blueBoundingBox.bindPopup("Blue Tracking Area");


  // Store markers and ship data by ship name
  const shipMarkers = {};
  const shipData = {};

  // Function to update the map with ship data
  function updateMap(shipsData) {
    shipsData.forEach(function(ship) {

        // Skip the ship if the name is undefined or null
        if (!ship.flight) {
            console.warn('Skipping ship with undefined name:', ship);
            return; // Skip this iteration and do not add this ship to the map
          }
        const latitude = parseFloat(ship.latitude);
        const longitude = parseFloat(ship.longitude);

        console.log(`Creating marker for ${ship.flight}, Latitude: ${latitude}, Longitude: ${longitude}`);

        // Check if latitude and longitude are valid numbers
        if (!isNaN(latitude) && !isNaN(longitude)) {
            // Determine the icon based on ship length
            let shipIconUrl = 'img/boat_top.png';  // Default icon
            if (ship.length && parseFloat(ship.length) > 100) {
                shipIconUrl = 'img/big_cargo.png';  // Use cargo ship icon if length > 100m
            }

            const shipIcon = L.icon({
                iconUrl: shipIconUrl,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                popupAnchor: [0, -16]
            });

            const markerOptions = { icon: shipIcon };

            // If Course Over Ground (Cog) is available, use it to rotate the marker
            if (ship.cog) {
                markerOptions.rotationAngle = parseFloat(ship.cog);
            }

            // Check if the marker for the ship already exists
            if (!shipMarkers[ship.flight]) {
                console.log(`Creating new marker for ${ship.flight} at [${latitude}, ${longitude}]`);
                const marker = L.marker([latitude, longitude], markerOptions).addTo(map);
                shipMarkers[ship.flight] = marker;

                const lengthText = ship.length && ship.length !== 'Loading...' ? `${ship.length}` : 'Loading...';
                const widthText = ship.width && ship.width !== 'Loading...' ? `${ship.width}` : 'Loading...';
                
                const popupContent = `<b>${ship.flight}</b>
                  <br>Length (m): ${lengthText}
                  <br>Width (m): ${widthText}
                  <br>COG: ${ship.cog || 'N/A'}°
                  <br>SOG: ${ship.sog || 'N/A'} knots
                  <br>Type: ${ship.type || 'Unknown'}
                `;
                marker.bindPopup(popupContent);

            } else {
                console.log(`Updating marker for ${ship.flight} at [${latitude}, ${longitude}]`);
                shipMarkers[ship.flight].setLatLng([latitude, longitude]);

                // Update marker rotation if Cog is available
                if (ship.cog) {
                    shipMarkers[ship.flight].setRotationAngle(parseFloat(ship.cog));
                }

                // Update popup content
                const popupContent = `
                    <b>${ship.flight}</b><br>
                    Length: ${ship.length || 'N/A'} m<br>
                    Width: ${ship.width || 'N/A'} m<br>
                    Type: ${ship.type || 'Unknown'}<br>
                `;                
                shipMarkers[ship.flight].setPopupContent(popupContent);
            }

            // Optional hover behavior to show popup
            shipMarkers[ship.flight].on('mouseover', function () {
                this.openPopup();
            });
            shipMarkers[ship.flight].on('mouseout', function () {
                this.closePopup();
            });
        } else {
            console.error(`Invalid latitude or longitude for ship ${ship.flight}: Latitude: ${latitude}, Longitude: ${longitude}`);
        }
    });
}


  // Fetch and update ship data
  function fetchShipData() {
    $.getJSON('/api/arrivals', function(response) {
      if (response && response.data) {
        console.log('Fetched shipsData:', response.data); // Log the entire response
        updateMap(response.data);
      } else {
        console.error('No data received from API');
      }
    }).fail(function(jqXHR, textStatus, errorThrown) {
      console.error('Failed to load data from API:', textStatus, errorThrown);
    });
  }

  // Fetch the ship data initially
  fetchShipData();

  // Optionally set an interval to refresh the data periodically
  setInterval(fetchShipData, 1000); // Refresh every 5 seconds
});

//=============================================================
// TOGGLE LOGIC
//=============================================================

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
