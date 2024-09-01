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
  var map = L.map('map').setView([37.8199, -122.4783], 13); // Coordinates for Golden Gate Bridge

  // Set up the map tiles from OpenStreetMap or another provider
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map);

  // Store markers and ship data by ship name
  const shipMarkers = {};
  const shipData = {};

  // Function to update the map with ship data
  function updateMap(shipsData) {
    shipsData.forEach(function(ship) {
      const latitude = parseFloat(ship.city);
      const longitude = parseFloat(ship.gate);

      if (!isNaN(latitude) && !isNaN(longitude)) {
        // Check if we already have data for this ship
        if (!shipData[ship.flight]) {
          shipData[ship.flight] = {
            length: 'Loading...',
            width: 'Loading...',
            cog: 'Loading...',
            sog: 'Loading...',
            type: 'Unknown'  // Initialize type as 'Unknown'
          };
        }

        // Log the received type for debugging
        console.log(`Received type for ${ship.flight}: ${ship.type}`);

        // If we receive length and width, store them
        if (ship.length && ship.width) {
          shipData[ship.flight].length = ship.length;
          shipData[ship.flight].width = ship.width;
        }

        // Continuously update Cog and Sog (from PositionReport)
        if (ship.cog && ship.sog) {
          shipData[ship.flight].cog = ship.cog;
          shipData[ship.flight].sog = ship.sog;
        }

        // Update the type if received (from ShipStaticData)
        if (ship.type && ship.type !== 'Unknown') {
          shipData[ship.flight].type = ship.type;
        }

        // Create or update the current location with ship_front_icon.png
        const shipIcon = L.icon({
          iconUrl: 'img/ship_front_icon.png',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });

        // Check if a marker already exists for the ship
        if (shipMarkers[ship.flight]) {
          // Update the existing marker position
          shipMarkers[ship.flight].setLatLng([latitude, longitude]);
        } else {
          // Create a new marker if it doesn't exist
          const marker = L.marker([latitude, longitude], { icon: shipIcon }).addTo(map);
          shipMarkers[ship.flight] = marker;
        }

        // Bind the popup with the cached length, width, cog, sog, and type data
        const length = shipData[ship.flight].length;
        const width = shipData[ship.flight].width;
        const cog = shipData[ship.flight].cog;
        const sog = shipData[ship.flight].sog;
        const type = shipData[ship.flight].type;

        const popupContent = `<b>${ship.flight}</b><br>Length: ${length}<br>Width: ${width}<br>Cog: ${cog}<br>Sog: ${sog}<br>Type: ${type}`;
        shipMarkers[ship.flight].bindPopup(popupContent);

        // Ensure the popup reflects the latest data
        if (shipMarkers[ship.flight]._popup && shipMarkers[ship.flight]._popup.isOpen()) {
          shipMarkers[ship.flight]._popup.setContent(popupContent);
        }
        
        // Optionally add hover behavior
        shipMarkers[ship.flight].on('mouseover', function () {
          this.openPopup();
        });
        shipMarkers[ship.flight].on('mouseout', function () {
          this.closePopup();
        });
      } else {
        console.error('Invalid ship data, marker not created:', ship);
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
  setInterval(fetchShipData, 5000); // Refresh every 5 seconds
});
