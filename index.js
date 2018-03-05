"use strict";
const Influx = require('influx');
const express = require('express');
const http = require('http');
const os = require('os');

const app = express();

const ruuvi_database = 'ruuvi_measurements';
const data_port      = 3001;

const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: ruuvi_database,
  schema: [
    {
      measurement: 'response_times',
      fields: {
        path: Influx.FieldType.STRING,
        duration: Influx.FieldType.INTEGER
      },
      tags: [
        'host'
      ]
    }
  ]
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
})