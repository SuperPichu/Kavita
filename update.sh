#!/bin/bash
./build.sh linux-x64
rsync -r --exclude _output/linux-x64/Kavita/config _output/linux-x64/Kavita/* casper:/home/chris/dev/kavita/