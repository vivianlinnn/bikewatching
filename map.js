mapboxgl.accessToken = 'pk.eyJ1Ijoidml2aWFubGlubm4iLCJhIjoiY203ZTk5OTJ2MDZpaTJpcTd2cGRiamprbSJ9.Ll5zXMJ8GPr4xj5t5A_j8Q';
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
  });

const svg = d3.select('#map').select('svg');
let stations = [];

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);  // Project to pixel coordinates
    return { cx: x, cy: y };  // Return as object for use in SVG attributes
}

let circles;
let radiusScale;

let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];

// Function to update circle positions when the map moves/zooms
function updatePositions() {
    circles
    .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
    .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
}


function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function computeStationTraffic(stations, trips) {
    // Compute departures
    const departures = d3.rollup(
        trips, 
        (v) => v.length, 
        (d) => d.start_station_id
    );

    // Computed arrivals as you did in step 4.2
    arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id,
      );
  
    // Update each station..
    return stations.map((station) => {
      let id = station.short_name;
      station.arrivals = arrivals.get(id) ?? 0;
      station.departures = departures.get(id) ?? 0;
      station.totalTraffic = station.arrivals + station.departures;
      return station;
  });
}


map.on('load', async() => { 

    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
      });

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': '#41be65',  // A bright green using hex code
            'line-width': 5,          // Thicker lines
            'line-opacity': 0.6       // Slightly less transparent
        }
    });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
      });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#6354ab',  // A bright green using hex code
            'line-width': 5,          // Thicker lines
            'line-opacity': 0.6       // Slightly less transparent
        }
    });

    let trips = await d3.csv(
        'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
        (trip) => {
          trip.started_at = new Date(trip.started_at);
          trip.ended_at = new Date(trip.ended_at);
          return trip;
        },
    );

    // Load the nested JSON file

    let jsonData;
    const jsonurl = 'bluebikes-stations.json';
    try {
        const jsonData = await d3.json(jsonurl);
        // Await JSON fetch
        stations = computeStationTraffic(jsonData.data.stations, trips);
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }

    // console.log(stations)

    radiusScale = d3
                .scaleSqrt()
                .domain([0, d3.max(stations, (d) => d.totalTraffic)])
                .range([0, 25]);
    
        // Append circles to the SVG for each station
        circles = svg.selectAll('circle')
        .data(stations, (d) => d.short_name)
        .enter()
        .append('circle')
        .attr('r', (d) => radiusScale(d.totalTraffic))               // Radius of the circle
        .attr('fill', 'steelblue')  // Circle fill color
        .attr('stroke', 'white')    // Circle border color
        .attr('stroke-width', 1)    // Circle border thickness
        .attr('opacity', 0.8);      // Circle opacity

        circles.each(function(d) {
            // Add <title> for browser tooltips
            d3.select(this)
            .append('title')
            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });
        //  console.log(circles);
    
 
    
        updatePositions();
        map.on('move', updatePositions);     // Update during map movement
        map.on('zoom', updatePositions);     // Update during zooming
        map.on('resize', updatePositions);   // Update on window resize
        map.on('moveend', updatePositions);

        //add THIS code
        for (let trip of trips) {

            trip.started_at = new Date(trip.start_time);

        }
        // do the same for end
    

    let timeFilter = -1;
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');

    function filterTripsbyTime(trips, timeFilter) {
        return timeFilter === -1 
          ? trips // If no filter is applied (-1), return all trips
          : trips.filter((trip) => {
              // Convert trip start and end times to minutes since midnight
              const startedMinutes = minutesSinceMidnight(trip.started_at);
              const endedMinutes = minutesSinceMidnight(trip.ended_at);
              
              // Include trips that started or ended within 60 minutes of the selected time
              return (
                Math.abs(startedMinutes - timeFilter) <= 60 ||
                Math.abs(endedMinutes - timeFilter) <= 60
              );
          });
      }

    function formatTime(minutes) {
        const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
        return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
    }

    function updateTimeDisplay() {
        timeFilter = Number(timeSlider.value);  // Get slider value
      
        if (timeFilter === -1) {
          selectedTime.textContent = '';  // Clear time display
          anyTimeLabel.style.display = 'block';  // Show "(any time)"
        } else {
          selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
          anyTimeLabel.style.display = 'none';  // Hide "(any time)"
        }
      
        // Trigger filtering logic which will be implemented in the next step
        updateScatterPlot(timeFilter);
    }

    

    function updateScatterPlot(timeFilter) {
        // Get only the trips that match the selected time filter
        const filteredTrips = filterTripsbyTime(trips, timeFilter);
        
        // Recompute station traffic based on the filtered trips
        const filteredStations = computeStationTraffic(stations, filteredTrips);

        timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
        
        // Update the scatterplot by adjusting the radius of circles
        circles
          .data(filteredStations, (d) => d.short_name)
          .join('circle') // Ensure the data is bound correctly
          .attr('r', (d) => radiusScale(d.totalTraffic)); // Update circle sizes
    }

    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();
     
});