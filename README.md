# homestar-aws
HomeStar extension to allow control through AWS IoT.

<img src="https://raw.githubusercontent.com/dpjanes/iotdb-homestar/master/docs/HomeStar.png" align="right" />

# IMPORTANT NOTE

If you install this, everything happening in your IOTDB / HomeStar installation
will be broadcast to AWS IoT MQTT. It's _private_ to you, but just beware.

# Installation

* [Install Home☆Star first](https://homestar.io/about/install).

## Method #1

If you are using HomeStar Runner (e.g. `homestar runner` to get a UI), this will suffice

    $ homestar install homestar-aws

## Method #2

If you are not using HomeStar Runner, first install with NPM

    $ npm install homestar-aws

Then in your program do this

    iotdb = require('iotdb')
    iotdb.use('homestar-aws')

Note that you'll still have to configure things first before 
you run that program, see the next section

# Configuration

## Create a HomeStar Account

* go to [https://homestar.io](https://homestar.io)
* click on [Sign In](https://homestar.io/sign/in)

A popup window will lead you through the installation process.
You will need access to a mobile phone, as this
uses Facebook's [Account Kit](https://developers.facebook.com/docs/accountkit).

## Create a Runner

* go to [Runners](https://homestar.io/runners)
* click on [Make new Runner](https://homestar.io/runners/add)

This will bring you to a new page. Then click on the
**Show Access Tokens** button to the right.

It will give you a set of command line instructions to set up 
your access Keys.

# Run your program

Do `homestar runner` or run your program with the `use('homestar-aws')` statement as above.

This will automatically configure itself, downloading X.509 certificates to  the
`.iotdb/certs` folder, assuming all the previous installation steps were done correctly.
