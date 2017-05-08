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

/* PIN SET UP */
var rpio = require('rpio');
var options = {
        gpiomem: true,          /* Use /dev/gpiomem */
        mapping: 'physical',    /* Use the P1-P40 numbering scheme */
}

var sensor = 16;
var pump   = 15;
var lamp   = 13;
var led1   = 33;
var led2   = 37;

rpio.init([options]);

rpio.open(sensor, rpio.INPUT);
logger.log('Sensor Set');
rpio.open(pump, rpio.OUTPUT, rpio.HIGH);
logger.log('Pump Set');
rpio.open(lamp, rpio.OUTPUT, rpio.HIGH);
logger.log('Lamp Set');
rpio.open(led1, rpio.OUTPUT, rpio.LOW);
logger.log('LED1 Set');
rpio.open(led2, rpio.OUTPUT, rpio.LOW);
logger.log('LED2 Set');

//PIN Set Up complete

// Create a client connection
var client = mqtt.connect(mqtt_url , {
  username: 'AAAAAA',
  password: 'AAAAAA'
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
	{ title: 'Garden', id: 4, icon: 'garden', deviceList: [
		{ title: 'Soil', id: 'sensor-status' , status: false},
		{ title: 'Sprinkler', id: 'water-pump' , status: false}
	]}
];


var toggleDevice = function(deviceId){
	switch(deviceId){
		case 'sensor-status': logger.log('Sensor'); return false;
		case    'water-pump': logger.log('Pump'); rpio.read(pump) == 1 ? rpio.write(pump, rpio.LOW) : rpio.write(pump, rpio.HIGH); return rpio.read(pump) == 1;
		case   'hall-light1': logger.log('Lamp'); rpio.read(lamp) == 1 ? rpio.write(lamp, rpio.LOW) : rpio.write(lamp, rpio.HIGH); return rpio.read(lamp) == 1; 
                case  'mstrm-light1': logger.log('led 1'); rpio.read(led1) == 1 ? rpio.write(led1, rpio.LOW) : rpio.write(led1, rpio.HIGH); return rpio.read(led1) == 1;
                case  'gstrm-light1': logger.log('led 2'); rpio.read(led2) == 1 ? rpio.write(led2, rpio.LOW) : rpio.write(led2, rpio.HIGH); return rpio.read(led2) == 1;
        }
	return false;
}

var respond = function(message){
	var deviceState = JSON.parse( message.toString());
	var exit = false;
	for(var i=0; i<globalRoomData.length; i++){
		if(globalRoomData[i].id == eval(deviceState.roomId)){
			for(var j=0;j<globalRoomData[i].deviceList.length;j++){
				if(globalRoomData[i].deviceList[j].id == deviceState.deviceId){
                                        //Synch Call to GPIO operation
					var currentState = toggleDevice(deviceState.deviceId);
					logger.log('Device Id:' + deviceState.deviceId + ', current state -' + currentState);
					globalRoomData[i].deviceList[j].status = currentState;
                                        client.publish('T_APESCONSOLE_RD', '{"roomId": "' + deviceState.roomId + '", "deviceId": "' + deviceState.deviceId + '", "status": ' + currentState + '}');
					exit = true; 
					break;
				}
			}
		}
                if(exit) break;
	}	
}

// subscribe to a topic
client.on('connect', function() { // When connected
	logger.log('Apesconcole Heroku HUB - MQTT Subscriber Up!');
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
