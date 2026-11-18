#!/bin/sh
curl -s --max-time 3000 -X POST --data-binary @"${1:--}" http://127.0.0.1:9799/
