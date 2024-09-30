sf.plugins.arrivals = {
  dataType: 'json',

  url: function(options) {
    return 'api/arrivals';
  },

  formatData: function(response) {
    return response.data;
  }
};

// MAP
document.addEventListener("DOMContentLoaded", function() {
  // Initialize the map
  var map = L.map('map', {
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

                // Bind the popup with ship data
                const popupContent = `<b>${ship.flight}</b>
                <br>Length: ${ship.length || 'N/A'}
                <br>Width: ${ship.width || 'N/A'}
                <br>Cog: ${ship.cog || 'N/A'}
                <br>Sog: ${ship.sog || 'N/A'}
                <br>Type: ${ship.type || 'Unknown'}<br>
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
                    Length: ${ship.length || 'N/A'}<br>
                    Width: ${ship.width || 'N/A'}<br>
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