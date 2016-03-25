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
const cfg = iotdb.cfg;

const path = require('path')
const fs = require('fs')
const url = require('url')

const iotdb_transport = require('iotdb-transport');
const MQTTTransport = require('iotdb-transport-mqtt').Transport;

const logger = iotdb.logger({
    name: 'homestar-homestar',
    module: 'homestar',
});

const make_mqtt_transporter = function(locals) {
    const certificate_id = _.d.get(locals.homestar.settings, "aws/mqtt/certificate_id");
    if (!certificate_id) {
        logger.error({
            method: "make_mqtt_transporter",
            cause: "likely you haven't set up module homestar-homestar correctly",
        }, "missing settings.aws.mqtt.certificate_id");
        return null;
    }

    const search = [".iotdb", "$HOME/.iotdb", ];
    const folder_name = path.join("certs", certificate_id);
    const folders = cfg.cfg_find(cfg.cfg_envd(), search, folder_name);
    if (folders.length === 0) {
        logger.error({
            method: "make_mqtt_transporter",
            search: [".iotdb", "$HOME/.iotdb", ],
            folder_name: path.join("certs", certificate_id),
            cause: "are you running in the wrong folder - check .iotdb/certs",
        }, "could not find the 'certs' folder");
        return null;
    }
    const cert_folder = folders[0];

    const aws_url = _.d.get(locals.homestar.settings, "aws/mqtt/url");
    const aws_urlp = url.parse(aws_url);

    return new MQTTTransport({
        host: aws_urlp.host,
        prefix: aws_urlp.path.replace(/^\//, ''),
        ca: path.join(cert_folder, "rootCA.pem"),
        cert: path.join(cert_folder, "cert.pem"),
        key: path.join(cert_folder, "private.pem"),
        allow_updated: true,
    });
};

/**
 *  Functions defined in index.setup
 */
var on_ready = function(locals) {
    const mqtt_transporter = make_mqtt_transporter(locals);
    const iotdb_transporter = locals.homestar.things.make_transporter();
    const owner = locals.homestar.users.owner();

    iotdb_transport.bind(iotdb_transporter, mqtt_transporter, {
        bands: [ "meta", "istate", "ostate", "model", ],
        user: owner,
    });

    logger.info({
        method: "on_ready",
    }, "connected AWS to Things");
};

exports.on_ready = on_ready;
