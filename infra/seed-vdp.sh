#!/usr/bin/env sh
set -e
psql -U antcrowd -d vdp -f /seed/seed-vdp.sql
