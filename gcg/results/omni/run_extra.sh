#!/bin/bash
# Extension of Omni S4 beyond the handoff's top 5: the K2N2 check ranking did not predict what the pure GA reaches
# (G/P: check 58.5 -> K4N6 65.4 after the pure GA), so the next two units by check (GR 56.6, MP 56.1) get the same pure GA.
# Waits for the main run to finish (results/omni/COMPLETE), then reruns the resumable driver with OMNI_TOP=7.
cd "$(dirname "$0")/../.." || exit 1
while [ ! -f results/omni/COMPLETE ]; do sleep 120; done
SIM_WORKERS=${SIM_WORKERS:-3} OMNI_TOP=7 node omni.js >> results/omni_driver_extra.out 2>&1
