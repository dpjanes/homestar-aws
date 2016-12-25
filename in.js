/*
 *  in.js
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

const INPUT_TOPIC = "i";

const logger = iotdb.logger({
    name: 'homestar-aws',
    module: 'in',
});

const mqtt = require('./mqtt');

/**
 *  This makes the MQTT transporter for receiving 
 *  messages _from_ AWS.
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

    const runner_id = iotdb.settings().get("/homestar/runner/keys/aws/key", null);

    return iotdb_transport_mqtt.make({
        verbose: true,
        prefix: aws_urlp.path.replace(/^\//, ''),
        allow_updated: true,
        channel: (paramd, d) => {
            if (d.id === "#") {
                return iotdb_transport.channel(paramd, {
                    id: INPUT_TOPIC,
                });
            } else {
                return iotdb_transport.channel(paramd, d);
            }
        },
        unchannel: (paramd, topic, message) => {
            if (!message) {
                return {};
            }

            try {
                const msgd = JSON.parse(message);

                if (!msgd.c) {
                    return {};
                } else if (!msgd.p) {
                    return {};
                } else if ((msgd.c.n !== "updated") && (msgd.c.n !== "iput")) {
                    return {};
                } else if (msgd.c.src && (msgd.c.src === runner_id)) {
                    return {};
                }

                if (msgd.c.id && msgd.c.band) {
                    return {
                        id: msgd.c.id, 
                        band: msgd.c.band,
                    };
                }

                return;
            } catch (x) {
                if (x.name === "SyntaxError") {
                    return {};
                }

                throw x;
            }
        },
        unpack: (message, d) => {
            try {
                const msgd = JSON.parse(message);
                return msgd.p || null;
            } catch (x) {
                if (x.name === "SyntaxError") {
                    return null;
                }

                throw x;
            }
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

    // do not allow writes
    mqtt_transporter.rx.put = (observer, d) => observer.onCompleted();

    const iotdb_transporter = iotdb_transport_iotdb.make({});
    iotdb_transporter.monitor(mqtt_transporter);

    logger.info({
        method: "setup",
    }, "connected AWS to Things");
};

/**
 *  API
 */
exports.setup = setup;
