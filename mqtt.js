/*
 *  mqtt.js
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
const cfg = iotdb.cfg;

const path = require('path');
const url = require('url');

const iotdb_transport_mqtt = require('iotdb-transport-mqtt');

const logger = iotdb.logger({
    name: 'homestar-aws',
    module: 'homestar',
});

let _mqtt_client = null;

/**
 *  Create a connection to AWS MQTT. This will be shared amongst multiple connections
 */
const mqtt_client = () => {
    if (_mqtt_client) {
        return _mqtt_client;
    }

    const certificate_id = iotdb.settings().get("/homestar/runner/keys/aws/certificate_id")
    if (!certificate_id) {
        logger.error({
            method: "mqtt_client",
            cause: "likely you haven't set up module homestar-homestar correctly",
        }, "missing /homestar/runner/keys/aws/certificate_id");
        return null;
    }

    const search = [".iotdb", "$HOME/.iotdb", ];
    const folder_name = path.join("certs", certificate_id);
    const folders = _.cfg.find(search, folder_name);
    if (folders.length === 0) {
        logger.error({
            method: "mqtt_client",
            search: [".iotdb", "$HOME/.iotdb", ],
            folder_name: path.join("certs", certificate_id),
            cause: "are you running in the wrong folder - check .iotdb/certs",
        }, "could not find the 'certs' folder");

        return null;
    }
    const cert_folder = folders[0];
        
    const aws_url = iotdb.settings().get("/homestar/runner/keys/aws/url");
    const aws_urlp = url.parse(aws_url);

    _mqtt_client = iotdb_transport_mqtt.connect({
        verbose: true,
        host: aws_urlp.host,
        ca: path.join(cert_folder, "rootCA.pem"),
        cert: path.join(cert_folder, "cert.pem"),
        key: path.join(cert_folder, "private.pem"),
    }, error => {
        if (error) {
            logger.error({
                error: _.error.message(error),
                cause: "check previous errors",
            }, "could not not create MQTT client - serious");
        }
    });

    return _mqtt_client;
};

/**
 *  API
 */
exports.client = mqtt_client;
