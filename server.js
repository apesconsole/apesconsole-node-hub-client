/*
	Apes's Console
*/

var express = require("express");
var app = express();
var http = require('http').Server(app);
var router = express.Router();
var logger = require("logging_component");
var url = require("url");
var mqtt = require('mqtt');

var mqtt_url = url.parse('tcp://m13.cloudmqtt.com:16786');

var Gpio = require('onoff').Gpio;
var sensor = new Gpio(23, 'in');
var pump   = new Gpio(18, 'in');
var lamp   = new Gpio(17, 'out');
var led2   = new Gpio(4, 'out');
var led2   = new Gpio(27, 'out');

// Create a client connection
var client = mqtt.connect(mqtt_url , {
  username: 'APES_CONSOLE_HUB',
  password: '1234567890'
});

var path = __dirname + '/public/';
app.use('/resources', express.static(path + 'resources'));
app.use("/", router);

var globalRoomData = [
	{ title: 'Hall', id: 1, icon: 'hall', deviceList: [
		{ title: 'Lamp', id: 'hall-light1' , status: false},
		{ title: 'AC', id: 'random-1' , status: false},
		{ title: 'Music', id: 'random-2' , status: false}
	]},
	{ title: 'Master Room', id: 2, icon: 'master', deviceList: [
		{ title: 'Light', id: 'mstrm-light1' , status: false},
		{ title: 'Music', id: 'random-3' , status: false},
		{ title: 'Heater', id: 'random-4' , status: false}						
	]},
	{ title: 'Guest Room', id: 3, icon: 'guest', deviceList: [
		{ title: 'Light', id: 'gstrm-light1' , status: false}						
	]},
	{ title: 'Garden', id: 1, icon: 'garden', deviceList: [
		{ title: 'Soil', id: 'sensor-status' , status: false},
		{ title: 'Sprinkler', id: 'water-pump' , status: false}
	]}
];

var toggleDevice = function(deviceId){
	switch(deviceId){
		case 'sensor-status': ''; return false;
		case   'hall-light1': lamp.writeSync(lamp.readSync() ^ 1); return lamp.readSync() == 0 ? false : true;
		case   'hall-light1': lamp.writeSync(lamp.readSync() ^ 1); return lamp.readSync() == 0 ? false : true;
		case  'mstrm-light1': led1.writeSync(led1.readSync() ^ 1); return led1.readSync() == 0 ? false : true;
		case  'gstrm-light1': led2.writeSync(led2.readSync() ^ 1); return led2.readSync() == 0 ? false : true;
	}
	return false;
}

var respond = function(message){
	var deviceState = JSON.parse(message);
	logger.log("Received '" + message + "' on '" + topic + "'");
	for(var i=0; i<globalRoomData.length; i++){
		if(globalRoomData[i].id == deviceState.roomId){
			for(var j=0;j<globalRoomData[i].deviceList.length;j++){
				if(globalRoomData[i].deviceList[j].id == deviceState.deviceId){
					deviceState.status = toggleDevice(deviceState.deviceId);
					globalRoomData[i].deviceList[j].status = deviceState.status;
					i = globalRoomData.length; 
					break;
				}
			}
		}
	}
	client.publish('T_APESCONSOLE_RD', '{roomId: ' + deviceState.roomId + ', deviceId: ' + deviceState.deviceId + ', status: ' + deviceState.status + '}');	
}

// subscribe to a topic
client.on('connect', function() { // When connected
	logger.log('Subscriber Up!');
	client.subscribe('T_APESCONSOLE_TRG');
	// when a message arrives, do something with it
	client.on('message', function(topic, message, packet) {
		logger.log("LOCAL: Received '" + message + "' on '" + topic + "'");
		respond(message);	
	});
});


router.get("/", function(req,res){
	res.redirect('/index');
});

router.get("/index", function(req,res){
	res.sendFile(path + "index.html");
});	

router.get("/shut", function(req,res){
	logger.log('Shutting Down MQTT Client!');
	if(client != null)
		client.end();
	res.sendFile(path + "index.html");
});

http.listen(process.env.PORT || 3002, function(){				
	logger.log('##################################################');
	logger.log('        Ape\'s Console - NODE - CLIENT ');
	logger.log('        Process Port :' + process.env.PORT);
	logger.log('        Local Port   :' + 3002);
	logger.log('##################################################');
});	



