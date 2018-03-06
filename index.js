"use strict";
const Influx = require('influx');
const express = require('express');
const http = require('http');
const os = require('os');

const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
//GW sends malformed JSON, work around it
const gwjsonParser = bodyParser.text({ type: 'application/json' });
const dJSON = require('dirty-json');

// dJSON is async, patch express support
const aa = require('express-async-await');
const app = aa(express());

const ruuvi_database = 'ruuvi';
const ruuvi_schema   = [
{
  measurement: 'ruuvi_measurements',
  // TODO time
  fields: {
    rssi: Influx.FieldType.INTEGER
    // TODO: measurements
  },
  tags: [
  'mac',
  'gateway_id'
  ]
}
];


const data_port   = 3001;
const influx_host = 'playground.ruuvi.com';


const influx = new Influx.InfluxDB({
  host: influx_host,
  database: ruuvi_database,
  schema: ruuvi_schema
});

        // if (name != null) {
        //     p.tag("name", name);
        // }
        // if (measurement.dataFormat != null) {
        //     p.tag("dataFormat", String.valueOf(measurement.dataFormat));
        // }
        // if (measurement.time != null) {
        //     p.time(measurement.time, TimeUnit.MILLISECONDS);
        // }
        // addValueIfNotNull(p, "temperature", measurement.temperature);
        // addValueIfNotNull(p, "humidity", measurement.humidity);
        // addValueIfNotNull(p, "pressure", measurement.pressure);
        // addValueIfNotNull(p, "accelerationX", measurement.accelerationX);
        // addValueIfNotNull(p, "accelerationY", measurement.accelerationY);
        // addValueIfNotNull(p, "accelerationZ", measurement.accelerationZ);
        // addValueIfNotNull(p, "batteryVoltage", measurement.batteryVoltage);
        // addValueIfNotNull(p, "txPower", measurement.txPower);
        // addValueIfNotNull(p, "movementCounter", measurement.movementCounter);
        // addValueIfNotNull(p, "measurementSequenceNumber", measurement.measurementSequenceNumber);
        // addValueIfNotNull(p, "rssi", measurement.rssi);
        // if (extended) {
        //     addValueIfNotNull(p, "accelerationTotal", measurement.accelerationTotal);
        //     addValueIfNotNull(p, "absoluteHumidity", measurement.absoluteHumidity);
        //     addValueIfNotNull(p, "dewPoint", measurement.dewPoint);
        //     addValueIfNotNull(p, "equilibriumVaporPressure", measurement.equilibriumVaporPressure);
        //     addValueIfNotNull(p, "airDensity", measurement.airDensity);
        //     addValueIfNotNull(p, "accelerationAngleFromX", measurement.accelerationAngleFromX);
        //     addValueIfNotNull(p, "accelerationAngleFromY", measurement.accelerationAngleFromY);
        //     addValueIfNotNull(p, "accelerationAngleFromZ", measurement.accelerationAngleFromZ);
        // }
        // return p.build();

        influx.getDatabaseNames()
        .then(names => {
          if (!names.includes(ruuvi_database)) {
            return influx.createDatabase(ruuvi_database);
          }
        })
        .then(() => {
          http.createServer(app).listen(data_port, function () {
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
            console.log(`Request to ${req.path} took ${duration}ms`);

            influx.writePoints([
            {
              measurement: 'response_times',
              tags: { host: os.hostname() },
              fields: { duration, path: req.path },
            }
            ]).catch(err => {
              console.error(`Error saving data to InfluxDB! ${err.stack}`);
            })
          })
          return next();
        })

        app.get('/', function (req, res) {
          setTimeout(() => res.end('Hello world!'), Math.random() * 500);
        })

// { deviceId: 'laurin-s8',
//   eventId: '591db9bc-32f0-4059-86e0-8e6cc808492c',
//   tags: 
//    [ { accelX: 0.019,
//        accelY: -0.003,
//        accelZ: 1.041,
//        defaultBackground: 0,
//        favorite: false,
//        humidity: 88,
//        id: 'F8:AC:76:59:5B:24',
//        name: 'Over Humidity',
//        pressure: 974.01,
//        rawDataBlob: [Object],
//        rssi: -45,
//        temperature: 27.25,
//        updateAt: 'Mar 6, 2018 11:21:46',
//        voltage: 2.989 } ],
//   time: 'Mar 6, 2018 11:21:46' }



// influxdata
//
//  
//
//

app.post('/ruuvistation', jsonParser, function (req, res) {
  console.log(req.body);
    // get all elements
    // for each element parse data
    // Write elements to influx

    //Just kidding, simply store RSSI for now
    let measurements = req.body;
    let influx_samples = [];
    // IF ruuvi station data
    if(measurements.tags){
      measurements.tags.forEach(function(sample){
        let influx_point = {};
        influx_point.rssi = sample.rssi;
        influx_point.mac = sample.id;
        influx_samples.push(influx_point);
      });
      console.log(influx_samples);
      // TODO: Store to influx
    }

    res.send("ok");
  });

app.post('/gateway', gwjsonParser, async function (req, res) {
    // get all elements
    // for each element parse data
    // Write elements to influx

    //Just kidding, simply store RSSI for now
    //console.log(req.body);
    let str = req.body;
    let measurements = await dJSON.parse(str);
    //console.log(measurements);
    //console.log("parsing gw data");

    let influx_samples = [];
    // IF GW data

    if(Array.isArray(measurements)){
      //console.log(measurements);
      measurements.forEach(function(sample){
        let influx_point = {};
        influx_point.rssi = sample.rssi;
        // format D6A911ADA763 into D6:A9:11:AD:A7:63
        influx_point.mac = sample.mac.match(/.{2}/g).join(":");
        influx_samples.push(influx_point);
        //console.log(influx_point);
        //console.log("Parsed data");
      });
      console.log(influx_samples);
      // TODO: Store to influx
    }else console.log("not an array");

    res.send("ok");
  });

app.get('/times', function (req, res) {
  influx.query(`
    select * from response_times
    where host = ${Influx.escape.stringLit(os.hostname())}
    order by time desc
    limit 10
    `).then(result => {
      res.json(result);
    }).catch(err => {
      res.status(500).send(err.stack);
    })
  });