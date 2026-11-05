fx_version 'cerulean'
game 'gta5'

name 'gtaw-mechanic'
description 'Standalone mechanic job: vehicle diagnostics, interactive repairs and garage stock.'
version '1.0.0'

ui_page 'web/dist/index.html'

files {
  'config.json',
  'web/dist/index.html',
  'web/dist/assets/*',
}

client_script 'client/dist/client.js'
server_script 'server/dist/GtawMechanic.Server.net.dll'
