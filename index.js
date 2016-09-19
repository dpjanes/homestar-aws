/*
 *  index.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-03-15
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

const iotdb_homestar = require('homestar');

const transport_out = require('./out');
const transport_in = require('./in');
const ping = require('./ping');
const keys = require('./keys');

const logger = iotdb.logger({
    name: 'homestar-aws',
    module: 'index',
});

/*
 *  called whenever webserver is up and running
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
 *  For homestar
 */
exports.homestar = {
    on_ready: on_ready,
};

/**
 *  For iotdb.use()
 */
exports.use = () => on_ready(require('homestar').locals());

/**
 *  For "$ homestar configure homestar-aws"
 */
exports.configure_cli = (done) =>{
    const locals = iotdb_homestar.locals();

    keys.setup(locals, (error, is_added) => {
        if (error) {
            done(error);
        } else if (is_added) {
            done(null, "AWS keys added - ready to roll");
        } else {
            done(null, "AWS already set up");
        }
    });
};

exports.module_folder = __dirname;
