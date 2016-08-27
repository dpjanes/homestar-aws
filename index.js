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

const homestar = require('./homestar');

const logger = iotdb.logger({
    name: 'homestar-aws',
    module: 'index',
});

exports.homestar = {
    /**
     *  Called whenever webserver is up and running
     */
    on_ready: homestar.on_ready,

    /**
     *  Called when the profile is updated
     */
    on_profile: homestar.on_profile,
};

/**
 *  For iotdb.use()
 */
exports.use = function() {
    var locals;

    try {
        locals = require('homestar').locals();
    } catch (x) {
        logger.error({
            method: "use",
            cause: "some additional functions needed, you must $ npm install iotdb-homestar",
            error: _.error.message(x),
            stack: x.stack,
        }, "cannot call module.use");
        return;
    }

    if (!homestar.on_ready(locals)) {
        homestar.on_profile(locals);
    }
}
