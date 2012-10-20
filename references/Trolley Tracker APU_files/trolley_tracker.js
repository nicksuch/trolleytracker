var k_seconds_between_updates = 30;

var xml_url = null;

var xml_req = null;

var timer_interval = null;
var timer = null;
var updated_time = null;

var map;
var custom_overlay;
var trolley_markers = new Array();
var trolley_devices = new Array(
	{ key:'5169832009315', color:'red' },
	{ key:'7370600138219', color:'blue' },
	{ key:'9313486888914', color:'green' },
	{ key:'6297857315219', color:'yellow' },
	{ key:'6178166802710', color:'white' }
);
var trolley_last_heading = new Array();
var marker_size = 22;

/*
var route_bounds = new Array(
	new google.maps.LatLngBounds(
		new google.maps.LatLng(34.13315,-117.90050),
		new google.maps.LatLng(34.135123,-117.8897)
	),
	new google.maps.LatLngBounds(
		new google.maps.LatLng(34.1318,-117.8903),
		new google.maps.LatLng(34.1332,-117.8897)
	),
	new google.maps.LatLngBounds(
		new google.maps.LatLng(34.1308,-117.8903),
		new google.maps.LatLng(34.1319,-117.88775)
	)
);
*/

function initializeMap(_xml_url) {
	xml_url = _xml_url;
	
	// Build the map.
	var map_options = {
		zoom: 16,
		center: new google.maps.LatLng(34.132100, -117.894200),
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		disableDefaultUI: true,
		draggable: false,
		keyboardShortcuts: false,
		disableDoubleClickZoom: true,
		scrollwheel: false
    };
    map = new google.maps.Map(document.getElementById('map-container'), map_options);

	// Add the custom map overlay.
	var custom_overlay_bounds = new google.maps.LatLngBounds(
		new google.maps.LatLng(34.127099, -117.902970),
		new google.maps.LatLng(34.136540, -117.885618)
	);
	var custom_overlay_options = {
		map: map,
		clickable: false
	};
	custom_overlay = new google.maps.GroundOverlay('https://www.apu.edu/includes/map/images/trolley_map_overlay.png',custom_overlay_bounds,custom_overlay_options);

	//debugRouteBounds();

	requestTrolleyGPS();
	
	return true;
}

function initializeMapForMobile(_xml_url) {
	xml_url = _xml_url;
	
	// Build the map.
	var map_options = {
		zoom: 15,
		center: new google.maps.LatLng(34.133100, -117.894200),
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		streetViewControl: false,
		mapTypeControl: false
    };
    map = new google.maps.Map(document.getElementById('map-container'), map_options);

	// Add the custom map overlay.
	var custom_overlay_bounds = new google.maps.LatLngBounds(
		new google.maps.LatLng(34.127099, -117.902970),
		new google.maps.LatLng(34.136540, -117.885618)
	);
	var custom_overlay_options = {
		map: map,
		clickable: false
	};
	custom_overlay = new google.maps.GroundOverlay('https://www.apu.edu/includes/map/images/trolley_map_route_only.png',custom_overlay_bounds,custom_overlay_options);

	marker_size = 14;

	//debugRouteBounds();

	requestTrolleyGPS();
	
	return true;
}

