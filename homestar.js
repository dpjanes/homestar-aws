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

const logger = iotdb.logger({
    name: 'homestar-aws',
    module: 'homestar',
});

const mqtt = require('./mqtt');
const transport_out = require('./out');
const transport_in = require('./in');
const ping = require('./ping');
const keys = require('./keys');

/* --- iotdb-homestar API --- */

/**
 *  This is called when iotdb-homestar successfully contacts HomeStar.io.
 *  It will get X.509 certificates to contact AWS if you do not
 *  have them already.
 */
const on_profile = function (locals, profile) {
    keys.setup(locals, (error, added) => {
        if (added) {
            transport_out.setup(locals);
            transport_in.setup(locals);
            ping.setup(locals);
        }
    });
};

/**
 *  Called by iotdb-homestar webserver is up and running.
 */
const on_ready = function (locals) {
    if (!keys.ready(locals)) {
        logger.warn({
            method: "on_ready",
        }, "AWS connection is not configured");

        return;
    }

    transport_out.setup(locals);
    transport_in.setup(locals);
    ping.setup(locals);

    return true;
};

/**
 *  API
 */
exports.on_ready = on_ready;
exports.on_profile = on_profile;
