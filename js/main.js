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
				longitude = markerCoords.lng,
				radius = 2000;

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
				    radius: radius
				}).addTo(group);

				//3) Switch the UI
				switchUI();

				//4) Add people to the map and update the chat interface
				addPeopleToMap(latitude, longitude, radius).then(function(realPeople) {
					//5) Display the real people on the chat interface
					// with conversations
					addPeopleToChat(realPeople).then(function() {
						console.log('loading complete');
					});

				});
			}
		});
	});

	//Click/Input Handlers

	//Send message function
	$(".send_message").click(function(e) {
		e.preventDefault();
		sendMessage();
	});
	//also when enter is pressed
	$(".message_input").keyup(function(e) {
		if (e.which === 13) { sendMessage(); }
	})

	// Helper functions
	function sendMessage() {
		var conversationId = $('#tabs').find('.conversation:visible')[0].id;
		var message = $(".message_input").val();
		var timestamp = new Date();
		var sentence = "there is an sms message named 'sms_{uid}' that is from the number ' 447912345678' and is to the number ' 441403540126' and has '" + timestamp + "' as timestamp and has '" + message + "' as message text.";
		$.post(CE_BACKEND_BASE_URL+'sentences?ceTEXT='+escape(sentence)+'&action=save', function(result) {
			if (result.alerts.errors.length === 0) {
				console.log(result);
				addChatMessage(conversationId, message, 'left');
				$(".message_input").val("");
			} else {
				console.log('CE ERROR');
				console.log(result);
			}
		});

		if (conversationId === 'sendToAll_chat') {
			//If it's send to all, put message into each conversation div
			$(".conversation").each(function(index, conversation) {
				if (conversation.id !== 'sendToAll_chat') {
					addChatMessage(conversation.id, message, 'left');
				}
			})
		}
	}

	function addPeopleToChat(realPeople) {
		return new Promise(function(resolve, reject) {

			var getConversationsFromCE = function() {
				return new Promise(function(resolve, reject) {
					var conversationsToReturn = [];
					//Get converstations from CE
					$.get(CE_BACKEND_BASE_URL+'concepts/conversation/instances?style=normalised', function(conversations) {

						//Append a send to all
						if (realPeople.length > 0) {
							$("#conversationList").append('<li><a href="#sendToAll_chat">Send to all</a></li>');
							$('#tabs').append(
								'<div id="sendToAll_chat" class="conversation">'+
								    '<h5 class="name">Send to all</h5>'+
										'<ul class="messages"></ul>'+
									'</div>'+
								'</div>');
						}

						for (var i=0; i<realPeople.length; i++) {

							//Add an item to the ul
							$("#conversationList").append('<li><a href="#'+realPeople[i].name+'_chat">'+realPeople[i].name+'</a></li>');

							//Build the conversation div
							//find conversation for this person
							for (var j=0; j<conversations.length; j++) {
								// console.log(real)
								if (conversations[j]._id === (realPeople[i].name+'-SafariCom')) {
									var messageIds = conversations[j].message;
									//add a conversation div to html
									$('#tabs').append(
										'<div id="'+realPeople[i].name+'_chat" class="conversation">'+
										    '<h5 class="name">'+realPeople[i].name+'</h5>'+
												'<ul class="messages"></ul>'+
											'</div>'+
										'</div>');
									conversationsToReturn.push({id: realPeople[i].name+'SafariCom', messageIds: messageIds});
									break;
								}
							}
						}
						resolve(conversationsToReturn);
					})
				});
			}

			var addMessagesForEachConversation = function(conversations) {
				return new Promise(function(resolve, reject) {

					var completedIndexes = [];
					var checkForCompletion = function(i) {
						completedIndexes.push(i);
						if (completedIndexes.length == conversations.length) {
							resolve();
						}
					}
				

					for (var i=0; i<conversations.length; i++) {
						(function(iterationOuter) {
							//get messages from CE and display in the chat
							var messageIds = conversations[iterationOuter].messageIds;
							
							var requestsCompleted = 0;
							for (var j=0; j<messageIds.length; j++) {
								(function(iterationInner) {
									$.get(CE_BACKEND_BASE_URL+'instances/'+messageIds[iterationInner], function(messageResponse) {
										requestsCompleted++;
										var isFrom = messageResponse.property_values["is from"][0];
										var text = messageResponse.property_values["message text"][0];
										var isTo = messageResponse.property_values["is to"][0];

										var messageSide = isTo === 'SafariCom' ? 'left' : 'right';
										var conversationDiv = isTo === 'SafariCom' ? isFrom+'_chat' : isTo+'_chat';
										//Display message in correct conversation
										addChatMessage(conversationDiv, text, messageSide);
										
										if (requestsCompleted === messageIds.length) {
											checkForCompletion(iterationOuter);
										}
									})
								})(j);

								
							}
						})(i);
					}
				});
			}

			//1) Get the conversations from CE for the real people
			getConversationsFromCE().then(function(converstations) {
				//2) Get messages for each conversation
				addMessagesForEachConversation(converstations).then(function() {

					//3) Initialise tabs
					$( "#tabs" ).tabs();
					resolve();
				});
			});		
		});
	}

	function addChatMessage(conversationDiv, message, side) {
		$("#"+conversationDiv+" ul").append(
			'<li class="message '+side+'">'+
				 '<div class="avatar"></div>'+
				 '<div class="text_wrapper">'+
					'<div class="text">'+message+'</div>'+
				 '</div>'+
			 '</li>');
	}

	function addPeopleToMap(latitude, longitude, radius) {
		return new Promise(function(resolve, reject) {
			//radius is in meters so convert to km
			radius = radius / 1000;
			var url = CE_BACKEND_BASE_URL+"concepts/person/instances/nearby?distance="+radius+"&latitude="+latitude+"&longitude="+longitude+"&style=normalised";
			var realPeople = [];
			$.get(url, function(ce) {
				var people = ce.result;
	            for (var i=0; i<people.length; i++) {
					//add marker to map
					var lat = people[i].instance.property_values.latitude[0];
					var lng = people[i].instance.property_values.longitude[0];
	                var phoneIcon;
	                if (people[i].instance.property_values["is real"]) {
	                    phoneIcon = L.icon({
	                        iconUrl: 'images/marker-icon-ourphone.png',
	                        iconSize: [25,41],
	                        iconAnchor: [12.5, 41]
	                    })

	                    //store list of real people
	                    realPeople.push({name: people[i].instance._id});
	                } else {
	                    phoneIcon = L.icon({
	                        iconUrl: 'images/marker-icon-phone.png',
	                        iconSize: [25,41],
	                        iconAnchor: [12.5, 41]
	                    })
	                }
					L.marker([lat,lng], {icon: phoneIcon}).addTo(group);
				}
				resolve(realPeople);
			});
		})
	}

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
