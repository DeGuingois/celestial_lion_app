#!/bin/sh
# À lancer avant chaque publication : l'app ouverte détecte le changement et propose de se recharger.
date -u +'{"version":"%Y-%m-%dT%H:%M:%SZ"}' > "$(dirname "$0")/../version.json"
