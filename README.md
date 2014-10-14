node-teamspeak
==============

This is a tiny CommonJS-module which allows you to connect
to any TeamSpeak (R)-3-Server which has the ServerQuery-API
enabled. Using the ServerQuery-API, you can do everything
a normal TeamSpeak-user can do
(except sending and receiving voice data) automatically via JavaScript
(e. g. listing clients logged in on the server).

The ServerQuery-specification is available [here](http://media.teamspeak.com/ts3_literature/TeamSpeak%203%20Server%20Query%20Manual.pdf).

How to install
---------------

Node:

	npm install node-teamspeak
	
Example Usage
----------------

After registering a ServerQuery-account using your TeamSpeak-Client, you
can login using node-teamspeak (Alternatively, you can login as the root
account "ServerAdmin" which is created during the installation of the 
server). The following code prints out a JSON-array containing all
 clients that are currently connected to the first virtual server:

	var TeamSpeakClient = require("node-teamspeak"),
		util = require("util");

	var cl = new TeamSpeakClient("##SERVERIP###");
	cl.send("login", {client_login_name: "##USERNAME##", client_login_password: "##PASSWORD##"}, [], function(err, response, rawResponse){
		cl.send("use", {sid: 1}, function(err, response, rawResponse){
			cl.send("clientlist", function(err, response, rawResponse){
				console.log(util.inspect(response));
			});
		});
	});

Usage information
-----------------

* TeamSpeakClient.send is the main method that executes a command. A command (string),
an object with parameters, an array with options and a callback-function can be
passed to the send-function. The callback-function takes three parameters:
  err (which contains an object like {id: 1, msg: "failed"} if there was an error),
  response (which is an object containing the parsed response from the server) and
  rawResponse (which contains the unparsed response text from the server).

* Every TeamSpeakClient-instance is an EventEmitter. You can install
listeners to the "connect", "close" and the "error" events. The error-event
will only be fired if there was socket-error, not if a sent command failed.

* If you want to register to notifications sent by the TeamSpeak-Server,
you can send a normal command "servernotifyregister" (consider specification).
Any event sent by the server that starts with "notify" is then fired as
an event (e. g. as soon as a "notifyclientmove"-notification is sent by the server,
the TeamSpeakClient-instance fires the "clientmove"-event with only
one parameter which is an object containing the given parameters). 
