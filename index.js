"use strict";
const Influx = require('influx');
const express = require('express');
const http = require('http');
const os = require('os');

const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const ruuviParser = require('ruuvi.endpoints.js');

const app = express();

const config = require('./influx-configuration.js')

const ruuvi_database = config.database;
const ruuvi_measurement = config.measurement;
const data_port = config.port;
const influx_host = config.host;

const ruuvi_schema = [{
    measurement: ruuvi_measurement,
    fields: {
        rssi: Influx.FieldType.INTEGER,
        temperature: Influx.FieldType.FLOAT,
        humidity: Influx.FieldType.FLOAT,
        pressure: Influx.FieldType.FLOAT,
        accelerationX: Influx.FieldType.FLOAT,
        accelerationY: Influx.FieldType.FLOAT,
        accelerationZ: Influx.FieldType.FLOAT,
        batteryVoltage: Influx.FieldType.FLOAT,
        txPower: Influx.FieldType.INTEGER,
        movementCounter: Influx.FieldType.INTEGER,
        measurementSequenceNumber: Influx.FieldType.INTEGER
    },
    tags: [
        'dataFormat',
        'mac',
        'gateway_id'
    ]
}];

const influx = new Influx.InfluxDB({
    host: influx_host,
    database: ruuvi_database,
    schema: ruuvi_schema,
    username: config.influxUser,
    password: config.influxPassword
});

// https://gist.github.com/tauzen/3d18825ae41ff3fc8981
const byteToHexString = function(uint8arr) {
    if (!uint8arr) {
        return '';
    }

    var hexStr = '';
    for (var i = 0; i < uint8arr.length; i++) {
        var hex = (uint8arr[i] & 0xff).toString(16);
        hex = (hex.length === 1) ? '0' + hex : hex;
        hexStr += hex;
    }

    return hexStr.toUpperCase();
}

const hexStringToByte = function(str) {
    if (!str) {
        return new Uint8Array();
    }

    var a = [];
    for (var i = 0, len = str.length; i < len; i += 2) {
        a.push(parseInt(str.substr(i, 2), 16));
    }

    return new Uint8Array(a);
}

influx.getDatabaseNames()
    .then(names => {
        if (!names.includes(ruuvi_database)) {
            return influx.createDatabase(ruuvi_database);
        }
    })
    .then(() => {
        http.createServer(app).listen(data_port, function() {
            console.log('Listening on port ' + data_port);
        })
    })
    .catch(err => {
        console.error(`Error creating Influx database!`);
    })

app.use((req, res, next) => {
    const start = Date.now()

    res.on('finish', () => {
        const duration = Date.now() - start;
        // console.log(`Request to ${req.path} took ${duration}ms`);

        influx.writePoints([{
            measurement: 'response_times',
            tags: {
                host: os.hostname()
            },
            fields: {
                duration,
                path: req.path
            },
        }]).catch(err => {
            console.error(`Error saving data to InfluxDB! ${err.stack}`);
        })
    })
    return next();
});

const ruuviHexStringToInflux = function(hexstring) {
    //console.log(hexstring);
    let binary = hexStringToByte(hexstring);
    // console.log(byteToHexString(binary));
    // Skip non-broadcast types
    if (binary[0] < 2 || binary[0] > 5 || binary.size < 10) {
        return null;
    }
    //console.log(hexstring);

    let data = ruuviParser.parse(binary);
    let influx_point = {};
    influx_point.fields = {};
    influx_point.tags = {};
    influx_point.measurement = ruuvi_measurement;
    influx_point.fields.temperature = data.temperature;
    influx_point.fields.humidity = data.humidity;
    influx_point.fields.pressure = data.pressure;
    influx_point.fields.txPower = data.txPower;
    influx_point.fields.movementCounter = data.movementCounter;
    influx_point.fields.measurementSequenceNumber = data.measurementSequenceNumber;
    influx_point.tags.dataFormat = data.destination_endpoint;
    // Workaround ruuvi.endpoints.js scaling differences
    if (3 == data.destination_endpoint) {
        influx_point.fields.accelerationX = data.accelerationX / 1000.0;
        influx_point.fields.accelerationY = data.accelerationY / 1000.0;
        influx_point.fields.accelerationZ = data.accelerationZ / 1000.0;
    } else if (5 == data.destination_endpoint) {
        influx_point.fields.accelerationX = data.accelerationX;
        influx_point.fields.accelerationY = data.accelerationY;
        influx_point.fields.accelerationZ = data.accelerationZ;
    }
    if (data.battery) {
        influx_point.fields.batteryVoltage = data.battery / 1000.0;
    }
    if (data.batteryVoltage) {
        influx_point.fields.batteryVoltage = data.batteryVoltage;
    }
    return influx_point;
}

