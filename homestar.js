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
const unirest = require('unirest')
const mkdirp = require('mkdirp');
const Q = require('q');

const iotdb_transport = require('iotdb-transport');
const MQTTTransport = require('iotdb-transport-mqtt').Transport;

const logger = iotdb.logger({
    name: 'homestar-homestar',
    module: 'homestar',
});

const _make_mqtt_transporter = function(locals) {
    var settings = locals.homestar.settings;

    const certificate_id = _.d.get(settings, "keys/aws/certificate_id");
    if (!certificate_id) {
        logger.error({
            method: "_make_mqtt_transporter",
            cause: "likely you haven't set up module homestar-homestar correctly",
        }, "missing settings.aws.mqtt.certificate_id");
        return null;
    }

    const search = [".iotdb", "$HOME/.iotdb", ];
    const folder_name = path.join("certs", certificate_id);
    const folders = cfg.cfg_find(cfg.cfg_envd(), search, folder_name);
    if (folders.length === 0) {
        logger.error({
            method: "_make_mqtt_transporter",
            search: [".iotdb", "$HOME/.iotdb", ],
            folder_name: path.join("certs", certificate_id),
            cause: "are you running in the wrong folder - check .iotdb/certs",
        }, "could not find the 'certs' folder");
        return null;
    }
    const cert_folder = folders[0];

    const aws_url = _.d.get(settings, "keys/aws/url");
    const aws_urlp = url.parse(aws_url);

    return new MQTTTransport({
        host: aws_urlp.host,
        prefix: aws_urlp.path.replace(/^\//, ''),
        ca: path.join(cert_folder, "rootCA.pem"),
        cert: path.join(cert_folder, "cert.pem"),
        key: path.join(cert_folder, "private.pem"),
        allow_updated: true,
        channel: function(initd, id, band) {
            // throw away 'id' and 'band'
            return iotdb_transport.channel(initd);
        },
        pack: function(d, id, band) {
            d = _.d.clone.shallow(d);
            d["@iot:id"] = id || "";
            d["@iot:band"] = band || "";

            return JSON.stringify(d);
        },
    });
};

/**
 *  Functions defined in index.setup
 */
var on_ready = function(locals) {
    const mqtt_transporter = _make_mqtt_transporter(locals);
    if (!mqtt_transporter) {
        return;
    }

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

var _unpack_dir = function(body) {
    return path.join(".", ".iotdb", "certs", body.certificate_id);
}

var _make_unpack_dirs = function(body) {
    return new Promise(( resolve, reject ) => {
        if (!body.certificate_id) {
            return reject(new Error("no certificate_id?"));
        }

        mkdirp(_unpack_dir(body), function(error) {
            if (error) {
                return reject(error);
            }

            resolve(body);
        });
    });
};

var _unpack = function(body) {
    return new Promise(( resolve, reject ) => {
        var file_path;
        body.inventory = [];
        body.inventory.push("aws.json");

        for (var file_name in body.files) {
            body.inventory.push(file_name);
            file_path = path.join(_unpack_dir(body), file_name);
            fs.writeFileSync(file_path, body.files[file_name]);
        };

        delete body.files;

        file_path = path.join(_unpack_dir(body), "aws.json");
        fs.writeFileSync(file_path, JSON.stringify(body, null, 2));

        // console.log("-------------");
        // console.log("unpacked", _unpack_dir(body));

        resolve(body);
    });
};

var _save = function(body) {
    return new Promise(( resolve, reject ) => {
        var awsd = {};

        var keys = [ "url", "consumer_key", "certificate_id", "certificate_arn", ];
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

        /*
        console.log("-------------");
        console.log("unpacked", awsd);
        */

        resolve(awsd);
    });
};

/**
 */
var on_profile = function(locals, profile) {
    var settings = locals.homestar.settings;

    var consumer_key = _.d.get(settings, "keys/homestar/key");
    if (_.is.Empty(consumer_key)) {
        logger.info({
            cause: "Homestar API Keys have not been setup",
        }, "no consumer key - can't get AWS keys");
        return;
    }

    var keys = _.d.get(settings, "keys/aws");
    if (keys) {
        logger.info({
        }, "AWS keys already downloaded -- good to go");
        return;
    }

    var API_ROOT = settings.homestar.url + '/api/1.0';
    var API_CERTS = API_ROOT + '/consumers/' + consumer_key + '/certs';

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
                        on_ready(locals);
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

exports.on_ready = on_ready;
exports.on_profile = on_profile;
