import requests
import threading

print('##################################################');
print('        Python Analog Sensor Component ');
print('##################################################');

def sendSensorStatus():
	url = 'http://localhost:3002/updatedata'
	payload = {'isOptimal': 'true'}
	try:
		r = requests.post(url, data=payload)
		print('NodeJs Component - Update Status - ' + str(r.status_code))
	except: 
		pass
		
	threading.Timer(5.0, sendSensorStatus).start()
	
sendSensorStatus()