app.post('/ruuvistation', jsonParser, function(req, res) {
    // console.log(req.body);
    // get all elements
    // for each element parse data
    // Write elements to influx
    let measurements = req.body;
    let influx_samples = [];

    // IF ruuvi station data
    if (measurements.tags && Array.isArray(measurements.tags)) {
        measurements.tags.forEach(function(sample) {
            //If not ruuvi broadcast data, continue to next sample
            /*let hex_data = byteToHexString(sample.rawDataBlob.blob);
            if (!hex_data.includes("FF99040")) {
                return;
            }*/

            //let influx_point = ruuviHexStringToInflux(hex_data.slice(hex_data.indexOf("FF99040") + 6));
            let influx_point = {};
            influx_point.fields = {};
            influx_point.tags = {};
            influx_point.measurement = ruuvi_measurement;
            influx_point.fields.rssi = sample.rssi;
            influx_point.tags.mac = sample.id;
            influx_point.tags.gateway_id = measurements.deviceId;
            influx_samples.push(influx_point);
        });
        // console.log(influx_samples);
        influx.writePoints(influx_samples).catch(err => {
            console.error(`Error saving data to InfluxDB! ${err.stack}`)
        });
    } else console.log("not an array");
    // console.log(influx_samples);
    res.send("ok");
});

app.post('/gateway', jsonParser, async function(req, res) {
    let post = req.body;
    let influx_samples = [];
    if (!post.data) {
        res.send("invalid");
        return;
    }
    let measurements = post.data.tags
    let ms = Date.now(); //milliseconds, convert to ns for influx


    Object.keys(measurements).forEach(function(key) {
        let sample = measurements[key];
        let data = sample.data.toUpperCase();


        //Handle data points from Ruuvi tag broadcast formats
        if (data &&
            data.includes("FF99040")) {
            let influx_point = ruuviHexStringToInflux(data.slice(data.indexOf("FF99040") + 6));

            influx_point.fields.rssi = sample.rssi;
            influx_point.tags.mac = key;
            influx_point.tags.gateway_id = post.data.gw_mac;
            //console.log(post.data);
            influx_samples.push(influx_point);
            //Influx allows only one measurement per nanosecond with same tags
            let timestamp = Influx.toNanoDate((ms * 1000000).toString());
            influx_point.timestamp = timestamp.getNanoTime();
            ms += 1;
            influx_samples.push(influx_point);
        }
    });
    //console.log(influx_samples)
    influx.writePoints(influx_samples).catch(err => {
        console.error(`Error saving data to InfluxDB! ${err.stack}`)
    });

    res.send("ok");
});

/*
 * Heartbeat scans
 */
app.get('/monitor', jsonParser, async function(req, res) {
    res.send("I'm up :)");
});

process
    .on('unhandledRejection', (reason, p) => {
        console.error(reason, 'Unhandled Rejection at Promise', p);
    })
    .on('uncaughtException', err => {
        console.error(err, 'Uncaught Exception thrown');
        // process.exit(1);
    });