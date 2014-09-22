/*
 * ----------------------------------------------------------------------------
 * "THE BEER-WARE LICENSE" (Revision 42):
 * <timklge@wh2.tu-dresden.de> wrote this file. As long as you retain this notice you
 * can do whatever you want with this stuff. If we meet some day, and you think
 * this stuff is worth it, you can buy me a beer in return - Tim Kluge
 * ----------------------------------------------------------------------------
 */

var net = require("net");
var LineInputStream = require("line-input-stream");
var events = require("events");
var util = require("util");
function extendPrototype(child, parent) {
    for (i in parent.prototype) {
        child.prototype[i] = parent.prototype[i];
    }
}

var TeamSpeakClient = function(host, port) {
    events.EventEmitter.call(this);

    var self = this;
    this.socket = net.connect(port || 10011, host || 'localhost');
    this.reader = null;
    this.status = -2;
    this.queue = [];
    this.executing = null;
    this.init();
};
module.exports = TeamSpeakClient;

TeamSpeakClient.prototype = {
    init: function() {
        this.socket.on("error", function(err) {
            self.emit("error", err);
        });

        this.socket.on("close", function() {
            self.emit("close", self.queue);
        });

        this.socket.on("connect", this.processResponse.bind(this));
    },

    tsescape: function(s) {
        var r = String(s);
        r = r.replace(/\\/g, "\\\\");   // Backslash
        r = r.replace(/\//g, "\\/");    // Slash
        r = r.replace(/\|/g, "\\p");    // Pipe
        r = r.replace(/\n/g, "\\n");    // Newline
        r = r.replace(/\r/g, "\\r");    // Carriage Return
        r = r.replace(/\t/g, "\\t");    // Tab
        r = r.replace(/\v/g, "\\v");    // Vertical Tab
        r = r.replace(/\f/g, "\\f");    // Formfeed
        r = r.replace(/ /g,  "\\s");    // Whitespace
        return r;
    },

    tsunescape: function(s) {
        var r = String(s);
        r = r.replace(/\\s/g,  " ");    // Whitespace
        r = r.replace(/\\p/g,  "|");    // Pipe
        r = r.replace(/\\n/g,  "\n");   // Newline
        r = r.replace(/\\f/g,  "\f");   // Formfeed
        r = r.replace(/\\r/g,  "\r");   // Carriage Return
        r = r.replace(/\\t/g,  "\t");   // Tab
        r = r.replace(/\\v/g,  "\v");   // Vertical Tab
        r = r.replace(/\\\//g, "\/");   // Slash
        r = r.replace(/\\\\/g, "\\");   // Backslash
        return r;
    },

    checkQueue: function() {
        if (!this.executing && this.queue.length >= 1) {
            this.executing = this.queue.shift();
            this.socket.write(this.executing.text + "\n");
        }
    },

    parseResponse: function(s) {
        var self = this;
        var response = [];
        var records = s.split("|");

        response = records.map(function(k) {
            var args = k.split(" ");
            var thisrec = {};
            args.forEach(function(v) {
                var equalsPos = v.indexOf("=");
                if (equalsPos > -1){
                    var key = self.tsunescape(v.substr(0, equalsPos));
                    var value = self.tsunescape(v.substr(equalsPos + 1));
                    if (parseInt(value, 10) == value) {
                        value = parseInt(value, 10);
                    }
                    thisrec[key] = value;
                } else {
                    thisrec[v] = "";
                }
            });
            return thisrec;
        });

        if (response.length === 0) {
            response = null;
        } else if (response.length === 1) {
            response = response.shift();
        }

        return response;
    },

    // Return pending commands that are going to be sent to the server.
    // Note that they have been parsed - Access getPending()[0].text to get
    // the full text representation of the command.
    getPending: function() {
        return this.queue.slice(0);
    },

    // Clear the queue of pending commands so that any command that is currently queued won't be executed.
    // The old queue is returned.
    clearPending: function() {
        var q = this.queue;
        this.queue = [];
        return q;
    },

    // Send a command to the server
    send: function(cmd, cmdParams, cmdOptions, callback, params) {
        var tosend = this.tsescape(cmd);
        cmdOptions.forEach(function(v) {
            tosend += " -" + self.tsescape(v);
        });
        for (var k in cmdParams) {
            var v = cmdParams[k];
            if (util.isArray(v)) {
                // Multiple values for the same key - concatenate all
                var doptions = v.map(function(val) {
                    return self.tsescape(k) + "=" + self.tsescape(val);
                });
                tosend += " " + doptions.join("|");
            } else if (v !== null) {
                tosend += " " + this.tsescape(k.toString()) + "=" + this.tsescape(v.toString());
            }
        }
        this.queue.push({cmd: cmd, options: cmdOptions, parameters: cmdParams, text: tosend, cb: callback, cbparams: params});
        if (this.status === 0) {
            this.checkQueue();
        }
    },

    processResponse: function() {
        var self = this;
        this.reader = LineInputStream(self.socket);
        this.reader.on("line", function(line) {
            var s = line.trim();
            // Ignore two first lines sent by server ("TS3" and information message)
            if (self.status < 0) {
                self.status++;
                if (self.status === 0) {
                    self.checkQueue();
                }
                return;
            }
            // Server answers with:
            // [- One line containing the answer ]
            // - "error id=XX msg=YY". ID is zero if command was executed successfully.
            var response = undefined;
            if (s.indexOf("error") === 0) {
                response = self.parseResponse.call(self, s.substr("error ".length).trim());
                self.executing.error = response;
                if (self.executing.error.id === "0") {
                    delete self.executing.error;
                }
                if (self.executing.cb) {
                    self.executing.cb.call(self.executing, self.executing.error, self.executing.response, self.executing.rawResponse, self.executing.cbparams);
                }
                self.executing = null;
                self.checkQueue();
            } else if (s.indexOf("notify") === 0) {
                s = s.substr("notify".length);
                response = self.parseResponse.call(self, s);
                self.emit(s.substr(0, s.indexOf(" ")), response);
            } else if (self.executing) {
                response = self.parseResponse.call(self, s);
                self.executing.rawResponse = s;
                self.executing.response = response;
            }
            self.emit("connect");
        });
    }
};

extendPrototype(TeamSpeakClient, events.EventEmitter);
