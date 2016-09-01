/*
 *  ping.js
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

const url = require('url');

const OUTPUT_TOPIC = "o";

const logger = iotdb.logger({
    name: 'homestar-aws',
    module: 'ping',
});

const mqtt = require('./mqtt');

/**
 *  Send a message to AWS saying we're alive
 */
const setup = function () {
    let ping = iotdb.settings().get("/bridges/homestar-aws/initd/ping", 5 * 60)
    if (ping === 0) {
        logger.warn({
            method: "ping",
        }, "AWS ping is turned off");
    }

    const mqtt_client = mqtt.client();
    if (!mqtt_client) {
        logger.error({
            method: "ping",
            cause: "see previous errors",
        }, "mqtt_client is not set");
        return;
    }

    const aws_url = iotdb.settings().get("/homestar/runner/keys/aws/url", null);
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
                method: "ping",
                channel: channel,
            }, "pinged");
        });
    };

    _ping();
    setInterval(_ping, ping * 1000);
};

/**
 */
exports.setup = setup;
