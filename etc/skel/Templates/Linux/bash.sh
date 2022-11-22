#!/usr/bin/env bash

# <description script>
#
# Author: Cristiano Fraga G. Nunes <cfgnunes@gmail.com>

set -eu

SCRIPT_NAME=$(basename "$0")

_main() {
    _log "Hello, World!"
}

_log() {
    local MESSAGE=$1

    logger -s "[$SCRIPT_NAME] $MESSAGE"
}

_main "$@"
