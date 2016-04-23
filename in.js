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
            if (id === "#") {
                return iotdb_transport.channel(initd, INPUT_TOPIC);
            } else {
                return iotdb_transport.channel(initd, id, band);
            }
        },
        unchannel: (initd, topic, message) => {
            if (!message) {
                return;
            }

            try {
                const msgd = JSON.parse(message);

                if (!msgd.c) {
                    return;
                } else if (!msgd.p) {
                    return;
                } else if (msgd.c.n !== "updated") {
                    return;
                } /* XXX check here for bounces */

                if (msgd.c.id && msgd.c.band) {
                    return [ msgd.c.id, msgd.c.band, ];
                }

                return;
            } catch (x) {
                if (x.name === "SyntaxError") {
                    return null;
                }

                throw x;
            }
        },
        unpack: (message, id, band) => {
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
        bands: mqtt.initd(locals).in_bands,
        user: owner,
        updated: true,
        verbose: true,
        update: false,
        updated: true,
        get: false,
        list: false,
        added: false,
        copy: false,
        what: "AWS-OUT",
    });

    logger.info({
        method: "setup",
    }, "connected AWS to Things");
};

/**
 *  API
 */
exports.setup = setup;
