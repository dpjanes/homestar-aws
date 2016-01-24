/*
 *  aws.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-21
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

/**
 */
var on_ready = function(locals) {
    _to(locals);
    _from(locals);
};

var _to = function(locals) {
    var homestar = locals.homestar;
    var iotdb_transporter = homestar.things.make_transporter();
    var aws_transporter = new AWSTransport();
    
    iotdb_transport.push_to(aws_transporter, {
        user: homestar.users.owner(),
    });
};

var _from = function(locals) {
};

/**
 *  API
 */
exports.on_ready = on_ready;
