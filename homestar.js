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
    name: 'homestar-homestar',
    module: 'homestar',
});

var _mqtt;

/**
 *  Even though this isn't really a Bridge, we make 
 *  it look like one in the settings
 */
const _initd = function () {
    return _.d.compose.shallow({},
        iotdb.keystore().get("bridges/AWSBridge/initd"), {
            out_bands: ["meta", "istate", "model", "connection", ],
            in_bands: [ "ostate", "meta", ],
            use_iot_model: true,
            ping: 5 * 60,
        }
    );
};

/**
 *  Create a connection to AWS MQTT. This will be shared amongst multiple connections
 */
const _setup_mqtt = function (locals) {
    if (_mqtt) {
        return;
    }

    const settings = locals.homestar.settings;
    const initd = _initd();

    const certificate_id = _.d.get(settings, "keys/aws/certificate_id");
    if (!certificate_id) {
        logger.error({
            method: "_make_out_mqtt_transporter",
            cause: "likely you haven't set up module homestar-homestar correctly",
        }, "missing settings.aws.mqtt.certificate_id");
        return null;
    }

    const search = [".iotdb", "$HOME/.iotdb", ];
    const folder_name = path.join("certs", certificate_id);
    const folders = cfg.cfg_find(cfg.cfg_envd(), search, folder_name);
    if (folders.length === 0) {
        logger.error({
            method: "_make_out_mqtt_transporter",
            search: [".iotdb", "$HOME/.iotdb", ],
            folder_name: path.join("certs", certificate_id),
            cause: "are you running in the wrong folder - check .iotdb/certs",
        }, "could not find the 'certs' folder");
        return null;
    }
    const cert_folder = folders[0];

    const aws_url = _.d.get(settings, "keys/aws/url");
    const aws_urlp = url.parse(aws_url);

    _mqtt = new iotdb_transport_mqtt.mqtt_connect({
        verbose: true,
        host: aws_urlp.host,
        ca: path.join(cert_folder, "rootCA.pem"),
        cert: path.join(cert_folder, "cert.pem"),
        key: path.join(cert_folder, "private.pem"),
    });

    return;
};

/**
 *  This makes the MQTT transporter for sending _to_ AWS.
 *
 *  Note that the message sent isn't "nice", this has to do with
 *  permission checking etc that has to take place on AWS to
 *  make sure no one is hacking the system.
 */
const _make_out_mqtt_transporter = function (locals) {
    if (!_mqtt) {
        logger.error({
            method: "_make_out_mqtt_transporter",
            cause: "see previous errors",
        }, "_mqtt is not set");
        return;
    }

    const settings = locals.homestar.settings;
    const initd = _initd();

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
    }, _mqtt);
};

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

/**
 *  This takes the certificates from HomeStar.io and
 *  adds them to your settings
 */
const _save = function (body) {
    return new Promise((resolve, reject) => {
        var awsd = {};

        var keys = ["url", "consumer_key", "certificate_id", "certificate_arn", ];
        keys.map((key) => {
            var value = body[key];
            if (value) {
                awsd[key] = value;
            }
        });

        iotdb.keystore().save("/homestar/runner/keys/aws", awsd);

        logger.info({
            module: "_save",
        }, "added AWS keys to Keystore!");

        resolve(awsd);
    });
};

/**
 *  This does the work of setting up a connection between IOTDB and AWS
 */
const _setup_mqtt_to_aws = function (locals) {
    const mqtt_transporter = _make_out_mqtt_transporter(locals);
    if (!mqtt_transporter) {
        logger.info({
            method: "_setup_mqtt_to_aws",
        }, "could not make MQTTTransporter - see previous messages for reason");
        return;
    }

    const iotdb_transporter = locals.homestar.things.make_transporter();
    const owner = locals.homestar.users.owner();

    iotdb_transport.bind(iotdb_transporter, mqtt_transporter, {
        bands: _initd().out_bands,
        user: owner,
    });

    logger.info({
        method: "_setup_mqtt_to_aws",
    }, "connected AWS to Things");
};

const _setup_ping = function (locals) {
    const initd = _initd();
    if (!initd.ping) {
        logger.warn({
            method: "_setup_ping",
        }, "AWS ping is turned off");
        return;
    }

    if (!_mqtt) {
        logger.error({
            method: "_make_out_mqtt_transporter",
            cause: "see previous errors",
        }, "_mqtt is not set");
        return;
    }

    const settings = locals.homestar.settings;
    const aws_url = _.d.get(settings, "keys/aws/url");
    const aws_urlp = url.parse(aws_url);
    const channel = aws_urlp.path.replace(/^\//, '') + "/" + OUTPUT_TOPIC;

    setInterval(() => {
        var pd = iotdb.controller_meta();
        pd = _.timestamp.add(pd);
        pd = _.ld.compact(pd);

        const msgd = {
            c: {
                n: "ping",
            },
            p: pd,
        };

        _mqtt.publish(channel, JSON.stringify(msgd), () => {
            logger.info({
                channel: channel,
            }, "pinged");
        });
    }, initd.ping * 1000);
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
                        _setup_mqtt(locals);
                        _setup_mqtt_to_aws(locals);
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
    _setup_mqtt(locals);
    _setup_mqtt_to_aws(locals);
    _setup_ping(locals);
};

/**
 *  API
 */
exports.on_ready = on_ready;
exports.on_profile = on_profile;
