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
var rpiDhtSensor = require('rpi-dht-sensor');

var mqtt_url = url.parse('tcp://m13.cloudmqtt.com:16786');

/* PIN SET UP */
var rpio = require('rpio');
var options = {
        gpiomem: true,          /* Use /dev/gpiomem */
        mapping: 'physical',    /* Use the P1-P40 numbering scheme */
}

var moisturesensor    = 16;

var tmptr = new rpiDhtSensor.DHT11(25);


var pump   = 15;
var lamp   = 13;
var led1   = 33;
var led2   = 37;

rpio.init([options]);
 

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
  username: 'APES_CONSOLE_HUB',
  password: '1234567890'
});

var path = __dirname + '/public/';
app.use('/resources', express.static(path + 'resources'));
app.use("/", router);


var toggleDevice = function(deviceId){
	switch(deviceId){
		case    'water_pump': 
			logger.log('Pump'); 
			if(rpio.read(pump) == 1)
				rpio.write(pump, rpio.LOW);
			else 
				rpio.write(pump, rpio.HIGH); 
			return rpio.read(pump) == 1 ? false : true;
		case   'hall_light1': 
			logger.log('Lamp'); 
			if(rpio.read(lamp) == 1)
				rpio.write(lamp, rpio.LOW); 
			else 
				rpio.write(lamp, rpio.HIGH);
			return rpio.read(lamp) == 1 ? false : true; 
        case  'mstrm_light1': 
			logger.log('led 1'); 
			if(rpio.read(led1) == 1)
				rpio.write(led1, rpio.LOW);
			else 
				rpio.write(led1, rpio.HIGH); 
			return rpio.read(led1) == 1;
		case  'gstrm-_light1': 
			logger.log('led 2'); 
			if(rpio.read(led2) == 1)
				rpio.write(led2, rpio.LOW);
			else 
				rpio.write(led2, rpio.HIGH);
			return (rpio.read(led2) == 1);
    }
	return false;
}


var publishData = function(message){
	client.publish(
		'T_APESCONSOLE_RD', 
		message
	);
}


var respond = function(message){
	var triggerMessage = JSON.parse( message.toString());
	if('undefined' == triggerMessage.status) triggerMessage.status = false;
        var currentState = toggleDevice(triggerMessage.deviceId);
	logger.log('Device Id:' + triggerMessage.deviceId + ', current state -' + currentState);
	//Prevent state update if request and GPIO state are both same
	if(client != null && triggerMessage.status != currentState){
		//Send Device Feed Back to HUB
		publishData(
			'{"roomId": "' + triggerMessage.roomId + '", "deviceId": "' + triggerMessage.deviceId + '", "status": ' + currentState + '}'
		);
	}		
}

var previousMoistureRead = null; 
var previousTemperatureRead = 0; 
var pollSensor = function(){

	var readout = tmptr.read();
	var temperatureReading = readout.temperature.toFixed(2);

	logger.log('Moisture Sensor Reading    : ' + moistureReading);
	logger.log('Temperature Sensor Reading : ' + temperatureReading);
	
	/*Prevent state update every poll
	if(previousMoistureRead != moistureReading && client != null){
		//Change in state detected. Inform HUB
		previousMoistureRead = moistureReading;
		//Send Sensor Feed Back to HUB
		publishData('{"deviceId": "moisture_sensor", "status": "' + moistureReading + '", "value" : "' + (moistureReading ? 'Optimal' : 'Critical') + '", "color": "' + (moistureReading ? 'green' : 'red') + '"}');
	} 
	*/

	if(eval(temperatureReading) > 0 &&  eval(previousTemperatureRead) != eval(temperatureReading) && client != null){
		//Change in state detected. Inform HUB
		previousTemperatureRead = temperatureReading;
		//Send Sensor Feed Back to HUB
		publishData('{"deviceId": "temperature_sensor", "status": true, "value" : "' + temperatureReading + '", "color" : "calm"}');
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
        
        //Reset All Device 
        client.publish(
                'T_APESCONSOLE_RESET', '{reset: true}'
        );
        
});

/*
        Soil Sensor Poller activated
        Send Soil Status to HUB every minute
*/
setInterval(function(){
        pollSensor();
}, 10000);

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

http.listen(process.env.PORT || 3001, function(){				
	logger.log('##################################################');
	logger.log('        Ape\'s Console - NODE - CLIENT ');
	logger.log('        Process Port :' + process.env.PORT);
	logger.log('        Local Port   :' + 3002);
	logger.log('##################################################');
});
