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

const path = require('path');
const fs = require('fs');
const url = require('url');
const unirest = require('unirest');
const mkdirp = require('mkdirp');
const Q = require('q');

const iotdb_transport = require('iotdb-transport');
const iotdb_transport_mqtt = require('iotdb-transport-mqtt');

const OUTPUT_TOPIC = "o";

const logger = iotdb.logger({
    name: 'homestar-aws',
    module: 'homestar',
});

const mqtt = require('./mqtt');
const out = require('./out');

const _unpack_dir = function (body) {
    return path.join(".", ".iotdb", "certs", body.certificate_id);
};

/**
 *  This makes sure the needed folders exist
 */
const _make_unpack_dirs = function (body) {
    return new Promise((resolve, reject) => {
        if (!body.certificate_id) {
            return reject(new Error("no certificate_id?"));
        }

        mkdirp(_unpack_dir(body), function (error) {
            if (error) {
                return reject(error);
            }

            resolve(body);
        });
    });
};

/**
 *  This takes the certificates from HomeStar.io and
 *  unpacks them into the filesystem.
 */
const _unpack = function (body) {
    return new Promise((resolve, reject) => {
        var file_path;
        body.inventory = [];
        body.inventory.push("aws.json");

        for (var file_name in body.files) {
            body.inventory.push(file_name);
            file_path = path.join(_unpack_dir(body), file_name);
            fs.writeFileSync(file_path, body.files[file_name]);
        }

        delete body.files;

        file_path = path.join(_unpack_dir(body), "aws.json");
        fs.writeFileSync(file_path, JSON.stringify(body, null, 2));

        resolve(body);
    });
};

const _setup_ping = function (locals) {
    const initd = mqtt.initd(locals);
    if (!initd.ping) {
        logger.warn({
            method: "_setup_ping",
        }, "AWS ping is turned off");
        return;
    }

    const mqtt_client = mqtt.client(locals);
    if (!mqtt_client) {
        logger.error({
            method: "_make_out_mqtt_transporter",
            cause: "see previous errors",
        }, "mqtt_client is not set");
        return;
    }

    const settings = locals.homestar.settings;
    const aws_url = _.d.get(settings, "keys/aws/url");
    const aws_urlp = url.parse(aws_url);
    const channel = aws_urlp.path.replace(/^\//, '') + "/" + OUTPUT_TOPIC;

    const _ping = () => {
        var pd = iotdb.controller_meta();
        pd = _.timestamp.add(pd);
        pd = _.ld.compact(pd);

        const msgd = {
            c: {
                n: "ping",
            },
            p: pd,
        };

        mqtt_client.publish(channel, JSON.stringify(msgd), () => {
            logger.info({
                channel: channel,
            }, "pinged");
        });
    };

    _ping();
    setInterval(_ping, initd.ping * 1000);
};

/* --- iotdb-homestar API --- */

/**
 *  This is called when iotdb-homestar successfully contacts HomeStar.io.
 *  It will get X.509 certificates to contact AWS if you do not
 *  have them already.
 */
const on_profile = function (locals, profile) {
    const settings = locals.homestar.settings;

    const consumer_key = _.d.get(settings, "keys/homestar/key");
    if (_.is.Empty(consumer_key)) {
        logger.info({
            cause: "Homestar API Keys have not been setup",
        }, "no consumer key - can't get AWS keys");
        return;
    }

    const keys = _.d.get(settings, "keys/aws");
    if (keys) {
        logger.info({}, "AWS keys already downloaded -- good to go");
        return;
    }

    const API_ROOT = settings.homestar.url + '/api/1.0';
    const API_CERTS = API_ROOT + '/consumers/' + consumer_key + '/certs';

    unirest
        .get(API_CERTS)
        .headers({
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + settings.keys.homestar.bearer,
        })
        .type('json')
        .end(function (result) {
            if (result.error || !result.body) {
                logger.error({
                    status: result.statusCode,
                    url: API_CERTS,
                    error: _.error.message(result.error),
                }, "could not retrieve AWS keys");

                return;
            }

            Q.fcall(() => result.body)
                .then(_make_unpack_dirs)
                .then(_unpack)
                .then(_save)
                .then((awsd) => {
                    logger.info({
                        method: "on_profile",
                        awsd: awsd,
                    }, "AWS keys setup");

                    settings.keys.aws = awsd;

                    process.nextTick(() => {
                        // _setup_mqtt(locals);
                        out.setup(locals);
                        _setup_ping(locals);
                    });

                })
                .catch((error) => {
                    logger.error({
                        method: "on_profile",
                        error: _.error.message(result.error),
                    }, "could not get AWS keys");
                });
        });
};

/**
 *  Called by iotdb-homestar webserver is up and running.
 *  This is really 
 */
const on_ready = function (locals) {
    out.setup(locals);
    _setup_ping(locals);
};

/**
 *  API
 */
exports.on_ready = on_ready;
exports.on_profile = on_profile;
