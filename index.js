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
const ruuvi_measurement = 'ruuvi_measurements';
const ruuvi_schema   = [
{
  measurement: ruuvi_measurement,
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
    if(measurements.tags && Array.isArray(measurements.tags)){
      measurements.tags.forEach(function(sample){
        let influx_point = {};
        influx_point.fields = {};
        influx_point.tags = {};
        influx_point.measurement = ruuvi_measurement;
        influx_point.fields.rssi = sample.rssi;
        influx_point.tags.mac = sample.id;
        influx_point.tags.gateway_id = measurements.deviceId;
        influx_samples.push(influx_point);
      });
      console.log(influx_samples);
      influx.writePoints(influx_samples).catch(err => {
        console.error(`Error saving data to InfluxDB! ${err.stack}`)});
    }else console.log("not an array");

    res.send("ok");
  });

 // [ { timestamp: '2017-12-28T12:33:38Z',
 //    type: 'Unknown',
 //    mac: 'D6A911ADA763',
 //    bleName: '',
 //    rssi: -29,
 //    rawData: '02010415FF990403401713B9CC001CFFF804080BC50000000000' },
 //  { timestamp: '2017-12-28T12:33:38Z',
 //    type: 'Unknown',
 //    mac: 'D6A911ADA763',
 //    bleName: '',
 //    rssi: -39,
 //    rawData: '02010415FF990403401713B9CC001CFFF804080BC50000000000' },
 //  { timestamp: '2017-12-28T12:33:40Z',
 //    type: 'Unknown',
 //    mac: 'D6A911ADA763',
 //    bleName: '',
 //    rssi: -40,
 //    rawData: '02010415FF990403401712B9CB0020FFFC04000BC50000000000' } ]

 app.post('/gateway', gwjsonParser, async function (req, res) {
  let str = req.body;
  if(!str) 
  { 
    res.send("invalid");
    return;
  }
  let measurements = await dJSON.parse(str);
  let ms = Date.now(); //nanoseconds
  console.log(ms);

    // IF GW data
    if(Array.isArray(measurements)){
      let influx_samples = [];
      measurements.forEach(function(sample){
        // print debug data to console TODO log file
        if(sample.name === "gateway"){
          console.log(sample.action);
          //For each is a function call, "continue"
          return;
        }

        //Handle data points from Ruuvi tag broadcast formats
        if(sample.type &&
         sample.type === "Unknown" &&
         sample.rawData &&
         sample.rawData.includes("FF99040"))
        {
          let influx_point = {};
          influx_point.fields = {};
          influx_point.tags = {};
          influx_point.measurement = ruuvi_measurement;
          influx_point.fields.rssi = sample.rssi;
        // format D6A911ADA763 into D6:A9:11:AD:A7:63
        influx_point.tags.mac = sample.mac.match(/.{2}/g).join(":");
        influx_point.tags.gateway_id = "Ruuvi GW";
        //Influx allows only one measurement per nanosecond with same tags
        let timestamp = Influx.toNanoDate(ms*1000000);
        influx_point.timestamp = timestamp.getNanoTime();
        ms += 1;
        influx_samples.push(influx_point);
      }
    });
      console.log(influx_samples);
      influx.writePoints(influx_samples).catch(err => {
        console.error(`Error saving data to InfluxDB! ${err.stack}`)});
    }else console.log("not an array");

    res.send("ok");
  });