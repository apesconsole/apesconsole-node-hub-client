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


var toggleDevice = function(deviceId){
	switch(deviceId){
		case    'water-pump': 
			logger.log('Pump'); 
			if(rpio.read(pump) == 1)
				rpio.write(pump, rpio.LOW);
			else 
				rpio.write(pump, rpio.HIGH); 
			return rpio.read(pump) == 1;
		case   'hall-light1': 
			logger.log('Lamp'); 
			if(rpio.read(lamp) == 1)
				rpio.write(lamp, rpio.LOW); 
			else 
				rpio.write(lamp, rpio.HIGH);
			return rpio.read(lamp) == 1; 
        case  'mstrm-light1': 
			logger.log('led 1'); 
			if(rpio.read(led1) == 1)
				rpio.write(led1, rpio.LOW);
			else 
				rpio.write(led1, rpio.HIGH); 
			return rpio.read(led1) == 1;
		case  'gstrm-light1': 
			logger.log('led 2'); 
			if(rpio.read(led2) == 1)
				rpio.write(led2, rpio.LOW);
			else 
				rpio.write(led2, rpio.HIGH);
			return (rpio.read(led2) == 1);
    }
	return false;
}

var respond = function(message){
	var triggerMessage = JSON.parse( message.toString());
	var currentState = toggleDevice(triggerMessage.deviceId);
	logger.log('Device Id:' + triggerMessage.deviceId + ', current state -' + currentState);
	if(client != null){
		//Send Device Feed Back to HUB
		client.publish(
			'T_APESCONSOLE_RD', 
			'{"roomId": "' + deviceState.roomId + '", "deviceId": "' + deviceState.deviceId + '", "status": ' + currentState + '}'
		);
	}		
}

var previousRead = null; 
var pollSensor = function(){
	var reading = rpio.read(sensor);
	logger.log('Sensor Reading: ' + reading);
	//Prevent state update every poll
	if(previousRead != reading && client != null){
		//Change in state detected. Inform HUB
		previousRead = reading;
		//Send Sensor Feed Back to HUB
		client.publish(
			'T_APESCONSOLE_RD', 
			'{"roomId": "' + deviceState.roomId + '", "deviceId": "soil-sensor", "status": ' + reading + '}'
		);
	}
}
/*	
	Soil Sensor Poller activated
	Send Soil Status to HUB every minute
*/
setInterval(function(){
	pollSensor();
}, 60000);


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