function addTrolley(trolley_key,trolley_pos,last_trolley_pos) {
	var trolley_device_array_key = getTrolleyDeviceArrayKey(trolley_key);

	// Calculate marker direction stuff.
	var heading = trolley_pos.heading;
	var marker_direction = '';
	// If the heading is zero and it wasn't moving, check the previous heading.
	if (heading == 0 && trolley_pos.speed == 0) {
		if (trolley_last_heading[trolley_device_array_key]) {
			heading = trolley_last_heading[trolley_device_array_key];
		}
	} else {
		// Otherwise, save this as the last heading.
		trolley_last_heading[trolley_device_array_key] = heading;
	}
	if (heading >= 315 || heading < 45) {
		marker_direction = 'up';
	} else if (heading >= 45 && heading < 135) {
		marker_direction = 'right';
	} else if (heading >= 135 && heading < 225) {
		marker_direction = 'down';
	} else {
		marker_direction = 'left';
	}
	
	var marker_anchor = Math.ceil(marker_size / 2);

	// Show the trolley.
	var trolley_icon = new google.maps.MarkerImage(
		'https://www.apu.edu/includes/map/images/trolley_marker_'+trolley_devices[trolley_device_array_key].color+'_'+marker_direction+'.png',
		new google.maps.Size(24,24),
		new google.maps.Point(0,0),
		new google.maps.Point(marker_anchor,marker_anchor),
		new google.maps.Size(marker_size,marker_size)
	);
	var marker_options = {
		map: map,
		clickable: false,
		flat: true,
		position: new google.maps.LatLng(trolley_pos.lat,trolley_pos.lng),
		icon: trolley_icon
	};
	
	//debug(trolley_pos.lat+' '+trolley_pos.lng);
	
	trolley_markers[trolley_markers.length] = new google.maps.Marker(marker_options);
}

function getTrolleyDeviceArrayKey(trolley_key) {
	for (var i in trolley_devices) {
		if (trolley_devices[i].key == trolley_key) {
			return i;
		}
	}
	return -1;
}

function clearTrolleys() {
	for (var i in trolley_markers) {
		trolley_markers[i].setMap(null);
	}
	trolley_markers = new Array();
}

function requestTrolleyGPS() {
	var action_handler = processRequestChange;
	var url = xml_url;

	// If we haven't finished the previous request, don't send this one.
	if (xml_req) return;
			
	// branch for native XMLHttpRequest object
	if (window.XMLHttpRequest) {
		xml_req = new XMLHttpRequest();
		xml_req.onreadystatechange = action_handler;
		xml_req.open("GET", url, true);
		xml_req.send(null);
	// branch for IE/Windows ActiveX version
	} else if (window.ActiveXObject) {
		xml_req = new ActiveXObject("Microsoft.XMLHTTP");
		if (xml_req) {
			xml_req.onreadystatechange = action_handler;
			xml_req.open("GET", url, true);
			xml_req.send();
		}
	}
}

function processRequestChange() {
	// only if xml_req shows "loaded"
	if (xml_req.readyState == 4) {
		// only if "OK"
		if (xml_req.status == 200) {
			updateMapfromXML();
		} else {
			debug('There was a problem retrieving the XML data:\n'+xml_req.responseText);
		}
		
		// We're done with this request.
		xml_req = null;
	}
}		

function updateMapfromXML() {
	var i,j;
	var device_list;
	var position_list;
	var trolley_key;
	var trolley_pos,last_trolley_pos;
	var lat,lng;
	
	var date = new Date();
	var current_time = date.getTime();
	var milliseconds_in_30_min = 1000 * 60 * 30;
	var milliseconds_in_hour = 1000 * 60 * 60;

	var seconds = date.getSeconds();
	if (seconds < 10) seconds = '0'+seconds;
	var minutes = date.getMinutes();
	if (minutes < 10) minutes = '0'+minutes;
	var hours = date.getHours();
	//hours += 1; // offset so we get 1 to 24, which makes a simpler conversion to am/pm
	var ampm;
	if (hours == 0) {
		hours = 12;
		ampm = 'a.m.';
	} else if (hours > 12) {
		hours -= 12;
		ampm = 'p.m.';
	} else {
		ampm = 'a.m.';
	}
	updated_time = hours+':'+minutes+':'+seconds+' '+ampm;
	
	// It seems that calling an 'abort' on the request will send back
	// a blank response, so we don't want that kind of thing to mess
	// up this function.
	if ( ! xml_req.responseXML) return;
	
	clearTrolleys();

	device_list = xml_req.responseXML.getElementsByTagName('device');
	for (i = 0; i < device_list.length; i++) {
		position_list = device_list[i].getElementsByTagName('position');
		// Get the device key.
		trolley_key = device_list[i].getElementsByTagName('key');
		trolley_key = getNodeContent(trolley_key[0]);
		// Show the most recent postion for each item.
		if (position_list[0]) {
			trolley_pos = getPositionObj(position_list[0]);
			last_trolley_pos = new Object();
			if (position_list[1]) last_trolley_pos = getPositionObj(position_list[1]);
			
					
			// Check if the data is too old (an hour).
			// Position timestamp is in seconds since 1970, whereas JavaScript uses milliseconds.
			//if (current_time - (trolley_pos.timestamp * 1000) < milliseconds_in_hour) {
				//if (onRoute(trolley_pos)) {
					addTrolley(trolley_key,trolley_pos,last_trolley_pos);
				//}
			//}
		}
		
		// Testing with multiple points.
		/*for (j = 0; j < position_list.length; j++) {
			trolley_pos = getPositionObj(position_list[j]);
			last_trolley_pos = new Object();
			if (position_list[j+1]) last_trolley_pos = getPositionObj(position_list[j+1]);
			if (onRoute(trolley_pos)) {
				addTrolley(trolley_key,trolley_pos,last_trolley_pos);
			}
		}*/
	}
	
	// Create the once-per-second timer interval if this is the first time.
	if ( ! timer_interval) {
		timer_interval = setInterval('handleTimer()',1000);
	}
	
	// Reset the update timer.
	timer = k_seconds_between_updates;
}

