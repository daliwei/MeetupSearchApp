function appViewModel() {
  var self = this;
  var map, city, infowindow;
  var meetupLocations = []; 
  this.meetupEvents = ko.observableArray([]); //initial list of events
  this.filteredList = ko.observableArray([]); //list filtered by search keyword
  this.mapMarkers = ko.observableArray([]);  //holds all map markers
  this.eventStatus = ko.observable('Searching for events nearby...');
  this.searchStatus = ko.observable();
  this.searchLocation = ko.observable('');
  this.loadImg = ko.observable();
  this.inputLan = ko.observable();
  this.inputLon = ko.observable();
  this.filterKeyword = ko.observable('');
  this.numEvents = ko.computed(function() {
    return self.filteredList().length;
  });

  //Holds value for list togglings
  this.toggleSymbol = ko.observable('hide');

  //Hold the current location's lat & lng - useful for re-centering map
  this.currentLat = ko.observable(37.39);
  this.currentLng = ko.observable(-122.40);

  // When an event on the list is clicked, go to corresponding marker and open its info window.
  this.goToMarker = function(clickedEvent) {
    var clickedEventName = clickedEvent.eventName;
    for(var key in self.mapMarkers()) {
      if(clickedEventName === self.mapMarkers()[key].marker.title) {
        map.panTo(self.mapMarkers()[key].marker.position);
        map.setZoom(14);
        infowindow.setContent(self.mapMarkers()[key].content);
        infowindow.open(map, self.mapMarkers()[key].marker);
        map.panBy(0, -150);
        self.mobileShow(false);
        self.searchStatus('');
      }
    }
  };

    
 // AutoComplete input of city and state   
 this.doAutoComplete = function() {
     var inputLocation = new google.maps.places.Autocomplete(
		(document.getElementById('autocomplete')),
		{ types: ['geocode'] });

    google.maps.event.addListener(inputLocation, 'place_changed', function() {
		var place = inputLocation.getPlace();
		inputLan= place.geometry.location.lat();
	    inputLon = place.geometry.location.lng();  
    });
     
    /* if you use the event binding to capture the keypress event of an input tag, the browser will only call your handler function and will not add  
    the value of the key to the input element’s value. if you do want to let the default action proceed, just return true from your event handler   
    function.*/
    return true;
 }

 
 // Handle the input given when user searches for events in a location
 this.processLocationSearch = function() {
    //Need to use a jQuery selector instead of KO binding because this field is affected by the autocomplete plugin.  The value inputted does not 
    //seem to register via KO.
    self.searchStatus('');
    self.searchStatus('Searching...');
    
    var radius = 30;
    //var category= 25;
    //https://api.meetup.com/find/groups?key=6f4c634b253677752b591d6a67327&lat=38.5815719&lon=-121.49439960000001&radius=30&order=members
    var combine = "lat=" + inputLan + "&lon=" + inputLon + "&radius=" + radius; 
     
    //clear current events and markers 
    clearMarkers();
    self.meetupEvents([]);
    self.filteredList([]);
    self.eventStatus('Loading...');
    self.loadImg('<img src="img/ajax-loader.gif">');
    //perform new meetup search and center map to new location
    getMeetups(combine);
  };

  
  //Compare search keyword against event tag of all events.  Return a filtered list and map markers of request.
  this.filterResults = function() {
    var searchWord = self.filterKeyword().toLowerCase();
    var array = self.meetupEvents();
    if(!searchWord) {
      return;
    } else {
      //first clear out all entries in the filteredList array
      self.filteredList([]);
      //Loop through the meetupEvents array and see if the search keyword matches 
      //with event tag in the list, if so push that object to the filteredList 
      //array and place the marker on the map.
      for(var i=0; i < array.length; i++) {
        if(array[i].eventTag.toLowerCase().indexOf(searchWord) != -1) {
          self.mapMarkers()[i].marker.setMap(map);
          self.filteredList.push(array[i]);
        } else self.mapMarkers()[i].marker.setMap(null);
      }
      self.eventStatus(self.numEvents() + ' events found for ' + self.filterKeyword());
    }
  };

    
  //Clear keyword from filter and show all active events in current location again.
  this.clearFilter = function() {
    self.filteredList(self.meetupEvents());
    self.eventStatus(self.numEvents() + ' events found near ' + self.searchLocation());
    self.filterKeyword('');
    for(var i = 0; i < self.mapMarkers().length; i++) {
      self.mapMarkers()[i].marker.setMap(map);
    }
  };

    
  //toggles the list view
  this.listToggle = function() {
    if(self.toggleSymbol() === 'hide') {
      self.toggleSymbol('show');
    } else {
      self.toggleSymbol('hide');
    }
  };

    
  //Error handling if Google Maps fails to load
  this.mapRequestTimeout = setTimeout(function() {
    $('#map-canvas').html('We had trouble loading Google Maps. Please refresh your browser and try again.');
  }, 8000);

    
  // Initialize Google map, perform initial events search on a city.
  function mapInitialize() {
    city = new google.maps.LatLng(37.70, -122.10);
    map = new google.maps.Map(document.getElementById('map-canvas'), {
          center: city,
          zoom: 10,
          zoomControlOptions: {
            position: google.maps.ControlPosition.LEFT_CENTER,
            style: google.maps.ZoomControlStyle.SMALL
          },
          streetViewControlOptions: {
            position: google.maps.ControlPosition.LEFT_BOTTOM
            },
          mapTypeControl: false,
          panControl: false
        });
    clearTimeout(self.mapRequestTimeout);

    google.maps.event.addDomListener(window, "resize", function() {
       var center = map.getCenter();
       google.maps.event.trigger(map, "resize");
       map.setCenter(center); 
    });

    infowindow = new google.maps.InfoWindow({maxWidth: 300});
  }

    
  // Use API to get events data and store the info as objects in an array
  function getMeetups(location) {
    var meetupUrl = "https://api.meetup.com/find/groups?key=6f4c634b253677752b591d6a67327&";
    var order = "&order=members";
    var query = meetupUrl + location + order;
      
    $.ajax({
      url: query,
      dataType: 'jsonp',
      success: function(data) {
        console.log(data);
        var len = data.data.length;
        map.panTo({lat: data.data[0].lat, lng: data.data[0].lon});
        for(var i = 0; i < len; i++) {
              var info = data.data[i];
              //console.log(info);
              //this line filters out events that don't have a physical location to redeem
              if (info === undefined || info.name == undefined || info.lat == undefined || info.lon == undefined
                 || info.link == undefined || info.group_photo == undefined|| info.city == undefined 
                 || info.state == undefined || info.members == undefined|| info.category == undefined || info.who == undefined) 
                  continue;
              var muName = info.name;
              var muLat = info.lat;
              var muLon = info.lon;
              var muLink = info.link;
              var muImg = info.group_photo.photo_link;
              var mucity = info.city;
              var mustate = info.state;
              var mumembers = info.members;
              var mutag = info.category.shortname;
              var mugroup = info.who;
             
              self.meetupEvents.push({
                eventName: muName, 
                eventLat: muLat, 
                eventLon: muLon, 
                eventLink: muLink, 
                eventImg: muImg,               
                eventAddress: mucity + ", " + mustate,
                eventTag: mutag,
                eventGroup: mugroup
              });
        }
        self.filteredList(self.meetupEvents());
        mapMarkers(self.meetupEvents());
        self.searchStatus('');
        self.loadImg('');
      },
      error: function() {
        self.eventStatus('Oops, something was wrong, please refresh and try again.');
        self.loadImg('');
      }
    });
  }

    
  // Create and place markers and info windows on the map based on data from API
  function mapMarkers(array) {
    $.each(array, function(index, value) {
      var latitude = value.eventLat,
          longitude = value.eventLon,
          geoLoc = new google.maps.LatLng(latitude, longitude),
          thisEvent = value.eventName;

      var infoContentString = '<div id="infowindow">' +
      '<img src="' + value.eventImg + '">' +
      '<h4 class = "infoName">' + value.eventName + '</h4>' +
      '<div class = "clear"></div>' +
      '<p class = "infoAddress">' + value.eventAddress + '</p>' +
      '<p>Group: ' + value.eventGroup + '</p>' +
      '<p><a href="' + value.eventLink + '" target="_blank">Click to view event details</a></p>' +
      '</div>';

      // Custormize marker
      var iconBase = 'img/meetup.png';
      var marker = new google.maps.Marker({
        position: geoLoc,
        title: thisEvent,
        map: map,
        icon: iconBase
      });

      self.mapMarkers.push({marker: marker, content: infoContentString});

      self.eventStatus(self.numEvents() + ' events found near ' + self.searchLocation());

      //generate infowindows for each event
      google.maps.event.addListener(marker, 'click', function() {
         self.searchStatus('');
         infowindow.setContent(infoContentString);
         map.setZoom(12);
         map.setCenter(marker.position);
         infowindow.open(map, marker);
         map.panBy(0, -150);
       });
    });
  }
    

  // Clear markers from map and array
  function clearMarkers() {
    $.each(self.mapMarkers(), function(key, value) {
      value.marker.setMap(null);
    });
    self.mapMarkers([]);
  }

    
  //Manages the toggling of the list view, location centering, and search bar on a mobile device.
  this.mobileShow = ko.observable(false);
  this.searchBarShow = ko.observable(true);

  this.mobileToggleList = function() {
    if(self.mobileShow() === false) {
      self.mobileShow(true);
    } else {
      self.mobileShow(false);
    }
  };

  this.searchToggle = function() {
    if(self.searchBarShow() === true) {
      self.searchBarShow(false);
    } else {
      self.searchBarShow(true);
    }
  };

    
  //Re-center map to current city if you're viewing events that are further away
  this.centerMap = function() {
    infowindow.close();
    var currCenter = map.getCenter();
    var cityCenter = new google.maps.LatLng(self.currentLat(), self.currentLng());
    if((cityCenter.k == currCenter.A) && (cityCenter.D == currCenter.F)) {
        self.searchStatus('Map is already centered.');
    } else {
      self.searchStatus('');
      map.panTo(cityCenter);
      map.setZoom(10);
    }
  };

  mapInitialize();
}


 //custom binding highlights the search text on focus
 ko.bindingHandlers.selectOnFocus = {
        update: function (element) {
          ko.utils.registerEventHandler(element, 'focus', function (e) {
            element.select();
          });
        }
      };

 ko.applyBindings(new appViewModel());