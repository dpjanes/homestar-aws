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

const MQTTTransport = require('iotdb-transport-mqtt').Transport;
const IOTDBTransport = require('iotdb-transport-iotdb').Transport;

const logger = iotdb.logger({
    name: 'homestar-homestar',
    module: 'homestar',
});


/*
var transport = new MQTTTransport({
    host: "A1GOKL7JWGA91X.iot.us-east-1.amazonaws.com",
    prefix: "iotdb/homestar/0/81EA6324-418D-459C-A9C4-D430F30021C7/alexa",
    ca: path.join(__dirname, "certs/rootCA.pem"),
    cert: path.join(__dirname, "certs/cert.pem"),
    key: path.join(__dirname, "certs/private.pem"),
    allow_updated: true,
});
 */

const mqtt_transport = function(locals) {
    const certificate_id = _.d.get(locals.homestar.settings, "aws/mqtt/certificate_id");
    if (!certificate_id) {
        logger.error({
            method: "mqtt_transport",
            cause: "likely you haven't set up module homestar-homestar correctly",
        }, "missing settings.aws.mqtt.certificate_id");
        return null;
    }

    const search = [".iotdb", "$HOME/.iotdb", ];
    const folder_name = path.join("certs", certificate_id);
    const folders = cfg.cfg_find(cfg.cfg_envd(), search, folder_name);
    if (folders.length === 0) {
        logger.error({
            method: "mqtt_transport",
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
    console.log("on_ready");
        // console.log("HERE:XXX", locals.homestar.settings.aws);
        // console.log(locals.homestar.things);
        // console.log(locals.homestar.recipes);
        mqtt_transport(locals);
        process.exit();

    /*
    transport.updated({
        id: 'FirstIntent',
        band: 'command',
    }, function(error, ud) {
        if (error) {
            console.log("#", error);
            return;
        }

        console.log("+", ud.value);
    });
     */
};

exports.on_ready = on_ready;
