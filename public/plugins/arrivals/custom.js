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
  var shipMarkers = {};
  var shipData = {};
  let loadingTimeout = null;
  const LOADING_TIMEOUT_DURATION = 90000; // 90 seconds
  let initialDataReceived = false; // for loading screen
  
  function calculateDistanceInMiles(lat1, lon1, lat2, lon2) {
      const R = 3959; // Earth's radius in miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
  }
  
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
      // clear any existing timeout
      if (loadingTimeout) {
          clearTimeout(loadingTimeout);
      }
      
      // set new timeout
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
  
  function clearAllShipData() {
      shipMarkers = {};
      shipData = {};
  }
  
  document.addEventListener("DOMContentLoaded", function() {
    console.log('DOM Content Loaded - Starting initialization');
  
      var boundingBox = window.boundingBox;
      var neLat = boundingBox ? parseFloat(boundingBox.neLat.replace(/['"]+/g, '')) : null;
      var neLng = boundingBox ? parseFloat(boundingBox.neLng.replace(/['"]+/g, '')) : null;
      var swLat = boundingBox ? parseFloat(boundingBox.swLat.replace(/['"]+/g, '')) : null;
      var swLng = boundingBox ? parseFloat(boundingBox.swLng.replace(/['"]+/g, '')) : null;
      var zoom = boundingBox && boundingBox.zoom ? parseInt(boundingBox.zoom.replace(/['"]+/g, '')) : 3;
  
      // calculate the center of the bounding box with fallback
      var centerLat = 39.8283;  // default to center of US
      var centerLng = -98.5795;
  
      if (!isNaN(neLat) && !isNaN(swLat) && !isNaN(neLng) && !isNaN(swLng)) {
          centerLat = (neLat + swLat) / 2;
          centerLng = (neLng + swLng) / 2;
      }
  
      console.log('Map initialization with:', { centerLat, centerLng, zoom });
  
    // initialize the map
    map = L.map('map', {
      center: [centerLat, centerLng],  
      zoom: zoom,  
      zoomControl: false,
      attributionControl: false
  });
   // dark mode
    const darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 40
      });
    darkTileLayer.addTo(map);
  
   if (neLat && neLng && swLat && swLng) {
      initialDataReceived = false;
      try {
          const loadingOverlay = document.getElementById('loadingOverlay');
          if (loadingOverlay) {
              loadingOverlay.style.display = 'flex';
              resetLoadingMessage();
              startLoadingTimeout();
          }
      } catch (error) {
          console.error('Error showing loading overlay:', error);
      }
      
      const bounds = L.latLngBounds(
          [swLat, swLng],
          [neLat, neLng]
      );
      map.fitBounds(bounds);
    }
  
    // debug map initialization
    console.log('Map container:', document.getElementById('map'));
    console.log('Initial map object:', map);
  
    function calculateDistanceInMiles(lat1, lon1, lat2, lon2) {
      const R = 3959; // Earth's radius in miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
  }
    function updateMap(shipsData) {
      console.log('Starting map update with:', shipsData);
  
      if (!initialDataReceived && shipsData.length > 0) {
          initialDataReceived = true;
          clearLoadingTimeout(); 
          try {
              const loadingOverlay = document.getElementById('loadingOverlay');
              if (loadingOverlay) {
                  loadingOverlay.style.display = 'none';
              }
          } catch (error) {
              console.error('Error hiding loading overlay:', error);
          }
      }
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
                      console.log(`Creating new marker for ${ship.flight}`);
                      const marker = new L.Marker([latitude, longitude], {icon: shipIcon});
                      marker.bindPopup(createPopupContent(ship));
                      marker.on('mouseover', function() { this.openPopup(); });
                      marker.on('mouseout', function() { this.closePopup(); });
                      marker.addTo(map);
                      shipMarkers[ship.flight] = marker;
                  } else {
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
      
  Object.keys(shipMarkers).forEach(shipName => {
      if (!activeShips.has(shipName)) {
          map.removeLayer(shipMarkers[shipName]);
          delete shipMarkers[shipName];
      }
  });
  }
  
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
  
    fetchShipData();
  
    setInterval(fetchShipData, 2000); // refresh every 2 second
  });