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
    zoomControl: false  // Disable the default zoom controls
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

      // Determine the icon based on ship length
      let shipIconUrl = 'img/boat_top.png'; // Default icon
      if (shipData[ship.flight].length && parseFloat(shipData[ship.flight].length) > 100) {
        shipIconUrl = 'img/big_cargo.png'; // Icon for big cargo ships
      }

      // Create or update the current location with the determined icon
      const shipIcon = L.icon({
        iconUrl: shipIconUrl,
        iconSize: [40, 40],
        iconAnchor: [20, 20], // Centered icon
        popupAnchor: [0, -16]
      });


        // If course over ground (Cog) is available, use it to rotate the marker
        const markerOptions = {
            icon: shipIcon
          };

        if (ship.cog) {
            markerOptions.rotationAngle = ship.cog; // Rotate marker based on Cog
        }



        if (shipMarkers[ship.flight]) {
          // Update the existing marker position
          shipMarkers[ship.flight].setLatLng([latitude, longitude]);
        
          // Update the rotation of the existing marker if Cog is available
          if (ship.cog) {
            shipMarkers[ship.flight].setRotationAngle(ship.cog);
          }
        } else {
          // Create a new marker if it doesn't exist
          const marker = L.marker([latitude, longitude], markerOptions).addTo(map);
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