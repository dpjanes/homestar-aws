/*
 *  out.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-04-23
 *
 *  Copyright [2013-2016] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict";

const iotdb = require('iotdb');
const _ = iotdb._;

const url = require('url');

const iotdb_transport = require('iotdb-transport');
const iotdb_transport_mqtt = require('iotdb-transport-mqtt');
const iotdb_transport_iotdb = require('iotdb-transport-iotdb');

const OUTPUT_TOPIC = "o";

const logger = iotdb.logger({
    name: 'homestar-aws',
    module: 'out',
});

const mqtt = require('./mqtt');

/**
 *  This makes the MQTT transporter for sending _to_ AWS.
 *
 *  Note that the message sent isn't "nice", this has to do with
 *  permission checking etc that has to take place on AWS to
 *  make sure no one is hacking the system.
 */
const _create_transporter = function () {
    const mqtt_client = mqtt.client();
    if (!mqtt_client) {
        logger.error({
            method: "connect",
            cause: "see previous errors",
        }, "mqtt_client is not set");
        return;
    }

    const aws_url = iotdb.settings().get("/homestar/runner/keys/aws/url", null);
    const aws_urlp = url.parse(aws_url);

    return iotdb_transport_mqtt.make({
        what: "AWS-OUT",
        verbose: true,
        prefix: aws_urlp.path.replace(/^\//, ''),
        allow_updated: false,

        // throw away 'id' and 'band'
        channel: (paramd, d) => iotdb_transport.channel(paramd, { id: OUTPUT_TOPIC }),
        pack: (paramd, d) => {
            const msgd = {
                c: {
                    n: "put",
                    id: d.id || "",
                    band: d.band || "",
                },
                /*
                p: _.timestamp.add(d.value, {
                    timestamp: _.timestamp.epoch(),
                }),
                */
                p: JSON.stringify(_.timestamp.add(d.value, {
                    timestamp: _.timestamp.epoch(),
                })),
            };

            return JSON.stringify(msgd);
        },
    }, mqtt_client);
};

/**
 *  This does the work of setting up a connection between IOTDB and AWS
 */
const setup = function () {
    const mqtt_transporter = _create_transporter();
    if (!mqtt_transporter) {
        logger.info({
            method: "setup",
        }, "could not make MQTTTransporter - see previous messages for reason");
        return;
    }

    const iotdb_transporter = iotdb_transport_iotdb.make({});
    mqtt_transporter.monitor(iotdb_transporter);

    logger.info({
        method: "setup",
    }, "connected AWS to Things");
};

/**
 *  API
 */
exports.setup = setup;