function getPositionObj(position_xml_obj) {
	var i;
	var prop_name,prop_value;
	var position_obj = new Object();
	var node_count = position_xml_obj.childNodes.length;
	
	// Loop through all the "children" of this xml object,
	// (which will be the parameters such as lat and lng), and make a normal object out of them.
	for (i = 0; i < node_count; i++) {
		// Make sure this child node is "defined"... i.e. not a line break or something.
		if (position_xml_obj.childNodes[i].tagName == undefined) continue;
		
		prop_name = position_xml_obj.childNodes[i].tagName;
		if (window.ActiveXObject) {
			prop_value = position_xml_obj.childNodes[i].text;
		} else {
			prop_value = position_xml_obj.childNodes[i].textContent;
		}
		position_obj[prop_name] = prop_value;
	}
	
	return position_obj;
}

function onRoute(position_obj) {
	var on_route = false;
	var position_latlng = new google.maps.LatLng(position_obj.lat,position_obj.lng);
	
	// Loop through our list of route bounding rects.
	// If it's within any of them, it's on route, obviously.
	for (var i in route_bounds) {
		if(route_bounds[i].contains(position_latlng)) {
			on_route = true;
		}
		
		if (on_route) break;
	}
	
	return on_route;
}

function getNodeContent(note_obj) {
	if (window.ActiveXObject) {
		return note_obj.text;
	} else {
		return note_obj.textContent;
	}
}

function handleTimer() {
	if (timer > 0) {
		timer--;
		var seconds_label = 'seconds';
		if (timer == 1) seconds_label = 'second';
		if (document.getElementById('last-updated')) document.getElementById('last-updated').innerHTML = updated_time;
		if (document.getElementById('next-update')) document.getElementById('next-update').innerHTML = timer+' '+seconds_label;
	} else {
		requestTrolleyGPS();
	}
}

function debugRouteBounds() {
	var bounds,rect;
	
	for (var i in route_bounds) {
		bounds = new Array(
			route_bounds[i].getNorthEast(),
			new google.maps.LatLng(route_bounds[i].getSouthWest().lat(),route_bounds[i].getNorthEast().lng()),
			route_bounds[i].getSouthWest(),
			new google.maps.LatLng(route_bounds[i].getNorthEast().lat(),route_bounds[i].getSouthWest().lng())
		);
		
		rect = new google.maps.Polygon({
			paths: bounds,
			strokeColor: "#FF0000",
			strokeOpacity: 0.8,
			strokeWeight: 1,
			fillColor: "#FF0000",
			fillOpacity: 0.35
		});
		rect.setMap(map);
	}
}

function debug(message) {
	if (document.getElementById('debug')) {
		document.getElementById('debug').innerHTML += message+'<br />';
	}
}