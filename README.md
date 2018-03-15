# ruuvi.influxproxy.js
NodeJS server for receiving data payloads from RuuviTags via gateways, RuuviStation etc and publishing data to InfluxDB

# Installing

```
Git clone this repository
npm install
Install InfluxDB
Install Grafana http://docs.grafana.org/installation/debian/
NOT starting on installation, please execute the following statements to configure grafana to start automatically using systemd
 sudo /bin/systemctl daemon-reload
 sudo /bin/systemctl enable grafana-server
### You can start grafana-server by executing
 sudo /bin/systemctl start grafana-server

```

# Usage

```
node index.js
```

# Testing

Run server locally and CURL test data to your server. 
`curl -X POST -H "Content-Type: application/json"  @ruuvi.influxproxy.js/testdata_gateway.json localhost:3001/gateway`