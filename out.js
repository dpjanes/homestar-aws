/*
 *  homestar.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-03-16
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

const path = require('path');
const fs = require('fs');
const url = require('url');

const iotdb_transport = require('iotdb-transport');
const iotdb_transport_mqtt = require('iotdb-transport-mqtt');

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
const _create_transporter = function (locals) {
    const mqtt_client = mqtt.client(locals);
    if (!mqtt_client) {
        logger.error({
            method: "connect",
            cause: "see previous errors",
        }, "mqtt_client is not set");
        return;
    }

    const settings = locals.homestar.settings;
    const initd = mqtt.initd(locals);

    const aws_url = _.d.get(settings, "keys/aws/url");
    const aws_urlp = url.parse(aws_url);

    return new iotdb_transport_mqtt.Transport({
        verbose: true,
        prefix: aws_urlp.path.replace(/^\//, ''),
        allow_updated: true,
        channel: (initd, id, band) => {
            // throw away 'id' and 'band'
            return iotdb_transport.channel(initd, OUTPUT_TOPIC);
        },
        pack: (d, id, band) => {
            if (initd.use_iot_model && (band === "model") && d["iot:model"]) {
                d = {
                    "iot:model": d["iot:model"],
                    "@timestamp": _.timestamp.epoch(),
                };
            }

            const msgd = {
                c: {
                    n: "put",
                    id: id || "",
                    band: band || "",
                },
                p: d,
            };

            return JSON.stringify(msgd);
        },
    }, mqtt_client);
};

/**
 *  This does the work of setting up a connection between IOTDB and AWS
 */
const setup = function (locals) {
    const mqtt_transporter = _create_transporter(locals);
    if (!mqtt_transporter) {
        logger.info({
            method: "setup",
        }, "could not make MQTTTransporter - see previous messages for reason");
        return;
    }

    const iotdb_transporter = locals.homestar.things.make_transporter();
    const owner = locals.homestar.users.owner();

    iotdb_transport.bind(iotdb_transporter, mqtt_transporter, {
        bands: mqtt.initd(locals).out_bands,
        user: owner,
    });

    logger.info({
        method: "setup",
    }, "connected AWS to Things");
};

/**
 *  API
 */
exports.setup = setup;
