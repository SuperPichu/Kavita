#!/bin/bash
rsync casper:/home/chris/dev/kavita/config/kavita.db API/config/kavita.db
rm API/config/kavita.db-shm
rm API/config/kavita.db-wal