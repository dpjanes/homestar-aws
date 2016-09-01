/*
 *  keys.js
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

const path = require('path');
const fs = require('fs');
const url = require('url');
const unirest = require('unirest');
const mkdirp = require('mkdirp');
const Q = require('q');

const errors = require('iotdb-errors');

const logger = iotdb.logger({
    name: 'homestar-aws',
    module: 'keys',
});

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
 */
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

        resolve(awsd);
    });
};

/**
 *  Return true if keys are in place
 */
const ready = function(locals) {
    const settings = locals.homestar.settings;
    return !_.is.Empty(_.d.get(settings, "keys/aws"));
};

/**
 *  It will get X.509 certificates to contact AWS if you do not have them already.
 *
 *  Done will be called back with (null, true) if keys have just been downloaded and installed
 */
const setup = function (locals, done) {
    const settings = locals.homestar.settings;

    const consumer_key = _.d.get(settings, "keys/homestar/key");
    if (_.is.Empty(consumer_key)) {
        logger.info({
            method: "setup",
            cause: "Homestar API Keys have not been setup",
        }, "no consumer key - can't get AWS keys");

        return done(new errors.SetupRequired(), false);
    }

    if (ready(locals)) {
        logger.info({
            method: "setup",
        }, "AWS keys already downloaded -- good to go");
        return done(null, false);
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
                        method: "setup/unirest.end",
                        awsd: awsd,
                    }, "AWS keys setup");

                    settings.keys.aws = awsd;

                    done(null, true);

                })
                .catch((error) => {
                    logger.error({
                        method: "setup/unirest.end",
                        error: _.error.message(result.error),
                    }, "could not get AWS keys");

                    done(error);
                });
        });
};

/**
 *  API
 */
exports.setup = setup;
exports.ready = ready;
