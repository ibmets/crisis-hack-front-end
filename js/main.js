$(document).ready(function() {

	const CE_BACKEND_BASE_URL = 'http://ce-crisishack.eu-gb.mybluemix.net/ce-store/';
	var map, group;

	initialiseMap();

	// 1) Get a list of all crisis types from CE
	displayCrisisTypes().then(function() {
		//2) Register Drag and drop listeners
		$(".drag").draggable({
			helper: 'clone',
			containment: 'map',
			stop: function(evt, ui) {
				// Add a marker and circle when dropped
				var coordsX = evt.clientX - $("#controls").width() - 30 - 2, // width, padding, border
                coordsY = evt.clientY
                point = L.point( coordsX, coordsY ),
                markerCoords = map.containerPointToLatLng(point),
				latitude = markerCoords.lat,
				longitude = markerCoords.lng;

				//Add marker at center of circle with ebola icon
				var ebolaIcon = L.icon({
				    iconUrl: 'https://raw.githubusercontent.com/ce-store/crisishack/master/src/main/webapp/icons/crisis_ebola.png',
				    iconAnchor: [16,37],
				    iconSize: [32,37],
				});

				var center = L.marker([latitude, longitude], {icon: ebolaIcon});
	            center.setZIndexOffset(999999);
				center.addTo(group);

				var circle = L.circle([latitude, longitude], {
				    color: 'red',
				    fillColor: '#f03',
				    fillOpacity: 0.5,
				    radius: 2000
				}).addTo(group);

				//3) Switch the UI
				switchUI();
			}
		});
	});


	//Click Handlers

	// Helper functions
	function displayCrisisTypes() {
		return new Promise(function(resolve, reject) {
			//make a call to CE store and get crisis types
			$.get(CE_BACKEND_BASE_URL+'concepts/crisis%20type/instances?style=normalised', function(result) {
				for (var i=0; i<result.length; i++) {
					var name = result[i]._id;
					var htmlString = "<li><div class='crisis'><p>"+name+"</p><img class='drag' src='"+result[i]["icon file name"]+"'</div></li>";

					$("#crisis-list").append(htmlString);
				}
				resolve();
			});
		})
	}

	function switchUI() {
		// Increase side column width to col-sm-4
		$("#controls").switchClass("col-sm-2","col-sm-4", 350);
		$("#display").switchClass("col-sm-10","col-sm-8", 350);

		// Switch map to 50% height
		$(".mapContainer").animate({height: "50%"}, 350);
		setTimeout(function() {
			map.invalidateSize();
			setTimeout(function() {
				map.fitBounds(group.getBounds());

				//Flip out to chat interface
				$('#crisis-selector').fadeOut('slow', function(){
					$('#chat-container').fadeIn('slow');
				});

			}, 150);
		}, 360);

		// Make concepts div visible
		$(".concepts-container").show();
	}

	function initialiseMap() {
		const DEFAULT_LOCATION = [8.4562, -13.2277];
		const DEFAULT_ZOOM = 13;

		map = L.map('map').setView(DEFAULT_LOCATION, DEFAULT_ZOOM);
		group = new L.featureGroup();
		map.addLayer(group);
		var tileURL = "https://api.mapbox.com/styles/v1/dancunnington/ciztrtban00vh2sqjn5hci14f/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZGFuY3VubmluZ3RvbiIsImEiOiI1M2RiZTJlNTFkYWZiNjczNWRjODEwOGNlNzkzMTBlZiJ9.eAfl4KKi9ZRASZgxL8KcYw";
		L.tileLayer(tileURL, {
			// L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
			maxZoom: 20,
			attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
				'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
				'Imagery © <a href="http://mapbox.com">Mapbox</a>',
			id: 'mapbox.streets'
		}).addTo(map);
	}
})
